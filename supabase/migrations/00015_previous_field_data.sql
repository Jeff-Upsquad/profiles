-- Add previous_field_data to track what changed between reviews
ALTER TABLE talent_profiles ADD COLUMN previous_field_data JSONB DEFAULT NULL;
