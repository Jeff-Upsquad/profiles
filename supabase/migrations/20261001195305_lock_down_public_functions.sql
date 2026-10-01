-- Lock down SECURITY DEFINER functions, fix is_admin(), pin search_path.
-- Supabase security advisor, 2026-10-01: lints 0028/0029 (19 functions
-- executable by anon/authenticated) and 0011 (18 functions with a mutable
-- search_path).
--
-- This database is shared by Profiles (SquadHire), Squad CRM, SquadHire CRM
-- and squadhub web. Every caller of these functions uses a server-side
-- service_role client. No app queries PostgREST as anon or authenticated:
-- the code was checked, and 24h of API logs showed only service_role
-- requests. anon and authenticated lose EXECUTE; service_role keeps it.
--
--   get_auth_users_by_emails/_by_ids   Profiles backend (auth, admin, integrations,
--                                      onboarding hub, subscriptions, partner installs,
--                                      iOS waitlist)
--   check_contact_exists(_detailed)    Profiles backend (auth, lead, agency admin)
--   link_leads_for_talent_user         Profiles backend (auth)
--   confirm_interview_attendance,
--   mark_absent_and_promote            Profiles backend (interviews)
--   claim_/release_business_card_*     Profiles backend (business card alerts)
--   admin_review_portfolio_item,
--   recruitment_dashboard_metrics,
--   recruitment_role_metrics           no callers in any app
--   sync_auth_user_to_public_users,
--   log_lead_status_event,
--   rls_auto_enable                    trigger / event-trigger functions; EXECUTE is
--                                      not checked when a trigger fires

-- 1. RPC functions: service_role only.
REVOKE ALL ON FUNCTION public.get_auth_users_by_emails(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_users_by_ids(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_contact_exists(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_contact_exists_detailed(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_leads_for_talent_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_interview_attendance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_absent_and_promote(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_business_card_alert(uuid, uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_business_card_group_alert(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_business_card_rollup(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_business_card_alert(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_business_card_group_alert(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_review_portfolio_item(uuid, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recruitment_dashboard_metrics(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recruitment_role_metrics(timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_auth_users_by_emails(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_users_by_ids(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_contact_exists(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_contact_exists_detailed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.link_leads_for_talent_user(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_interview_attendance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_absent_and_promote(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_business_card_alert(uuid, uuid, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_business_card_group_alert(uuid, uuid, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_business_card_rollup(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_business_card_alert(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_business_card_group_alert(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_review_portfolio_item(uuid, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.recruitment_dashboard_metrics(timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.recruitment_role_metrics(timestamptz, timestamptz, text) TO service_role;

-- 2. Trigger and event-trigger functions: nobody calls these over the API.
REVOKE ALL ON FUNCTION public.sync_auth_user_to_public_users() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_lead_status_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 3. is_admin() is the one function that has to stay callable: about 50 RLS
--    policies (roles = public) call it, so revoking it would make any
--    anon/authenticated read of those tables fail with "permission denied".
--    It read user_metadata.role, which every signed-in user can set on their
--    own account (supabase.auth.updateUser({ data: { role: 'admin' } })). That
--    let any user pass the admin policies on talent_users, business_users,
--    staff_users and other tables. It now reads app_metadata, which only the
--    service role can write. It also becomes SECURITY INVOKER, because
--    auth.jwt() needs no elevated rights; that clears 0028/0029 without a
--    revoke. CREATE OR REPLACE keeps the existing grants.
--
--    Backfill first so the two existing admins keep the same result.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE lower(email) IN ('admin@squadhire.com', 'jeff@squadhub.in')
  AND raw_user_meta_data ->> 'role' = 'admin';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
            false
        )
    );
END;
$$;

-- 4. Pin search_path (lint 0011). Every body below uses unqualified public
--    tables only. exec_sql runs caller-supplied SQL, so it also keeps
--    extensions on its path to match the role default it ran with before.
ALTER FUNCTION public.exec_sql(text) SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.admin_review_portfolio_item(uuid, uuid, boolean, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_onboarding_category_uniqueness() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_onboarding_item_category_uniqueness() SET search_path = public, pg_temp;
ALTER FUNCTION public.stamp_track_stage_changed() SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_sync_lead_pipeline() SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_stamp_deal_lifecycle() SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_seed_default_stages(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_seed_default_pipelines(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_seed_taxonomy(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_bump_unread(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_last_messages_for_leads(uuid, uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_chat_last_messages(uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_chat_unread_counts(uuid, uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.crm_claim_lead_on_send(uuid, uuid) SET search_path = public, pg_temp;

-- Verification: the first query should return no rows, the second 2 rows.
-- SELECT p.oid::regprocedure FROM pg_proc p
--  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
--    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
--         OR has_function_privilege('authenticated', p.oid, 'EXECUTE'));
-- SELECT email FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin';
--
-- Rollback: GRANT EXECUTE on each function in sections 1-2 TO PUBLIC, anon,
-- authenticated, and restore is_admin() as SECURITY DEFINER reading
-- user_metadata. app_metadata.role can stay.
