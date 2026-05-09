-- Bulk lookup of auth.users by id for the SquadHub integration.
-- Mirror of get_auth_users_by_emails (00064) but reversed — used so SquadHub
-- can resolve a talent_user_id back to the email it was registered with,
-- then match against its own users table.
-- SECURITY DEFINER so the service-role RPC can read auth.users.
CREATE OR REPLACE FUNCTION public.get_auth_users_by_ids(id_list uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(id_list);
$$;
