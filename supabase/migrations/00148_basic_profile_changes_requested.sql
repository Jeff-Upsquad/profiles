-- Request-changes state for the basic profile (one common request per talent).
-- Mirrors 00147 (talent_profiles) but lives on talent_profiles_basic, which has
-- no status column — the basic profile is always "live", so openness is
-- derived: changes_requested_at set + reviewed_at null = open;
-- resubmitted_at set = talent resubmitted, awaiting accept.

ALTER TABLE talent_profiles_basic
  -- [{ key, label, section, message, note? }] — the ticked checklist items
  -- (basic.* / identity.*), snapshotted at request time.
  ADD COLUMN IF NOT EXISTS requested_changes JSONB,
  ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changes_requested_by UUID REFERENCES auth.users(id),
  -- Stamped when the talent taps "Resubmit for review" on the basic profile.
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ,
  -- Stamped when the reviewer accepts the resubmitted basic-profile updates.
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  -- Whether the CRM confirmed a WhatsApp send for the request (null = not attempted).
  ADD COLUMN IF NOT EXISTS changes_whatsapp_sent BOOLEAN;

COMMENT ON COLUMN talent_profiles_basic.requested_changes IS
  'Checklist items the reviewer asked the talent to fix on the basic profile. Kept after resubmit/accept as history.';

CREATE INDEX IF NOT EXISTS idx_talent_basic_open_change_request
  ON talent_profiles_basic (talent_user_id)
  WHERE changes_requested_at IS NOT NULL AND reviewed_at IS NULL;
