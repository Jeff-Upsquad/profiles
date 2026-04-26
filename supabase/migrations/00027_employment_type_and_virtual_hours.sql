-- Migration: 00027_employment_type_and_virtual_hours
-- Description: Add employment_type and virtual_office_hours columns to
--              talent_profiles_basic to support the split signup step
--              (salary-based vs freelance / SquadHub partner program).

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS employment_type TEXT[],
  ADD COLUMN IF NOT EXISTS virtual_office_hours JSONB;

COMMENT ON COLUMN talent_profiles_basic.employment_type IS
  'Subset of {salary, freelance}';
COMMENT ON COLUMN talent_profiles_basic.virtual_office_hours IS
  'Array of {day, from, to} for freelance candidates';
