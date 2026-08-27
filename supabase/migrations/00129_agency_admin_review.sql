-- Migration: 00129_agency_admin_review
-- Add review/approval workflow columns for agencies, expand duplicate detection, register agencies module

ALTER TABLE agency_users
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_reason TEXT;

-- Ensure approval_status is properly constrained if not already
-- (kept as TEXT to avoid enum migration complexity)
CREATE INDEX IF NOT EXISTS idx_agency_users_approval_status ON agency_users(approval_status);
CREATE INDEX IF NOT EXISTS idx_agency_users_email ON agency_users(lower(email));
CREATE INDEX IF NOT EXISTS idx_agency_users_created_at ON agency_users(created_at DESC);

-- Extend check_contact_exists to include agency_users + agency_squad_members
CREATE OR REPLACE FUNCTION public.check_contact_exists(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL
)
RETURNS TABLE (source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'talent'::text
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.talent_users tu ON tu.id = u.id
      WHERE lower(u.email) = lower(p_email)
    )
  UNION ALL
  SELECT 'talent'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.talent_users
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'business'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE lower(contact_email) = lower(p_email)
    )
  UNION ALL
  SELECT 'business'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE right(contact_phone_normalized, 10) = p_phone_digits
         OR right(regexp_replace(contact_phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'agency'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.agency_users
      WHERE lower(email) = lower(p_email)
         OR lower(contact_email) = lower(p_email)
    )
  UNION ALL
  SELECT 'agency'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.agency_users
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
         OR right(regexp_replace(whatsapp_number, '[^0-9]', '', 'g'), 10) = p_phone_digits
         OR right(regexp_replace(contact_email, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'auth'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_contact_exists(text, text) TO anon, authenticated, service_role;

-- More detailed duplicate diagnostics for admin: returns all sources with matching records
CREATE OR REPLACE FUNCTION public.check_contact_exists_detailed(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL
)
RETURNS TABLE (source text, matched_field text, record_id text, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'talent'::text, 'email'::text, u.id::text, tu.full_name
  FROM auth.users u JOIN public.talent_users tu ON tu.id = u.id
  WHERE p_email IS NOT NULL AND length(p_email) > 0 AND lower(u.email) = lower(p_email)
  UNION ALL
  SELECT 'talent', 'phone', tu.id::text, tu.full_name
  FROM public.talent_users tu
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits)=10
    AND right(regexp_replace(tu.phone, '[^0-9]', '', 'g'),10)=p_phone_digits
  UNION ALL
  SELECT 'business', 'email', bu.id::text, bu.company_name
  FROM public.business_users bu
  WHERE p_email IS NOT NULL AND length(p_email)>0 AND lower(bu.contact_email)=lower(p_email)
  UNION ALL
  SELECT 'business', 'phone', bu.id::text, bu.company_name
  FROM public.business_users bu
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits)=10
    AND ( right(contact_phone_normalized,10)=p_phone_digits OR right(regexp_replace(contact_phone,'[^0-9]','','g'),10)=p_phone_digits )
  UNION ALL
  SELECT 'agency', 'email', au.id::text, au.agency_name
  FROM public.agency_users au
  WHERE p_email IS NOT NULL AND length(p_email)>0 AND ( lower(au.email)=lower(p_email) OR lower(au.contact_email)=lower(p_email) )
  UNION ALL
  SELECT 'agency', 'phone', au.id::text, au.agency_name
  FROM public.agency_users au
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits)=10
    AND ( right(regexp_replace(au.phone,'[^0-9]','','g'),10)=p_phone_digits OR right(regexp_replace(au.whatsapp_number,'[^0-9]','','g'),10)=p_phone_digits )
  UNION ALL
  SELECT 'lead', 'email', ls.id::text, ls.name
  FROM public.lead_submissions ls
  WHERE p_email IS NOT NULL AND length(p_email)>0 AND lower(ls.email)=lower(p_email)
  UNION ALL
  SELECT 'lead', 'phone', ls.id::text, ls.name
  FROM public.lead_submissions ls
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits)=10 AND right(regexp_replace(ls.phone,'[^0-9]','','g'),10)=p_phone_digits
  UNION ALL
  SELECT 'auth', 'email', u.id::text, coalesce(u.email, 'auth user')
  FROM auth.users u
  WHERE p_email IS NOT NULL AND length(p_email)>0 AND lower(u.email)=lower(p_email)
    AND NOT EXISTS (SELECT 1 FROM public.talent_users tu WHERE tu.id=u.id)
    AND NOT EXISTS (SELECT 1 FROM public.agency_users au WHERE au.id=u.id)
    AND NOT EXISTS (SELECT 1 FROM public.business_users bu WHERE bu.id=u.id)
$$;

GRANT EXECUTE ON FUNCTION public.check_contact_exists_detailed(text, text) TO authenticated, service_role;

-- Register agencies module in admin_modules
INSERT INTO admin_modules (slug, name, section, sort) VALUES
  ('agencies', 'Agencies', 'Talent', 35)
ON CONFLICT (slug) DO NOTHING;
