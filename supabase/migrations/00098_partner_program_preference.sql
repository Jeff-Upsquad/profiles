-- Migration: 00098_partner_program_preference
-- Description: Add daily_available_hours and freelance_available columns to
--              talent_profiles_basic for the new "Partner Program Preference"
--              section (per-day committed hours) and the simplified "Freelance
--              Preference" checkbox. The existing virtual_office_hours column
--              (00027) is reused for the partner-program office-hour windows.

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS daily_available_hours JSONB,
  ADD COLUMN IF NOT EXISTS freelance_available BOOLEAN DEFAULT false;

COMMENT ON COLUMN talent_profiles_basic.daily_available_hours IS
  'Array of {day, hours} — per-day committed hours for UpSquad Partner Program candidates';
COMMENT ON COLUMN talent_profiles_basic.freelance_available IS
  'Freelance Preference checkbox — talent affirms availability to take freelance work';
