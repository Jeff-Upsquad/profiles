-- Migration: 00007_create_rls_policies
-- Description: Create Row Level Security policies for all tables

-- Helper: check if the current user has the 'admin' role in raw_user_meta_data
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
            false
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- talent_users policies
-- ============================================================

-- Users can read their own row
CREATE POLICY talent_users_select_own ON talent_users
    FOR SELECT USING (auth.uid() = id);

-- Admins can read all rows
CREATE POLICY talent_users_select_admin ON talent_users
    FOR SELECT USING (is_admin());

-- Users can update their own row
CREATE POLICY talent_users_update_own ON talent_users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own row
CREATE POLICY talent_users_insert_own ON talent_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- business_users policies
-- ============================================================

-- Users can read their own row
CREATE POLICY business_users_select_own ON business_users
    FOR SELECT USING (auth.uid() = id);

-- Admins can read all rows
CREATE POLICY business_users_select_admin ON business_users
    FOR SELECT USING (is_admin());

-- Users can update their own row
CREATE POLICY business_users_update_own ON business_users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own row
CREATE POLICY business_users_insert_own ON business_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- categories policies
-- ============================================================

-- Everyone can read active categories
CREATE POLICY categories_select_active ON categories
    FOR SELECT USING (is_active = true);

-- Admins can read all (including inactive)
CREATE POLICY categories_select_admin ON categories
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY categories_insert_admin ON categories
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY categories_update_admin ON categories
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY categories_delete_admin ON categories
    FOR DELETE USING (is_admin());

-- ============================================================
-- category_fields policies
-- ============================================================

-- Everyone can read active fields
CREATE POLICY category_fields_select_active ON category_fields
    FOR SELECT USING (is_active = true);

-- Admins can read all
CREATE POLICY category_fields_select_admin ON category_fields
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY category_fields_insert_admin ON category_fields
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY category_fields_update_admin ON category_fields
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY category_fields_delete_admin ON category_fields
    FOR DELETE USING (is_admin());

-- ============================================================
-- field_options policies
-- ============================================================

-- Everyone can read active options
CREATE POLICY field_options_select_active ON field_options
    FOR SELECT USING (is_active = true);

-- Admins can read all
CREATE POLICY field_options_select_admin ON field_options
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY field_options_insert_admin ON field_options
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY field_options_update_admin ON field_options
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY field_options_delete_admin ON field_options
    FOR DELETE USING (is_admin());

-- ============================================================
-- talent_profiles policies
-- ============================================================

-- Talent can read their own profiles
CREATE POLICY talent_profiles_select_own ON talent_profiles
    FOR SELECT USING (auth.uid() = talent_user_id);

-- Business users can read approved profiles only
CREATE POLICY talent_profiles_select_business ON talent_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM business_users WHERE id = auth.uid()
        )
        AND status = 'approved'
        AND deleted_at IS NULL
    );

-- Admins can read all profiles
CREATE POLICY talent_profiles_select_admin ON talent_profiles
    FOR SELECT USING (is_admin());

-- Talent can insert their own profiles
CREATE POLICY talent_profiles_insert_own ON talent_profiles
    FOR INSERT WITH CHECK (auth.uid() = talent_user_id);

-- Talent can update their own profiles
CREATE POLICY talent_profiles_update_own ON talent_profiles
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (auth.uid() = talent_user_id);

-- Admins can update all profiles (for review/approve/reject)
CREATE POLICY talent_profiles_update_admin ON talent_profiles
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Talent can delete (soft-delete) their own profiles
CREATE POLICY talent_profiles_delete_own ON talent_profiles
    FOR DELETE USING (auth.uid() = talent_user_id);

-- ============================================================
-- shortlists policies
-- ============================================================

-- Business can read their own shortlists
CREATE POLICY shortlists_select_own ON shortlists
    FOR SELECT USING (auth.uid() = business_user_id);

-- Admins can read all shortlists
CREATE POLICY shortlists_select_admin ON shortlists
    FOR SELECT USING (is_admin());

-- Business can insert their own shortlists
CREATE POLICY shortlists_insert_own ON shortlists
    FOR INSERT WITH CHECK (auth.uid() = business_user_id);

-- Business can delete their own shortlists
CREATE POLICY shortlists_delete_own ON shortlists
    FOR DELETE USING (auth.uid() = business_user_id);

-- ============================================================
-- interest_requests policies
-- ============================================================

-- Business can read their own interest requests
CREATE POLICY interest_requests_select_own ON interest_requests
    FOR SELECT USING (auth.uid() = business_user_id);

-- Talent can read interest requests where their profile is referenced
CREATE POLICY interest_requests_select_talent ON interest_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM talent_profiles
            WHERE talent_profiles.id = interest_requests.talent_profile_id
            AND talent_profiles.talent_user_id = auth.uid()
        )
    );

-- Admins can read all interest requests
CREATE POLICY interest_requests_select_admin ON interest_requests
    FOR SELECT USING (is_admin());

-- Business can insert their own interest requests
CREATE POLICY interest_requests_insert_own ON interest_requests
    FOR INSERT WITH CHECK (auth.uid() = business_user_id);

-- Business can update their own interest requests
CREATE POLICY interest_requests_update_own ON interest_requests
    FOR UPDATE USING (auth.uid() = business_user_id)
    WITH CHECK (auth.uid() = business_user_id);

-- Business can delete their own interest requests
CREATE POLICY interest_requests_delete_own ON interest_requests
    FOR DELETE USING (auth.uid() = business_user_id);
