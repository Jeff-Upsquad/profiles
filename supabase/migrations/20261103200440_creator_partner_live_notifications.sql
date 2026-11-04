-- Creator Live transitions notify independently of CRM pipeline placement.
-- No backfill: already-Live accounts must not get a retrospective message.
create table public.creator_live_notice_outbox (
  id uuid primary key references public.notifications(id) on delete cascade,
  talent_user_id uuid not null references public.talent_users(id) on delete cascade,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default (now() + interval '30 seconds'),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.creator_live_notice_outbox enable row level security;
revoke all on public.creator_live_notice_outbox from anon, authenticated;
grant select, update on public.creator_live_notice_outbox to service_role;
create index creator_live_notice_pending on public.creator_live_notice_outbox(next_attempt_at)
  where delivered_at is null;

-- Runs only as a trigger. Elevated writes are required because talent stage
-- updates can arrive through clients which cannot author system notifications.
create function public.notify_creator_partner_live() returns trigger
language plpgsql security definer set search_path = '' as $$
declare notice_id uuid;
begin
  if new.pipeline_stage is distinct from 'live' or old.pipeline_stage is not distinct from 'live' then return new; end if;
  if not (coalesce(new.signup_form_type = 'social_media_creator', false)
    or coalesce('social-media-creator' = any(new.signup_categories), false)
    or exists(select 1 from public.talent_profiles p join public.categories c on c.id = p.category_id
      where p.talent_user_id = new.id and c.slug = 'social-media-creator' and p.deleted_at is null)) then
    return new;
  end if;
  insert into public.notifications(kind, system_type, title, body, link_url)
  values ('system', 'profile_approved', 'Your creator profile is now live',
    'Your profile is now live and visible to clients. Check Subscriptions for opportunities matched to your profile.',
    '/talent/subscriptions') returning id into notice_id;
  insert into public.notification_recipients(notification_id, talent_user_id) values (notice_id, new.id);
  insert into public.creator_live_notice_outbox(id, talent_user_id) values (notice_id, new.id);
  return new;
end;
$$;
revoke all on function public.notify_creator_partner_live() from public, anon, authenticated;
create trigger notify_creator_partner_live after update of pipeline_stage on public.talent_users
for each row execute function public.notify_creator_partner_live();

-- Reuse the already approved profile-live template, without depending on a
-- creator CRM board (older creators may have signed up under another role).
do $$
declare template record;
begin
  select t.id, t.workspace_id, t.language into strict template from public.crm_templates t
    where t.name = 'profile_live_notice' and t.status = 'APPROVED';
  insert into public.crm_system_automations(workspace_id, event_type, enabled, template_id, template_language, body_param_keys)
    values (template.workspace_id, 'talent_creator_profile_live', true, template.id, template.language, '[]'::jsonb)
    on conflict (workspace_id, event_type) do nothing;
  if not exists(select 1 from public.crm_system_automations a join public.crm_templates t on t.id = a.template_id
    and t.workspace_id = a.workspace_id where a.workspace_id = template.workspace_id
    and a.event_type = 'talent_creator_profile_live' and a.enabled and t.status = 'APPROVED'
    and t.name = 'profile_live_notice' and a.body_param_keys = '[]'::jsonb) then
    raise exception 'Creator Live requires the enabled, approved profile_live_notice mapping';
  end if;
end;
$$;
