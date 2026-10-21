-- Login-activity lookup for the admin dashboard: last sign-in per auth user.
-- Mirrors get_auth_users_by_ids (00068): SECURITY DEFINER so the service-role
-- RPC can read auth.users. Locked to service_role like the 20261001 lockdown.
-- Powers the dashboard "Active users (logged into the platform)" figures; the
-- backend degrades to app-install activity until this is applied.
CREATE OR REPLACE FUNCTION public.get_auth_user_signins(id_list uuid[])
RETURNS TABLE(id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.last_sign_in_at
  FROM auth.users au
  WHERE au.id = ANY(id_list);
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_signins(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_signins(uuid[]) TO service_role;
