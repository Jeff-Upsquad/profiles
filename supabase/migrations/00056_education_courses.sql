-- Migration: 00056_education_courses
-- Description: Add education_courses JSONB column to talent_profiles_basic
--              for storing an array of education/course entries.

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS education_courses JSONB;
