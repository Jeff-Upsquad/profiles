-- Admin-controlled visibility flag on talent_users.
-- Independent of approval_status (vetting workflow) and Supabase auth ban_duration (login).
-- A talent_user is publicly browseable iff is_active = true.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_talent_users_is_active
  ON talent_users (id) WHERE is_active = true;

-- Tighten the business-user RLS policy on talent_profiles so it also excludes
-- inactive profiles AND inactive talents. The original policy only checked
-- status='approved' AND deleted_at IS NULL, missing both is_active gates.

DROP POLICY IF EXISTS talent_profiles_select_business ON talent_profiles;

CREATE POLICY talent_profiles_select_business ON talent_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid())
    AND status = 'approved'
    AND is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM talent_users tu
      WHERE tu.id = talent_profiles.talent_user_id
        AND tu.is_active = true
    )
  );
