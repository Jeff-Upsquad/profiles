-- Add structured fields for the permanent/official address on talent_profiles_basic.
-- The existing country/state/current_district/city/pin_code columns continue to
-- represent the talent's current address (captured during sign-up).
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS permanent_country TEXT,
  ADD COLUMN IF NOT EXISTS permanent_state TEXT,
  ADD COLUMN IF NOT EXISTS permanent_district TEXT,
  ADD COLUMN IF NOT EXISTS permanent_city TEXT,
  ADD COLUMN IF NOT EXISTS permanent_pin_code TEXT;
