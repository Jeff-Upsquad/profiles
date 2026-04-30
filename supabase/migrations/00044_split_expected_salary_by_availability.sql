-- Split expected monthly salary into separate full-time and part-time
-- columns. The legacy expected_salary_monthly column is kept untouched so
-- historical data remains queryable; new writes go to the split columns.
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS expected_salary_full_time INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_part_time INTEGER;
