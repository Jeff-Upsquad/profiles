-- Migration: 00005_create_business_tables
-- Description: Create shortlists and interest_requests tables

CREATE TABLE shortlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    talent_profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_user_id, talent_profile_id)
);

CREATE TABLE interest_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    talent_profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    message TEXT,
    status interest_status_enum NOT NULL DEFAULT 'pending',
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apply updated_at trigger
CREATE TRIGGER set_interest_requests_updated_at
    BEFORE UPDATE ON interest_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE interest_requests ENABLE ROW LEVEL SECURITY;
