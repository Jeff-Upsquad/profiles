-- Bulk lookup of auth.users by email for the SquadHub integration.
-- SECURITY DEFINER so the service-role RPC can read auth.users.
CREATE OR REPLACE FUNCTION public.get_auth_users_by_emails(email_list text[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE lower(au.email) = ANY(email_list);
$$;
