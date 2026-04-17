-- Add country + state columns to talent_profiles_basic for the signup wizard's
-- Contact Details step pickers. current_district already exists.
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS state TEXT;
