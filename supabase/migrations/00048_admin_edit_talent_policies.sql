-- Migration: 00048_admin_edit_talent_policies
-- Description: Allow admins to UPDATE talent_users and write to portfolio_items.
-- Backend services use the service role and bypass RLS, so these policies are
-- defense-in-depth for any future code path that uses an anon-key Supabase
-- client with an admin JWT.

-- ============================================================
-- talent_users: admin UPDATE
-- ============================================================

DROP POLICY IF EXISTS talent_users_update_admin ON talent_users;

CREATE POLICY talent_users_update_admin ON talent_users
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- portfolio_items: admin ALL
-- ============================================================

DROP POLICY IF EXISTS portfolio_items_admin_all ON portfolio_items;

CREATE POLICY portfolio_items_admin_all ON portfolio_items
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin());
