-- Migration: 00017_lead_status_overhaul
-- Description: New lead status flow (under_review, shortlisted, partner_onboarding,
--              onboard_completed, archived), archive reason/notes, profile type tagging.

-- 1. Add new status enum values (enum values cannot be removed; old ones stay for legacy rows)
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'shortlisted';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'partner_onboarding';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'onboard_completed';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'archived';

-- 2. Archive reason + profile type fields
ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_type TEXT,
  ADD COLUMN IF NOT EXISTS profile_type_custom TEXT;

-- profile_type constrained to known values (or NULL)
ALTER TABLE lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_profile_type_check;
ALTER TABLE lead_submissions
  ADD CONSTRAINT lead_submissions_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN ('junior', 'pro', 'elite', 'custom'));
