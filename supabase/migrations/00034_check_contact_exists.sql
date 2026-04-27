-- Public read-only function: checks whether an email or phone is already
-- present as a talent user, business user, or prior lead submission.
-- SECURITY DEFINER so it can read auth.users from the anon role.
CREATE OR REPLACE FUNCTION public.check_contact_exists(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL  -- 10-digit phone, no country code
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
