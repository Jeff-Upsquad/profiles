-- View for admin global search to surface leads (form submissions) alongside
-- talents and businesses. Mirrors admin_talent_search / admin_business_search.
-- Excludes soft-deleted leads. Includes signed-up leads (those with a linked
-- talent_users row) — they may surface twice in the dropdown (once per group).
-- service_role only — surfaces lead PII.

CREATE OR REPLACE VIEW public.admin_lead_search AS
SELECT
    ls.id,
    ls.name,
    ls.email,
    ls.phone,
    ls.form_type,
    ls.status,
    ls.profile_type,
    ls.auto_approved,
    ls.linked_talent_user_id,
    ls.created_at,
    regexp_replace(COALESCE(ls.phone, ''), '\D', '', 'g') AS phone_digits
FROM public.lead_submissions ls
WHERE ls.deleted_at IS NULL;

REVOKE ALL ON public.admin_lead_search FROM PUBLIC;
GRANT SELECT ON public.admin_lead_search TO service_role;
