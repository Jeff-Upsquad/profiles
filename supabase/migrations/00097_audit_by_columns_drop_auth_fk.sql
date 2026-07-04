-- =============================================================================
-- 00097_audit_by_columns_drop_auth_fk.sql
-- Staff users (staff_users, custom JWT — see 00091) are NOT auth.users. Older
-- audit-stamp columns still FK-reference auth.users(id), so when a staff user
-- performs the action their staff id fails the constraint, e.g.:
--   insert or update on "talent_profiles" violates foreign key constraint
--   "talent_profiles_reviewed_by_fkey"
--
-- These *_by columns are attribution stamps, not relational joins. Newer tables
-- (course_reopen_requests, interview_invitations, lead_submissions) already
-- store them as plain UUIDs with no FK. This brings the older columns in line so
-- both full admins (auth.users id) and staff (staff_users id) can be stamped.
--
-- The columns stay nullable UUID; only the auth.users FK is removed. Existing
-- data is untouched.
-- =============================================================================

ALTER TABLE talent_profiles DROP CONSTRAINT IF EXISTS talent_profiles_reviewed_by_fkey;
ALTER TABLE talent_users    DROP CONSTRAINT IF EXISTS talent_users_approved_by_fkey;
ALTER TABLE talent_users    DROP CONSTRAINT IF EXISTS talent_users_skip_onboarding_by_fkey;
ALTER TABLE admin_settings  DROP CONSTRAINT IF EXISTS admin_settings_updated_by_fkey;
ALTER TABLE notifications   DROP CONSTRAINT IF EXISTS notifications_created_by_fkey;
