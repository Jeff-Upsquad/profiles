-- Migration: 00001_create_enums
-- Description: Create all enum types for SquadHire talent marketplace

CREATE TYPE user_role AS ENUM ('talent', 'business', 'admin');

CREATE TYPE profile_status_enum AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'inactive', 'deleted');

CREATE TYPE field_type_enum AS ENUM ('text', 'textarea', 'number', 'currency', 'email', 'phone', 'select', 'multi_select', 'file_upload', 'date');

CREATE TYPE interest_status_enum AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

CREATE TYPE company_size_type AS ENUM ('1-10', '11-50', '51-200', '201-500', '500+');

CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Trigger function to automatically update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
