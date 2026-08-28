-- Migration: 00131_agency_skills_tools
-- Adds skills/tools/industry experience JSONB columns to agency_profiles
-- Mirrors talent profile DesignerExtras data shape

ALTER TABLE agency_profiles
  ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tools JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_tools JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS industry_experience JSONB DEFAULT '[]'::jsonb;

-- Ensure existing rows have arrays
UPDATE agency_profiles SET skills = '[]'::jsonb WHERE skills IS NULL;
UPDATE agency_profiles SET tools = '[]'::jsonb WHERE tools IS NULL;
UPDATE agency_profiles SET ai_tools = '[]'::jsonb WHERE ai_tools IS NULL;
UPDATE agency_profiles SET categories = '[]'::jsonb WHERE categories IS NULL;
UPDATE agency_profiles SET industry_experience = '[]'::jsonb WHERE industry_experience IS NULL;
