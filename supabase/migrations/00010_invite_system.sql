-- Migration: 00010_invite_system
-- Description: Invite-only system with business passwordless auth, category subscriptions, and profile sharing

-- ============================================================
-- New enum for invitation status
-- ============================================================

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- ============================================================
-- Invitations table
-- ============================================================

CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role user_role NOT NULL CHECK (role IN ('talent', 'business')),
    status invitation_status NOT NULL DEFAULT 'pending',
    company_name TEXT,
    contact_person_name TEXT,
    expires_at TIMESTAMPTZ,
    invited_by UUID NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one pending invitation per email
CREATE UNIQUE INDEX invitations_email_pending ON invitations(email) WHERE status = 'pending';

CREATE TRIGGER set_invitations_updated_at
    BEFORE UPDATE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Alter business_users: drop auth.users FK, add new columns
-- ============================================================

-- Drop the FK constraint to auth.users (new business users won't have Supabase auth records)
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_id_fkey;
ALTER TABLE business_users DROP CONSTRAINT IF EXISTS business_users_pkey CASCADE;
ALTER TABLE business_users ADD PRIMARY KEY (id);

-- Re-add FKs from shortlists and interest_requests to business_users
-- (they may have been dropped by CASCADE above)
ALTER TABLE shortlists
    ADD CONSTRAINT shortlists_business_user_id_fkey
    FOREIGN KEY (business_user_id) REFERENCES business_users(id) ON DELETE CASCADE;

ALTER TABLE interest_requests
    ADD CONSTRAINT interest_requests_business_user_id_fkey
    FOREIGN KEY (business_user_id) REFERENCES business_users(id) ON DELETE CASCADE;

-- Add new columns
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES invitations(id);
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================================
-- Business sessions (custom passwordless auth)
-- ============================================================

CREATE TABLE business_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX business_sessions_token_idx ON business_sessions(token);

-- ============================================================
-- Business category subscriptions
-- ============================================================

CREATE TABLE business_category_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_user_id, category_id)
);

-- ============================================================
-- Business shared profiles
-- ============================================================

CREATE TABLE business_shared_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    talent_profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(business_user_id, talent_profile_id)
);

-- ============================================================
-- Drop stale RLS policies that reference auth.uid() for business
-- (all business access goes through supabaseAdmin which bypasses RLS)
-- ============================================================

DROP POLICY IF EXISTS business_users_select_own ON business_users;
DROP POLICY IF EXISTS business_users_update_own ON business_users;
DROP POLICY IF EXISTS business_users_insert_own ON business_users;

DROP POLICY IF EXISTS shortlists_select_own ON shortlists;
DROP POLICY IF EXISTS shortlists_insert_own ON shortlists;
DROP POLICY IF EXISTS shortlists_delete_own ON shortlists;

DROP POLICY IF EXISTS interest_requests_select_own ON interest_requests;
DROP POLICY IF EXISTS interest_requests_insert_own ON interest_requests;
DROP POLICY IF EXISTS interest_requests_update_own ON interest_requests;
DROP POLICY IF EXISTS interest_requests_delete_own ON interest_requests;

DROP POLICY IF EXISTS talent_profiles_select_business ON talent_profiles;

-- ============================================================
-- Enable RLS on new tables (access via supabaseAdmin only)
-- ============================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_category_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_shared_profiles ENABLE ROW LEVEL SECURITY;

-- Admin policies for new tables
CREATE POLICY invitations_admin ON invitations FOR ALL USING (is_admin());
CREATE POLICY business_sessions_admin ON business_sessions FOR ALL USING (is_admin());
CREATE POLICY business_category_subscriptions_admin ON business_category_subscriptions FOR ALL USING (is_admin());
CREATE POLICY business_shared_profiles_admin ON business_shared_profiles FOR ALL USING (is_admin());
