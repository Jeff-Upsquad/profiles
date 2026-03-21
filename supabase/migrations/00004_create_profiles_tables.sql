-- Migration: 00004_create_profiles_tables
-- Description: Create talent_profiles table

CREATE TABLE talent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    status profile_status_enum NOT NULL DEFAULT 'draft',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    field_data JSONB DEFAULT '{}',
    resume_url TEXT,
    is_active BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partial unique index: one profile per category per talent (excluding soft-deleted)
CREATE UNIQUE INDEX uq_talent_profiles_user_category
    ON talent_profiles (talent_user_id, category_id)
    WHERE deleted_at IS NULL;

-- Apply updated_at trigger
CREATE TRIGGER set_talent_profiles_updated_at
    BEFORE UPDATE ON talent_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE talent_profiles ENABLE ROW LEVEL SECURITY;
