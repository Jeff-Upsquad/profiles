-- Migration: 00113_talent_date_of_birth
-- Description: Add date_of_birth to talent_users. Going forward the talent's
-- Basic Profile collects a date of birth instead of a raw age; age is derived
-- as completed years (years only, never months) at write time and kept in the
-- existing talent_users.age column, so every read/display site that already
-- shows age keeps working with no change.

ALTER TABLE talent_users
  ADD COLUMN date_of_birth DATE;

COMMENT ON COLUMN talent_users.date_of_birth IS
  'Talent date of birth. Source of truth for age; talent_users.age is derived '
  '(completed years) from this at write time. May be NULL for older accounts '
  'whose age was captured directly or backfilled from the application form.';
