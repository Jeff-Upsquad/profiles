-- Migration: 00130_agency_languages
-- Adds languages array to agency_profiles for requirement-card matching
-- (category + language + location). Dropdown → chip UI in Agency Profile
-- stores plain language names as TEXT[] (e.g. '{English,Hindi}').
-- Also backfills a GIN index for future matcher queries.

ALTER TABLE agency_profiles
  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_agency_profiles_languages
  ON agency_profiles USING GIN (languages);

-- Optional: ensure existing rows have empty array not null
UPDATE agency_profiles SET languages = '{}' WHERE languages IS NULL;
