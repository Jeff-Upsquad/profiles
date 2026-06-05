-- Migration: 00083_experience
-- Description: Add experience JSONB column to talent_profiles_basic
--              for storing an array of work experience entries.
--              Mirrors the education_courses column (migration 00056).

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS experience JSONB;
