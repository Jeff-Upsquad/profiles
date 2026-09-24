-- Record who paused a job profile, so admins can tell a talent self-pause
-- from an admin pause. Cleared when the profile is reactivated.
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_by_role text
    CHECK (paused_by_role IN ('talent', 'admin', 'staff')),
  ADD COLUMN IF NOT EXISTS paused_by_id uuid,
  ADD COLUMN IF NOT EXISTS paused_by_name text;
