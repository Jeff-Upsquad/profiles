-- ============================================================
-- Soft-delete support for lead_submissions
--
-- Mirrors the talent_profiles soft-delete pattern: a nullable
-- deleted_at timestamp lets admins move candidates to a recycle
-- view, restore them, or permanently delete them.
-- ============================================================

ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lead_submissions_deleted_at
  ON lead_submissions (deleted_at);
