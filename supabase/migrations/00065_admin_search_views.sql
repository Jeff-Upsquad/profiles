-- Views for admin global search.
-- - admin_talent_search: joins auth.users.email and exposes digit-only phone for normalized matching
-- - admin_business_search: exposes digit-only contact_phone for normalized matching
-- service_role only — these views surface auth.users.email and must not be exposed to anon/authenticated.

CREATE OR REPLACE VIEW public.admin_talent_search AS
SELECT
    tu.id,
    tu.full_name,
    tu.phone,
    tu.current_location,
    tu.profile_photo_url,
    tu.is_active,
    tu.created_at,
    regexp_replace(COALESCE(tu.phone, ''), '\D', '', 'g') AS phone_digits,
    au.email
FROM public.talent_users tu
LEFT JOIN auth.users au ON au.id = tu.id;

REVOKE ALL ON public.admin_talent_search FROM PUBLIC;
GRANT SELECT ON public.admin_talent_search TO service_role;

CREATE OR REPLACE VIEW public.admin_business_search AS
SELECT
    bu.id,
    bu.company_name,
    bu.contact_person_name,
    bu.contact_email,
    bu.contact_phone,
    bu.created_at,
    regexp_replace(COALESCE(bu.contact_phone, ''), '\D', '', 'g') AS contact_phone_digits
FROM public.business_users bu;

REVOKE ALL ON public.admin_business_search FROM PUBLIC;
GRANT SELECT ON public.admin_business_search TO service_role;
