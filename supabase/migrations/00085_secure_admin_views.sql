-- Migration: 00085_secure_admin_views
-- Description: Lock down four public views that exposed data to the anon role,
-- resolving Supabase advisor ERRORs (auth_users_exposed x2, security_definer_view x4).
-- The admin_* and v_talent_profile_tier views are consumed only by the backend via
-- the service_role key (talent-access / admin / subscription-matcher services); the
-- anon role never needs them. admin_talent_search and v_talent_profile_tier join
-- auth.users, so they must keep definer rights (service_role cannot read auth.users) —
-- their exposure is removed by the REVOKEs instead of an invoker switch.
--
-- NOTE: already applied to production (project cwgrooocsklytlmvwabv) on 2026-06-11 via
-- the Supabase MCP. This file mirrors that change into migration history. All statements
-- are idempotent, so re-running is safe.

-- 1) Remove API exposure: anon/authenticated held ALL privileges on these views.
revoke all on public.admin_talent_search   from anon, authenticated;
revoke all on public.admin_business_search from anon, authenticated;
revoke all on public.admin_lead_search     from anon, authenticated;
revoke all on public.v_talent_profile_tier from anon, authenticated;

-- 2) Switch the two views that do NOT touch auth.users to invoker rights
--    (clears their security_definer_view lint; service_role keeps working).
alter view public.admin_business_search set (security_invoker = true);
alter view public.admin_lead_search     set (security_invoker = true);

-- admin_talent_search and v_talent_profile_tier intentionally remain definer-style:
-- they join auth.users, readable only by the view owner (postgres). If a later
-- migration DROPs and re-CREATEs either view, default privileges re-grant
-- anon/authenticated — re-apply the REVOKEs above in that migration.
