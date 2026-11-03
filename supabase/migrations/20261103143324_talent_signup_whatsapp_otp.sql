-- Only the backend service role can manage signup challenges.
create table public.talent_signup_challenges (
  phone text primary key,
  email text not null,
  challenge_id uuid not null unique,
  code_hash text not null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  window_start timestamptz not null default now(),
  send_count integer not null default 1,
  attempts integer not null default 0,
  delivered boolean not null default false,
  consumed boolean not null default false
);
alter table public.talent_signup_challenges enable row level security;
revoke all on public.talent_signup_challenges from public, anon, authenticated;
grant select, insert, update, delete on public.talent_signup_challenges to service_role;
create index talent_signup_challenges_last_sent_idx on public.talent_signup_challenges(last_sent_at);

-- Serialize resends across processes, including the very first request.
create function public.reserve_talent_signup_code(p_phone text, p_email text, p_challenge_id uuid, p_code_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare previous public.talent_signup_challenges%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_phone, 0));
  select * into previous from public.talent_signup_challenges where phone = p_phone for update;
  if found and (previous.last_sent_at > now() - interval '60 seconds'
    or (previous.window_start > now() - interval '1 hour' and previous.send_count >= 5)) then
    return false;
  end if;
  -- Keep a bounded retention period; no live challenge or hourly limit is removed.
  with stale as (
    select phone from public.talent_signup_challenges
    where last_sent_at < now() - interval '1 day'
    order by last_sent_at limit 100 for update skip locked
  )
  delete from public.talent_signup_challenges c using stale where c.phone = stale.phone;
  insert into public.talent_signup_challenges(phone, email, challenge_id, code_hash, expires_at, window_start, send_count)
    values (p_phone, p_email, p_challenge_id, p_code_hash, now() + interval '10 minutes',
      case when previous.window_start > now() - interval '1 hour' then previous.window_start else now() end,
      case when previous.window_start > now() - interval '1 hour' then previous.send_count + 1 else 1 end)
  on conflict (phone) do update set email = excluded.email, challenge_id = excluded.challenge_id,
    code_hash = excluded.code_hash, expires_at = excluded.expires_at, last_sent_at = now(),
    window_start = excluded.window_start, send_count = excluded.send_count,
    attempts = 0, delivered = false, consumed = false;
  return true;
end;
$$;

-- Failed guesses commit their attempt count; row lock makes successful use single-shot.
create function public.consume_talent_signup_code(p_phone text, p_email text, p_challenge_id uuid, p_code_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare challenge public.talent_signup_challenges%rowtype;
begin
  select * into challenge from public.talent_signup_challenges
    where phone = p_phone and email = p_email and challenge_id = p_challenge_id for update;
  if not found or challenge.consumed or not challenge.delivered
    or challenge.expires_at <= now() or challenge.attempts >= 5 then return false; end if;
  update public.talent_signup_challenges set attempts = attempts + 1,
    consumed = (code_hash = p_code_hash) where phone = p_phone;
  return challenge.code_hash = p_code_hash;
end;
$$;
revoke all on function public.reserve_talent_signup_code(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.consume_talent_signup_code(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_talent_signup_code(text, text, uuid, text) to service_role;
grant execute on function public.consume_talent_signup_code(text, text, uuid, text) to service_role;

-- Reuse the existing talent reset authentication template for signup codes.
-- Fail closed rather than release mandatory OTP with no approved delivery path.
do $$
declare source record;
begin
  select a.workspace_id, a.template_id, t.language into strict source
  from public.crm_system_automations a
  join public.crm_templates t on t.id = a.template_id and t.workspace_id = a.workspace_id
  where a.event_type = 'talent_password_reset' and a.enabled = true
    and t.category = 'AUTHENTICATION' and t.status = 'APPROVED';

  insert into public.crm_system_automations
    (workspace_id, event_type, enabled, template_id, template_language, body_param_keys)
  values (source.workspace_id, 'talent_signup_verification_code', true,
    source.template_id, source.language, '["code"]'::jsonb)
  on conflict (workspace_id, event_type) do nothing;

  if not exists (
    select 1 from public.crm_system_automations a
    join public.crm_templates t on t.id = a.template_id and t.workspace_id = a.workspace_id
    where a.workspace_id = source.workspace_id and a.event_type = 'talent_signup_verification_code'
      and a.enabled = true and a.body_param_keys = '["code"]'::jsonb
      and t.category = 'AUTHENTICATION' and t.status = 'APPROVED'
  ) then
    raise exception 'Talent signup OTP requires an enabled approved authentication template mapped to code';
  end if;
end;
$$;
