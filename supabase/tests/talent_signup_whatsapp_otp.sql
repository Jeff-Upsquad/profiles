-- Run after the migration against an isolated local PostgreSQL database.
begin;
do $$
declare id uuid := '11111111-1111-4111-8111-111111111111'; ok boolean; i integer;
begin
  assert exists (select 1 from public.crm_system_automations where event_type = 'talent_signup_verification_code' and enabled and body_param_keys = '["code"]'::jsonb), 'approved CRM template mapping';
  assert not has_table_privilege('anon', 'public.talent_signup_challenges', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.talent_signup_challenges', 'UPDATE');
  assert not has_function_privilege('anon', 'public.consume_talent_signup_code(text,text,uuid,text)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.consume_talent_signup_code(text,text,uuid,text)', 'EXECUTE');
  assert public.reserve_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash');
  assert not public.reserve_talent_signup_code('+919876543210', 'other@example.test', gen_random_uuid(), 'hash'), 'resend cooldown';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'undelivered challenge';
  update public.talent_signup_challenges set delivered = true;
  assert not public.consume_talent_signup_code('+919876543211', 'talent@example.test', id, 'hash'), 'phone binding';
  assert not public.consume_talent_signup_code('+919876543210', 'other@example.test', id, 'hash'), 'email binding';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', gen_random_uuid(), 'hash'), 'challenge binding';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'wrong'), 'wrong code';
  assert public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'correct code';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'replay';
  update public.talent_signup_challenges set consumed = false, attempts = 0;
  for i in 1..5 loop
    assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'wrong');
  end loop;
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'guess limit';
  update public.talent_signup_challenges set attempts = 0, expires_at = now() - interval '1 second';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'expired code';
  update public.talent_signup_challenges set last_sent_at = now() - interval '61 seconds';
  assert public.reserve_talent_signup_code('+919876543210', 'talent@example.test', gen_random_uuid(), 'new-hash'), 'resend';
  assert not public.consume_talent_signup_code('+919876543210', 'talent@example.test', id, 'hash'), 'old code invalid after resend';
  update public.talent_signup_challenges set last_sent_at = now() - interval '61 seconds', send_count = 5;
  assert not public.reserve_talent_signup_code('+919876543210', 'different@example.test', gen_random_uuid(), 'hash'), 'hourly limit survives email change';
  update public.talent_signup_challenges set window_start = now() - interval '61 minutes';
  assert public.reserve_talent_signup_code('+919876543210', 'talent@example.test', gen_random_uuid(), 'hash'), 'hourly window resets';
end;
$$;
rollback;
