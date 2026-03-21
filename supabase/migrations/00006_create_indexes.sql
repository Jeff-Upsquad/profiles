-- Migration: 00006_create_indexes
-- Description: Create performance indexes for all tables

-- talent_profiles indexes
CREATE INDEX idx_talent_profiles_field_data ON talent_profiles USING GIN (field_data);
CREATE INDEX idx_talent_profiles_status ON talent_profiles (status);
CREATE INDEX idx_talent_profiles_category_id ON talent_profiles (category_id);
CREATE INDEX idx_talent_profiles_talent_user_id ON talent_profiles (talent_user_id);
CREATE INDEX idx_talent_profiles_deleted_at ON talent_profiles (deleted_at);

-- shortlists indexes
CREATE INDEX idx_shortlists_business_user_id ON shortlists (business_user_id);

-- interest_requests indexes
CREATE INDEX idx_interest_requests_business_user_id ON interest_requests (business_user_id);
CREATE INDEX idx_interest_requests_talent_profile_id ON interest_requests (talent_profile_id);

-- categories indexes
CREATE INDEX idx_categories_slug ON categories (slug);
CREATE INDEX idx_categories_is_active ON categories (is_active);

-- category_fields indexes
CREATE INDEX idx_category_fields_category_id ON category_fields (category_id);
CREATE INDEX idx_category_fields_sort_order ON category_fields (sort_order);
