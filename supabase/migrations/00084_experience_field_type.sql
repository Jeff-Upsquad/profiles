-- Migration: 00084_experience_field_type
-- Description: Add 'experience' to the field_type_enum so admins can
-- configure a field that captures both years and months of experience.
-- The value is stored in talent_profiles.field_data as
-- { "years": <int 0-50>, "months": <int 0-11> }.

ALTER TYPE field_type_enum ADD VALUE IF NOT EXISTS 'experience';
