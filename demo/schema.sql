-- SquadHire DEMO schema — all migrations concatenated in order.
-- Generated for a FRESH demo Supabase project. Paste into the SQL editor,
-- or prefer: supabase link --project-ref <ref> && supabase db push
-- Generated Wed Jun 17 22:07:48 IST 2026


-- ============================================================
-- 00001_create_enums.sql
-- ============================================================
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


-- ============================================================
-- 00002_create_users_tables.sql
-- ============================================================
-- Migration: 00002_create_users_tables
-- Description: Create talent_users and business_users tables

CREATE TABLE talent_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    gender gender_type,
    native_place TEXT,
    preferred_districts TEXT[],
    current_location TEXT,
    languages_spoken TEXT[],
    profile_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE business_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_website TEXT,
    industry TEXT,
    company_size company_size_type,
    contact_person_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    company_logo_url TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apply updated_at triggers
CREATE TRIGGER set_talent_users_updated_at
    BEFORE UPDATE ON talent_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_business_users_updated_at
    BEFORE UPDATE ON business_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE talent_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 00003_create_categories_tables.sql
-- ============================================================
-- Migration: 00003_create_categories_tables
-- Description: Create categories, category_fields, and field_options tables

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE category_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    field_label TEXT NOT NULL,
    field_type field_type_enum NOT NULL,
    is_required BOOLEAN DEFAULT false,
    placeholder TEXT,
    helper_text TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    validation_rules JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(category_id, field_key)
);

CREATE TABLE field_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES category_fields(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(field_id, value)
);

-- Apply updated_at triggers
CREATE TRIGGER set_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_category_fields_updated_at
    BEFORE UPDATE ON category_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_field_options_updated_at
    BEFORE UPDATE ON field_options
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_options ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 00004_create_profiles_tables.sql
-- ============================================================
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


-- ============================================================
-- 00005_create_business_tables.sql
-- ============================================================
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


-- ============================================================
-- 00006_create_indexes.sql
-- ============================================================
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


-- ============================================================
-- 00007_create_rls_policies.sql
-- ============================================================
-- Migration: 00007_create_rls_policies
-- Description: Create Row Level Security policies for all tables

-- Helper: check if the current user has the 'admin' role in raw_user_meta_data
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin',
            false
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- talent_users policies
-- ============================================================

-- Users can read their own row
CREATE POLICY talent_users_select_own ON talent_users
    FOR SELECT USING (auth.uid() = id);

-- Admins can read all rows
CREATE POLICY talent_users_select_admin ON talent_users
    FOR SELECT USING (is_admin());

-- Users can update their own row
CREATE POLICY talent_users_update_own ON talent_users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own row
CREATE POLICY talent_users_insert_own ON talent_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- business_users policies
-- ============================================================

-- Users can read their own row
CREATE POLICY business_users_select_own ON business_users
    FOR SELECT USING (auth.uid() = id);

-- Admins can read all rows
CREATE POLICY business_users_select_admin ON business_users
    FOR SELECT USING (is_admin());

-- Users can update their own row
CREATE POLICY business_users_update_own ON business_users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own row
CREATE POLICY business_users_insert_own ON business_users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- categories policies
-- ============================================================

-- Everyone can read active categories
CREATE POLICY categories_select_active ON categories
    FOR SELECT USING (is_active = true);

-- Admins can read all (including inactive)
CREATE POLICY categories_select_admin ON categories
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY categories_insert_admin ON categories
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY categories_update_admin ON categories
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY categories_delete_admin ON categories
    FOR DELETE USING (is_admin());

-- ============================================================
-- category_fields policies
-- ============================================================

-- Everyone can read active fields
CREATE POLICY category_fields_select_active ON category_fields
    FOR SELECT USING (is_active = true);

-- Admins can read all
CREATE POLICY category_fields_select_admin ON category_fields
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY category_fields_insert_admin ON category_fields
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY category_fields_update_admin ON category_fields
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY category_fields_delete_admin ON category_fields
    FOR DELETE USING (is_admin());

-- ============================================================
-- field_options policies
-- ============================================================

-- Everyone can read active options
CREATE POLICY field_options_select_active ON field_options
    FOR SELECT USING (is_active = true);

-- Admins can read all
CREATE POLICY field_options_select_admin ON field_options
    FOR SELECT USING (is_admin());

-- Admins can insert
CREATE POLICY field_options_insert_admin ON field_options
    FOR INSERT WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY field_options_update_admin ON field_options
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Admins can delete
CREATE POLICY field_options_delete_admin ON field_options
    FOR DELETE USING (is_admin());

-- ============================================================
-- talent_profiles policies
-- ============================================================

-- Talent can read their own profiles
CREATE POLICY talent_profiles_select_own ON talent_profiles
    FOR SELECT USING (auth.uid() = talent_user_id);

-- Business users can read approved profiles only
CREATE POLICY talent_profiles_select_business ON talent_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM business_users WHERE id = auth.uid()
        )
        AND status = 'approved'
        AND deleted_at IS NULL
    );

-- Admins can read all profiles
CREATE POLICY talent_profiles_select_admin ON talent_profiles
    FOR SELECT USING (is_admin());

-- Talent can insert their own profiles
CREATE POLICY talent_profiles_insert_own ON talent_profiles
    FOR INSERT WITH CHECK (auth.uid() = talent_user_id);

-- Talent can update their own profiles
CREATE POLICY talent_profiles_update_own ON talent_profiles
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (auth.uid() = talent_user_id);

-- Admins can update all profiles (for review/approve/reject)
CREATE POLICY talent_profiles_update_admin ON talent_profiles
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- Talent can delete (soft-delete) their own profiles
CREATE POLICY talent_profiles_delete_own ON talent_profiles
    FOR DELETE USING (auth.uid() = talent_user_id);

-- ============================================================
-- shortlists policies
-- ============================================================

-- Business can read their own shortlists
CREATE POLICY shortlists_select_own ON shortlists
    FOR SELECT USING (auth.uid() = business_user_id);

-- Admins can read all shortlists
CREATE POLICY shortlists_select_admin ON shortlists
    FOR SELECT USING (is_admin());

-- Business can insert their own shortlists
CREATE POLICY shortlists_insert_own ON shortlists
    FOR INSERT WITH CHECK (auth.uid() = business_user_id);

-- Business can delete their own shortlists
CREATE POLICY shortlists_delete_own ON shortlists
    FOR DELETE USING (auth.uid() = business_user_id);

-- ============================================================
-- interest_requests policies
-- ============================================================

-- Business can read their own interest requests
CREATE POLICY interest_requests_select_own ON interest_requests
    FOR SELECT USING (auth.uid() = business_user_id);

-- Talent can read interest requests where their profile is referenced
CREATE POLICY interest_requests_select_talent ON interest_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM talent_profiles
            WHERE talent_profiles.id = interest_requests.talent_profile_id
            AND talent_profiles.talent_user_id = auth.uid()
        )
    );

-- Admins can read all interest requests
CREATE POLICY interest_requests_select_admin ON interest_requests
    FOR SELECT USING (is_admin());

-- Business can insert their own interest requests
CREATE POLICY interest_requests_insert_own ON interest_requests
    FOR INSERT WITH CHECK (auth.uid() = business_user_id);

-- Business can update their own interest requests
CREATE POLICY interest_requests_update_own ON interest_requests
    FOR UPDATE USING (auth.uid() = business_user_id)
    WITH CHECK (auth.uid() = business_user_id);

-- Business can delete their own interest requests
CREATE POLICY interest_requests_delete_own ON interest_requests
    FOR DELETE USING (auth.uid() = business_user_id);


-- ============================================================
-- 00008_approval_basic_profile_template_skills.sql
-- ============================================================
-- Migration: 00008_approval_basic_profile_template_skills
-- Description: Add approval workflow, basic profile table, template skills/tools tables.
--              Also drops preferred_districts from talent_users.

-- =========================================================================
-- Change 1: Drop preferred_districts column
-- =========================================================================

ALTER TABLE talent_users DROP COLUMN IF EXISTS preferred_districts;

-- =========================================================================
-- Change 2: Approval workflow columns on talent_users
-- =========================================================================

-- Create enum for approval status
DO $$ BEGIN
  CREATE TYPE approval_status_enum AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS approval_status approval_status_enum NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_talent_users_approval_status ON talent_users (approval_status);

-- =========================================================================
-- Change 3: Basic profile table
-- =========================================================================

CREATE TABLE IF NOT EXISTS talent_profiles_basic (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id UUID NOT NULL UNIQUE REFERENCES talent_users(id) ON DELETE CASCADE,

  -- Section 2: Contact Details
  permanent_address TEXT,
  current_address TEXT,
  current_district TEXT,
  city TEXT,
  pin_code TEXT,

  -- Section 3: Job Preferences (stored as text arrays)
  availability TEXT[],          -- e.g. {'full_time','part_time'}
  job_type TEXT[],              -- e.g. {'remote','office','hybrid','field'}

  -- Section 4: ID Proofs
  aadhaar_number TEXT,
  aadhaar_file_url TEXT,
  pan_number TEXT,
  pan_file_url TEXT,

  -- Section 5: Profile Picture
  profile_picture_url TEXT,

  -- Section 6: Bank Account Details
  bank_account_holder TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_ifsc_code TEXT,
  bank_branch_name TEXT,

  -- Section 7: Resume
  resume_url TEXT,

  -- Section 8: Expected Salary
  expected_salary_monthly INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_talent_profiles_basic_updated_at
  BEFORE UPDATE ON talent_profiles_basic
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE talent_profiles_basic ENABLE ROW LEVEL SECURITY;

-- RLS policies for talent_profiles_basic
CREATE POLICY "Talent users can read own basic profile"
  ON talent_profiles_basic FOR SELECT
  USING (talent_user_id = auth.uid());

CREATE POLICY "Talent users can insert own basic profile"
  ON talent_profiles_basic FOR INSERT
  WITH CHECK (talent_user_id = auth.uid());

CREATE POLICY "Talent users can update own basic profile"
  ON talent_profiles_basic FOR UPDATE
  USING (talent_user_id = auth.uid());

CREATE POLICY "Admins can read all basic profiles"
  ON talent_profiles_basic FOR SELECT
  USING (is_admin());

-- =========================================================================
-- Change 4: Template skill sets and tools tables
-- =========================================================================

CREATE TABLE IF NOT EXISTS template_skill_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TABLE IF NOT EXISTS template_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TRIGGER set_template_skill_sets_updated_at
  BEFORE UPDATE ON template_skill_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_template_tools_updated_at
  BEFORE UPDATE ON template_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_skill_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tools ENABLE ROW LEVEL SECURITY;

-- Everyone can read active skills/tools
CREATE POLICY "Anyone can read active template skills"
  ON template_skill_sets FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage template skills"
  ON template_skill_sets FOR ALL
  USING (is_admin());

CREATE POLICY "Anyone can read active template tools"
  ON template_tools FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage template tools"
  ON template_tools FOR ALL
  USING (is_admin());


-- ============================================================
-- 00009_ai_tools_portfolio_share_links.sql
-- ============================================================
-- Migration: 00009_ai_tools_portfolio_share_links
-- Description: Add template AI tools, portfolio items, and profile share links tables.

-- =========================================================================
-- 1. Template AI Tools (per category, same pattern as template_tools)
-- =========================================================================

CREATE TABLE IF NOT EXISTS template_ai_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TRIGGER set_template_ai_tools_updated_at
  BEFORE UPDATE ON template_ai_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active template ai tools"
  ON template_ai_tools FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage template ai tools"
  ON template_ai_tools FOR ALL
  USING (is_admin());

-- =========================================================================
-- 2. Portfolio Items (per profile, grouped by skill)
-- =========================================================================

CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'video')),
  file_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portfolio_items_profile ON portfolio_items (profile_id);

CREATE TRIGGER set_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talent users can read own portfolio items"
  ON portfolio_items FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can insert own portfolio items"
  ON portfolio_items FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can update own portfolio items"
  ON portfolio_items FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can delete own portfolio items"
  ON portfolio_items FOR DELETE
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all portfolio items"
  ON portfolio_items FOR SELECT
  USING (is_admin());

-- =========================================================================
-- 3. Profile Share Links (time-limited public access)
-- =========================================================================

CREATE TABLE IF NOT EXISTS profile_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profile_share_links_token ON profile_share_links (token);
CREATE INDEX idx_profile_share_links_profile ON profile_share_links (profile_id);

ALTER TABLE profile_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage share links"
  ON profile_share_links FOR ALL
  USING (is_admin());


-- ============================================================
-- 00010_invite_system.sql
-- ============================================================
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


-- ============================================================
-- 00011_drop_profile_share_links.sql
-- ============================================================
DROP TABLE IF EXISTS profile_share_links;


-- ============================================================
-- 00012_languages_spoken_jsonb.sql
-- ============================================================
-- Change languages_spoken from TEXT[] to JSONB to support proficiency levels
-- Each entry: {"language": "Hindi", "proficiency": "native"}

-- 1. Add new JSONB column
ALTER TABLE talent_users ADD COLUMN languages_spoken_new JSONB DEFAULT '[]'::jsonb;

-- 2. Migrate any existing data
UPDATE talent_users
SET languages_spoken_new = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('language', elem, 'proficiency', 'fluent')), '[]'::jsonb)
  FROM unnest(languages_spoken) AS elem
)
WHERE languages_spoken IS NOT NULL AND array_length(languages_spoken, 1) IS NOT NULL;

-- 3. Swap columns
ALTER TABLE talent_users DROP COLUMN languages_spoken;
ALTER TABLE talent_users RENAME COLUMN languages_spoken_new TO languages_spoken;


-- ============================================================
-- 00013_create_lead_submissions.sql
-- ============================================================
-- Migration: 00013_create_lead_submissions
-- Description: Lead submission system for Meta ad capture forms

CREATE TYPE lead_status_enum AS ENUM ('new', 'contacted', 'converted', 'rejected');
CREATE TYPE lead_form_type_enum AS ENUM ('creative', 'accountant');

CREATE TABLE lead_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type lead_form_type_enum NOT NULL,
    status lead_status_enum NOT NULL DEFAULT 'new',

    -- Common fields (first-class for querying/filtering)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,

    -- Form-specific fields
    form_data JSONB NOT NULL DEFAULT '{}',

    -- Resume URL (accountant form)
    resume_url TEXT,

    -- Meta ad attribution tracking
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Admin management
    admin_notes TEXT,
    status_changed_by UUID,
    status_changed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_submissions_form_type ON lead_submissions(form_type);
CREATE INDEX idx_lead_submissions_status ON lead_submissions(status);
CREATE INDEX idx_lead_submissions_created_at ON lead_submissions(created_at DESC);
CREATE INDEX idx_lead_submissions_phone ON lead_submissions(phone);
CREATE INDEX idx_lead_submissions_email ON lead_submissions(email);

CREATE TRIGGER set_lead_submissions_updated_at
    BEFORE UPDATE ON lead_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_submissions"
    ON lead_submissions
    FOR ALL
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- 00014_create_public_forms.sql
-- ============================================================
-- ============================================================
-- Public Forms configuration table
-- ============================================================

CREATE TABLE IF NOT EXISTS public_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type     TEXT NOT NULL UNIQUE,         -- e.g. 'creative', 'accountant'
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  url_path      TEXT NOT NULL,                -- e.g. '/apply/creative'
  enabled       BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_public_forms_updated_at
  BEFORE UPDATE ON public_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed the two existing forms
INSERT INTO public_forms (form_type, title, description, url_path, enabled) VALUES
  ('creative',   'Designer / Editor',  'Form for designers and editors arriving from Meta ads', '/apply/creative',   true),
  ('accountant', 'Accountant',         'Form for accountants arriving from Meta ads',           '/apply/accountant', true);

-- RLS
ALTER TABLE public_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on public_forms"
  ON public_forms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous read for form status checks
CREATE POLICY "Public read on public_forms"
  ON public_forms
  FOR SELECT
  TO anon
  USING (true);


-- ============================================================
-- 00015_previous_field_data.sql
-- ============================================================
-- Add previous_field_data to track what changed between reviews
ALTER TABLE talent_profiles ADD COLUMN previous_field_data JSONB DEFAULT NULL;


-- ============================================================
-- 00016_add_access_requested_at.sql
-- ============================================================
-- Migration: 00016_add_access_requested_at
-- Description: Add access_requested_at column to business_users for access renewal requests

ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ;


-- ============================================================
-- 00017_lead_status_overhaul.sql
-- ============================================================
-- Migration: 00017_lead_status_overhaul
-- Description: New lead status flow (under_review, shortlisted, partner_onboarding,
--              onboard_completed, archived), archive reason/notes, profile type tagging.

-- 1. Add new status enum values (enum values cannot be removed; old ones stay for legacy rows)
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'shortlisted';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'partner_onboarding';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'onboard_completed';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'archived';

-- 2. Archive reason + profile type fields
ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,
  ADD COLUMN IF NOT EXISTS profile_type TEXT,
  ADD COLUMN IF NOT EXISTS profile_type_custom TEXT;

-- profile_type constrained to known values (or NULL)
ALTER TABLE lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_profile_type_check;
ALTER TABLE lead_submissions
  ADD CONSTRAINT lead_submissions_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN ('junior', 'pro', 'elite', 'custom'));


-- ============================================================
-- 00018_business_phone_login.sql
-- ============================================================
-- Migration: 00018_business_phone_login
-- Description: Allow business users to be invited with a phone number and log in
--              with email or phone. Adds a normalized phone column (digits-only)
--              so lookups are tolerant of formatting differences like "+91 ..."
--              vs "...".

-- 1. invitations: add optional phone + normalized generated column
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone_normalized TEXT
    GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) STORED;

-- Only one pending invitation per phone (ignores empty/no-phone rows)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_phone_pending
    ON invitations(phone_normalized)
    WHERE status = 'pending' AND phone_normalized <> '';

-- 2. business_users: add normalized phone column on top of the existing contact_phone
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS contact_phone_normalized TEXT
    GENERATED ALWAYS AS (regexp_replace(COALESCE(contact_phone, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_business_users_phone_normalized
    ON business_users(contact_phone_normalized)
    WHERE contact_phone_normalized <> '';


-- ============================================================
-- 00019_add_country_state_to_basic_profile.sql
-- ============================================================
-- Add country + state columns to talent_profiles_basic for the signup wizard's
-- Contact Details step pickers. current_district already exists.
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS state TEXT;


-- ============================================================
-- 00020_interview_questions.sql
-- ============================================================
-- Migration: 00020_interview_questions
-- Description: First-level interview questions per form type + per-lead invitation tokens and responses.
-- Idempotent — safe to re-run.

-- ============================================================
-- Configurable interview questions (per form type)
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    helper_text TEXT,
    field_type TEXT NOT NULL DEFAULT 'textarea'
        CHECK (field_type IN ('textarea', 'text', 'yes_no', 'acknowledge')),
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_form_type
    ON interview_questions(form_type, display_order)
    WHERE is_active = true;

DROP TRIGGER IF EXISTS set_interview_questions_updated_at ON interview_questions;
CREATE TRIGGER set_interview_questions_updated_at
    BEFORE UPDATE ON interview_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Per-lead interview invitations (token-gated)
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead_submissions(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    responses JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_invitations_lead_id
    ON interview_invitations(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_invitations_token
    ON interview_invitations(token);

-- ============================================================
-- RLS — service role only (admin + public token lookups go through supabaseAdmin)
-- ============================================================

ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on interview_questions" ON interview_questions;
CREATE POLICY "Service role full access on interview_questions"
    ON interview_questions
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on interview_invitations" ON interview_invitations;
CREATE POLICY "Service role full access on interview_invitations"
    ON interview_invitations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- Seed the three starter questions per form type
-- Only inserts when no questions exist yet for that form_type, so re-runs are safe.
-- ============================================================

INSERT INTO interview_questions (form_type, question_text, field_type, display_order)
SELECT v.form_type, v.question_text, v.field_type, v.display_order
FROM (VALUES
    ('creative',   'Can you join immediately if selected? Are you currently working? Share your notice period.', 'textarea',    1),
    ('creative',   'Do you have a laptop, smartphone and reliable internet connection to undertake this job?',   'yes_no',      2),
    ('creative',   'Working time will be 9:30 AM to 6:00 PM, Monday to Saturday (Remote — Work from home). Please confirm.', 'acknowledge', 3),
    ('accountant', 'Can you join immediately if selected? Are you currently working? Share your notice period.', 'textarea',    1),
    ('accountant', 'Do you have a laptop, smartphone and reliable internet connection to undertake this job?',   'yes_no',      2),
    ('accountant', 'Working time will be 9:30 AM to 6:00 PM, Monday to Saturday (Remote — Work from home). Please confirm.', 'acknowledge', 3)
) AS v(form_type, question_text, field_type, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM interview_questions iq WHERE iq.form_type = v.form_type
);


-- ============================================================
-- 00021_interview_invitations_reviewed.sql
-- ============================================================
-- Migration: 00021_interview_invitations_reviewed
-- Description: Track when an admin has marked an interview response as reviewed.
-- Idempotent — safe to re-run.

ALTER TABLE interview_invitations
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;

CREATE INDEX IF NOT EXISTS idx_interview_invitations_reviewed_at
    ON interview_invitations(reviewed_at);


-- ============================================================
-- 00022_normalize_lead_phones.sql
-- ============================================================
-- Migration: 00022_normalize_lead_phones
-- Description: Fix lead_submissions rows where the country code "91" was typed
-- twice (once selected in the form, once typed by the candidate), leaving
-- entries like "+91917080886087" for the real number 7080886087.
--
-- Strategy: strip all non-digits, then check if the result is one or more
-- "91" prefixes followed by exactly 10 more digits. If so, keep only the
-- trailing 10 digits and re-prefix with "+91". Non-Indian numbers and
-- already-correct rows are left untouched.
--
-- Idempotent — re-running leaves correctly-stored rows unchanged.

UPDATE lead_submissions
SET phone = '+91' || regexp_replace(
  regexp_replace(phone, '\D', '', 'g'),
  '^(91)+(\d{10})$',
  '\2'
)
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^(91)+\d{10}$';


-- ============================================================
-- 00023_template_tools_group.sql
-- ============================================================
-- Migration: 00023_template_tools_group
-- Description: Add nullable "group" column to template_tools so tools for a
-- single category can be visually split into subsections (e.g., an accountant
-- profile separating "Accounting Software" from "Other Tools"). When the
-- column is null the profile form renders tools as a flat list (unchanged
-- behaviour for existing categories).

ALTER TABLE template_tools
  ADD COLUMN IF NOT EXISTS "group" TEXT;

CREATE INDEX IF NOT EXISTS template_tools_category_group_idx
  ON template_tools (category_id, "group", sort_order);


-- ============================================================
-- 00024_subscription_cards.sql
-- ============================================================
-- Migration: 00024_subscription_cards
-- Description: Cards published by SquadHub admin, fanned out to matching talents.
-- Each talent's accept/reject response is stored alongside webhook-delivery state
-- so the outbound callback to SquadHub can be retried by a simple sweeper.
--
-- `content` and `match_rules` are flexible JSONB so SquadHub can evolve the
-- payload shape (new fields, new match dimensions) without a Profiles migration.

-- ============================================================
-- subscription_cards
-- ============================================================

CREATE TABLE subscription_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    match_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscription_cards_status_published_at_idx
    ON subscription_cards (status, published_at DESC);

CREATE INDEX subscription_cards_match_rules_gin_idx
    ON subscription_cards USING GIN (match_rules);

CREATE TRIGGER set_subscription_cards_updated_at
    BEFORE UPDATE ON subscription_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- subscription_card_recipients
-- ============================================================

CREATE TABLE subscription_card_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
    talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    responded_at TIMESTAMPTZ,
    callback_delivered_at TIMESTAMPTZ,
    callback_attempts INT NOT NULL DEFAULT 0,
    callback_last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, talent_user_id)
);

CREATE INDEX subscription_card_recipients_talent_status_idx
    ON subscription_card_recipients (talent_user_id, status, created_at DESC);

-- Partial index used by the retry sweeper to find responded-but-undelivered rows.
CREATE INDEX subscription_card_recipients_pending_callbacks_idx
    ON subscription_card_recipients (callback_delivered_at)
    WHERE status <> 'pending' AND callback_delivered_at IS NULL;

CREATE TRIGGER set_subscription_card_recipients_updated_at
    BEFORE UPDATE ON subscription_card_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (defense in depth — backend writes use the service role key and bypass RLS)
-- ============================================================

ALTER TABLE subscription_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_card_recipients ENABLE ROW LEVEL SECURITY;

-- Recipients: talents can read only their own rows, and may only flip their
-- status forward to accepted/rejected (never back to pending).
CREATE POLICY subscription_card_recipients_select_own ON subscription_card_recipients
    FOR SELECT USING (auth.uid() = talent_user_id);

CREATE POLICY subscription_card_recipients_update_own ON subscription_card_recipients
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (auth.uid() = talent_user_id AND status IN ('accepted', 'rejected'));

CREATE POLICY subscription_card_recipients_select_admin ON subscription_card_recipients
    FOR SELECT USING (is_admin());

-- Cards: readable if a recipient row ties the card to the current talent,
-- or by any admin.
CREATE POLICY subscription_cards_select_via_recipient ON subscription_cards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subscription_card_recipients r
            WHERE r.card_id = subscription_cards.id
              AND r.talent_user_id = auth.uid()
        )
    );

CREATE POLICY subscription_cards_select_admin ON subscription_cards
    FOR SELECT USING (is_admin());

-- No INSERT or DELETE policies on either table: all writes go through the
-- service-role backend.


-- ============================================================
-- 00025_talent_access_grants.sql
-- ============================================================
-- Migration: 00025_talent_access_grants
-- Description: Email-gated public access to talent profiles by category.
--   Admin issues a grant (email + expires_at + categories). The grantee logs in
--   on a single shared public URL using just their email and browses approved
--   talent profiles in the granted categories.
--
--   Tier (junior/pro/elite/custom) is NOT denormalised — it is resolved via
--   v_talent_profile_tier, which joins to the latest matching lead_submissions
--   row by email. Source of truth stays in the existing Candidates module.

-- ============================================================
-- talent_access_grants
-- ============================================================

CREATE TABLE talent_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX talent_access_grants_email_idx
    ON talent_access_grants (lower(email));

CREATE INDEX talent_access_grants_active_idx
    ON talent_access_grants (lower(email))
    WHERE revoked_at IS NULL;

CREATE TRIGGER set_talent_access_grants_updated_at
    BEFORE UPDATE ON talent_access_grants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- talent_access_grant_categories (join table: which categories a grant covers)
-- ============================================================

CREATE TABLE talent_access_grant_categories (
    grant_id    UUID NOT NULL REFERENCES talent_access_grants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (grant_id, category_id)
);

CREATE INDEX talent_access_grant_categories_category_idx
    ON talent_access_grant_categories (category_id);

-- ============================================================
-- RLS — admin-only via is_admin() (defined in 00007)
-- ============================================================

ALTER TABLE talent_access_grants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_access_grant_categories  ENABLE ROW LEVEL SECURITY;

CREATE POLICY talent_access_grants_admin_all
    ON talent_access_grants
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY talent_access_grant_categories_admin_all
    ON talent_access_grant_categories
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- Tier resolution view
--   Joins talent_profiles -> talent_users -> auth.users.email -> lead_submissions
--   (latest lead per email) so the access service can filter by tier without
--   touching the talent_profiles schema.
-- ============================================================

CREATE INDEX IF NOT EXISTS lead_submissions_email_lower_idx
    ON lead_submissions (lower(email));

CREATE OR REPLACE VIEW v_talent_profile_tier AS
SELECT
    tp.id                    AS talent_profile_id,
    tp.category_id           AS category_id,
    ls.profile_type          AS tier,
    ls.profile_type_custom   AS tier_custom
FROM talent_profiles tp
JOIN talent_users tu ON tu.id = tp.talent_user_id
JOIN auth.users   au ON au.id = tu.id
LEFT JOIN LATERAL (
    SELECT profile_type, profile_type_custom
    FROM lead_submissions ls2
    WHERE ls2.email IS NOT NULL
      AND lower(ls2.email) = lower(au.email)
    ORDER BY ls2.created_at DESC
    LIMIT 1
) ls ON true;

COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/elite/custom) for each talent_profile by joining '
    'to the most recent lead_submissions row matching the talent user''s email. '
    'Tier source of truth lives on lead_submissions.profile_type.';


-- ============================================================
-- 00026_talent_user_is_active.sql
-- ============================================================
-- Admin-controlled visibility flag on talent_users.
-- Independent of approval_status (vetting workflow) and Supabase auth ban_duration (login).
-- A talent_user is publicly browseable iff is_active = true.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_talent_users_is_active
  ON talent_users (id) WHERE is_active = true;

-- Tighten the business-user RLS policy on talent_profiles so it also excludes
-- inactive profiles AND inactive talents. The original policy only checked
-- status='approved' AND deleted_at IS NULL, missing both is_active gates.

DROP POLICY IF EXISTS talent_profiles_select_business ON talent_profiles;

CREATE POLICY talent_profiles_select_business ON talent_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid())
    AND status = 'approved'
    AND is_active = true
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM talent_users tu
      WHERE tu.id = talent_profiles.talent_user_id
        AND tu.is_active = true
    )
  );


-- ============================================================
-- 00027_employment_type_and_virtual_hours.sql
-- ============================================================
-- Migration: 00027_employment_type_and_virtual_hours
-- Description: Add employment_type and virtual_office_hours columns to
--              talent_profiles_basic to support the split signup step
--              (salary-based vs freelance / UpSquad Partner Program).

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS employment_type TEXT[],
  ADD COLUMN IF NOT EXISTS virtual_office_hours JSONB;

COMMENT ON COLUMN talent_profiles_basic.employment_type IS
  'Subset of {salary, freelance}';
COMMENT ON COLUMN talent_profiles_basic.virtual_office_hours IS
  'Array of {day, from, to} for freelance candidates';


-- ============================================================
-- 00027_subscription_cards_business_link.sql
-- ============================================================
-- Migration: 00027_subscription_cards_business_link
-- Description: Link a SquadHub-published subscription card to a Profiles
-- business user. The webhook payload now carries the client's email; the
-- ingest service resolves that to a business_users row and stores its id
-- here so that talent acceptances can write into business_shared_profiles.

ALTER TABLE subscription_cards
    ADD COLUMN business_user_id UUID NULL REFERENCES business_users(id) ON DELETE SET NULL;

CREATE INDEX subscription_cards_business_user_id_idx
    ON subscription_cards (business_user_id)
    WHERE business_user_id IS NOT NULL;


-- ============================================================
-- 00028_portfolio_external_video_links.sql
-- ============================================================
-- Migration: 00028_portfolio_external_video_links
-- Description: Allow portfolio_items rows to reference an externally hosted
--              video (Google Drive, Dropbox, Loom, YouTube, Vimeo) instead of
--              a file uploaded to R2. Adds source_type/provider/external_url/
--              embed_url/thumbnail_url columns and a CHECK constraint that
--              keeps the two row shapes (upload vs link) coherent.
--
--              For link rows, file_url mirrors embed_url so existing reads
--              that select file_url keep working without code changes.

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'upload'
    CHECK (source_type IN ('upload', 'link')),
  ADD COLUMN IF NOT EXISTS provider TEXT
    CHECK (provider IN ('youtube', 'vimeo', 'loom', 'gdrive', 'dropbox')),
  ADD COLUMN IF NOT EXISTS external_url TEXT,
  ADD COLUMN IF NOT EXISTS embed_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

ALTER TABLE portfolio_items
  DROP CONSTRAINT IF EXISTS portfolio_items_link_fields_chk;

ALTER TABLE portfolio_items
  ADD CONSTRAINT portfolio_items_link_fields_chk CHECK (
    (
      source_type = 'upload'
      AND provider IS NULL
      AND external_url IS NULL
      AND embed_url IS NULL
    )
    OR (
      source_type = 'link'
      AND provider IS NOT NULL
      AND external_url IS NOT NULL
      AND embed_url IS NOT NULL
      AND file_type = 'video'
    )
  );

CREATE INDEX IF NOT EXISTS idx_portfolio_items_source_type
  ON portfolio_items (source_type);

COMMENT ON COLUMN portfolio_items.source_type IS
  'Whether the row references an uploaded R2 file (upload) or an externally hosted video link (link).';
COMMENT ON COLUMN portfolio_items.provider IS
  'External provider for link rows: youtube|vimeo|loom|gdrive|dropbox.';
COMMENT ON COLUMN portfolio_items.external_url IS
  'Original share URL the user pasted (canonical/normalized form).';
COMMENT ON COLUMN portfolio_items.embed_url IS
  'URL used as iframe src or <video src> for inline playback.';
COMMENT ON COLUMN portfolio_items.thumbnail_url IS
  'Optional poster image URL (deterministic for YouTube, oEmbed-fetched for Vimeo).';


-- ============================================================
-- 00029_add_lead_notes.sql
-- ============================================================
-- Migration: 00029_add_lead_notes
-- Description: Multi-note timestamped admin notes per lead. Additive to legacy
--              lead_submissions.admin_notes (kept for archive justification).

CREATE TABLE IF NOT EXISTS lead_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES lead_submissions(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (length(btrim(content)) > 0),
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id_created_at
    ON lead_notes (lead_id, created_at DESC);

CREATE TRIGGER set_lead_notes_updated_at
    BEFORE UPDATE ON lead_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on lead_notes" ON lead_notes;
CREATE POLICY "Service role full access on lead_notes"
    ON lead_notes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


-- ============================================================
-- 00029_designer_editor_category.sql
-- ============================================================
-- 00029_designer_editor_category.sql
-- Adds the "Designer + Editor" talent category, plus its template skills,
-- tools, and AI tools (the union of the existing Designer and Video Editor
-- catalogs). Idempotent — safe to re-run.

-- 1. Category row
INSERT INTO categories (name, slug, description, is_active, sort_order)
VALUES (
  'Designer + Editor',
  'designer-editor',
  'Talents skilled in both graphic design and video editing.',
  TRUE,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Template skills (8 design + 9 editing = 17)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_skill_sets (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Branding'),
  ('Logo Design'),
  ('Motion & Advanced Design'),
  ('Product & Print Design'),
  ('Social Media Creatives'),
  ('UI Designs'),
  ('UX Designs'),
  ('Visual Identity Design'),
  ('AI tools for editing'),
  ('Audio syncing & balancing'),
  ('Color grading & correction'),
  ('Continuity awareness'),
  ('Motion Graphics'),
  ('Sound Design'),
  ('Storytelling'),
  ('Typography & text animation basics'),
  ('VFX')
) AS s(name)
ON CONFLICT (category_id, name) DO NOTHING;

-- 3. Template tools (6 design + 6 editing = 12)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_tools (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Adobe Illustrator'),
  ('Adobe Photoshop'),
  ('Affinity Designer'),
  ('After Effects'),
  ('Canva'),
  ('Procreate'),
  ('Adobe Premiere Pro'),
  ('CapCut'),
  ('DaVinci Resolve'),
  ('Final Cut Pro (FCP)'),
  ('InShot'),
  ('VN Video Editor')
) AS t(name)
ON CONFLICT (category_id, name) DO NOTHING;

-- 4. Template AI tools (3 design + 13 editing = 16)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_ai_tools (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Freepik'),
  ('Gemini - nana banana'),
  ('Midjourney'),
  ('Descript'),
  ('Google Veo'),
  ('Grok'),
  ('HeyGen'),
  ('Higgsfield AI'),
  ('Kling AI'),
  ('Luma Dream Machine'),
  ('OpusClip'),
  ('Pika Labs'),
  ('Runway'),
  ('Seedance'),
  ('Synthesia'),
  ('Vizard.ai')
) AS a(name)
ON CONFLICT (category_id, name) DO NOTHING;


-- ============================================================
-- 00030_template_skill_ai_groups.sql
-- ============================================================
-- 00030_template_skill_ai_groups.sql
-- Adds optional `group` column to template_skill_sets and template_ai_tools
-- (template_tools already has it from migration 00023).
--
-- Then sets group + sort_order on the Designer + Editor category rows so the
-- profile-creation form renders Designer skills/tools/AI-tools first and
-- Editor (Video Editor) ones second under their own subheadings.
--
-- No effect on Designer or Video Editor categories — their rows keep
-- group = NULL, which the form treats as a single flat list.
-- Idempotent — safe to re-run.

ALTER TABLE template_skill_sets ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE template_ai_tools  ADD COLUMN IF NOT EXISTS "group" TEXT;

-- 1. Skills (8 Designer + 9 Editor)
UPDATE template_skill_sets ts
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Branding',                          'Designer', 0),
  ('Logo Design',                       'Designer', 0),
  ('Motion & Advanced Design',          'Designer', 0),
  ('Product & Print Design',            'Designer', 0),
  ('Social Media Creatives',            'Designer', 0),
  ('UI Designs',                        'Designer', 0),
  ('UX Designs',                        'Designer', 0),
  ('Visual Identity Design',            'Designer', 0),
  ('AI tools for editing',              'Editor',   1),
  ('Audio syncing & balancing',         'Editor',   1),
  ('Color grading & correction',        'Editor',   1),
  ('Continuity awareness',              'Editor',   1),
  ('Motion Graphics',                   'Editor',   1),
  ('Sound Design',                      'Editor',   1),
  ('Storytelling',                      'Editor',   1),
  ('Typography & text animation basics','Editor',   1),
  ('VFX',                               'Editor',   1)
) AS sub(name, grp, so)
WHERE ts.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND ts.name = sub.name;

-- 2. Tools (6 Designer + 6 Editor)
UPDATE template_tools tt
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Adobe Illustrator',  'Designer', 0),
  ('Adobe Photoshop',    'Designer', 0),
  ('Affinity Designer',  'Designer', 0),
  ('After Effects',      'Designer', 0),
  ('Canva',              'Designer', 0),
  ('Procreate',          'Designer', 0),
  ('Adobe Premiere Pro', 'Editor',   1),
  ('CapCut',             'Editor',   1),
  ('DaVinci Resolve',    'Editor',   1),
  ('Final Cut Pro (FCP)','Editor',   1),
  ('InShot',             'Editor',   1),
  ('VN Video Editor',    'Editor',   1)
) AS sub(name, grp, so)
WHERE tt.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND tt.name = sub.name;

-- 3. AI Tools (3 Designer + 13 Editor)
UPDATE template_ai_tools tat
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Freepik',             'Designer', 0),
  ('Gemini - nana banana','Designer', 0),
  ('Midjourney',          'Designer', 0),
  ('Descript',            'Editor',   1),
  ('Google Veo',          'Editor',   1),
  ('Grok',                'Editor',   1),
  ('HeyGen',              'Editor',   1),
  ('Higgsfield AI',       'Editor',   1),
  ('Kling AI',            'Editor',   1),
  ('Luma Dream Machine',  'Editor',   1),
  ('OpusClip',            'Editor',   1),
  ('Pika Labs',           'Editor',   1),
  ('Runway',              'Editor',   1),
  ('Seedance',            'Editor',   1),
  ('Synthesia',           'Editor',   1),
  ('Vizard.ai',           'Editor',   1)
) AS sub(name, grp, so)
WHERE tat.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND tat.name = sub.name;


-- ============================================================
-- 00031_admin_settings.sql
-- ============================================================
-- Generic key/value store for global admin settings.
-- Seeded with the auto_approve_signups flag used by the User Approvals page.

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO admin_settings (key, value)
VALUES ('auto_approve_signups', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 00032_subscription_recipients_cancelled_at.sql
-- ============================================================
-- Migration 00032: subscription_card_recipients.cancelled_at + partial unique index
--
-- Recipients can now exist in multiple rounds per (card, talent). When a partner
-- recalls a card, every recipient row for that card gets `cancelled_at` set —
-- the row stays around as audit/display state but is no longer actionable. When
-- the card is republished (status archived → active), a fresh `pending` row is
-- inserted alongside the cancelled one. The partial unique index keeps at most
-- one *active* row per (card, talent).

ALTER TABLE subscription_card_recipients
    ADD COLUMN cancelled_at TIMESTAMPTZ NULL;

ALTER TABLE subscription_card_recipients
    DROP CONSTRAINT subscription_card_recipients_card_id_talent_user_id_key;

CREATE UNIQUE INDEX subscription_card_recipients_active_unique
    ON subscription_card_recipients (card_id, talent_user_id)
    WHERE cancelled_at IS NULL;

CREATE INDEX subscription_card_recipients_talent_active_idx
    ON subscription_card_recipients (talent_user_id, cancelled_at, status, created_at DESC);

-- Backfill: for cards already archived, mark their existing recipient rows
-- cancelled at the card's updated_at (best approximation of "when the recall
-- happened"). Uncancelled rows on still-active cards stay uncancelled.
UPDATE subscription_card_recipients r
SET cancelled_at = c.updated_at
FROM subscription_cards c
WHERE r.card_id = c.id
  AND c.status = 'archived'
  AND r.cancelled_at IS NULL;

-- Replace the talent UPDATE policy to also block flipping status on a row
-- whose offer has been recalled (cancelled_at set). Backend uses the service
-- role and bypasses RLS, but adds its own guard in respond().
DROP POLICY subscription_card_recipients_update_own ON subscription_card_recipients;
CREATE POLICY subscription_card_recipients_update_own ON subscription_card_recipients
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (
        auth.uid() = talent_user_id
        AND status IN ('accepted', 'rejected')
        AND cancelled_at IS NULL
    );


-- ============================================================
-- 00032_talent_access_grants_squadhub.sql
-- ============================================================
-- Migration: 00032_talent_access_grants_squadhub
-- Description: Cross-link talent_access_grants with SquadHub's
--   profile_access_grants so a SquadHub salesperson can issue a grant
--   from SquadHub and have it land here, identifiable as theirs.
--
--   - squadhub_grant_id           — UNIQUE pointer to SquadHub's local row;
--                                    set when the grant arrived via the
--                                    /api/integrations/squadhub/talent-access
--                                    webhook. NULL for grants originated by
--                                    a Profiles admin in this admin UI.
--   - created_by_squadhub_user_id — the SquadHub user.id of the originator.
--                                    Set additionally to created_by (which is
--                                    the Profiles admin id, now nullable).
--
--   created_by used to be NOT NULL because every grant came from the admin UI
--   here. Loosen it for the SquadHub origination path: when SquadHub creates
--   a grant via webhook, there is no Profiles admin to attribute it to —
--   just the SquadHub user. Existing rows are unaffected (they already have a
--   created_by set).

ALTER TABLE talent_access_grants
    ADD COLUMN squadhub_grant_id UUID UNIQUE,
    ADD COLUMN created_by_squadhub_user_id UUID,
    ALTER COLUMN created_by DROP NOT NULL;

-- Filter to keep the index small — only rows that came from SquadHub.
CREATE INDEX talent_access_grants_squadhub_user_idx
    ON talent_access_grants (created_by_squadhub_user_id)
    WHERE created_by_squadhub_user_id IS NOT NULL;


-- ============================================================
-- 00033_subscription_cards_distribution_and_email.sql
-- ============================================================
-- Migration: 00033_subscription_cards_distribution_and_email
-- Description: Persist two SquadHub-side fields on each subscription card so
-- ingest can honour them and reads can recover from a timing race.
--
-- 1. `distribution` — broadcast vs manual ("soft publish") from SquadHub.
--    Manual cards must NEVER be auto-fanned out to talents; the existing
--    ingest path was creating recipient rows for every matching talent
--    regardless of this flag, which leaked manual cards into talent feeds.
--
-- 2. `business_email` — the lead email SquadHub sent. We resolve it to a
--    business_users row at ingest time, but the business_user can be created
--    AFTER the card arrives (the lead accepts an invitation later). With
--    only the resolved FK stored, late-arriving business_users orphan their
--    cards forever. Storing the email lets the dashboard query fall back to
--    matching by email when the FK is null.

ALTER TABLE subscription_cards
    ADD COLUMN distribution TEXT NOT NULL DEFAULT 'broadcast'
        CHECK (distribution IN ('broadcast', 'manual'));

ALTER TABLE subscription_cards
    ADD COLUMN business_email TEXT NULL;

-- Case-insensitive lookup index — the dashboard fallback compares against
-- business_users.contact_email, also stored verbatim, and we want both
-- sides to ignore case.
CREATE INDEX subscription_cards_business_email_lower_idx
    ON subscription_cards (LOWER(business_email))
    WHERE business_email IS NOT NULL;


-- ============================================================
-- 00034_check_contact_exists.sql
-- ============================================================
-- Public read-only function: checks whether an email or phone is already
-- present as a talent user, business user, or prior lead submission.
-- SECURITY DEFINER so it can read auth.users from the anon role.
CREATE OR REPLACE FUNCTION public.check_contact_exists(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL  -- 10-digit phone, no country code
)
RETURNS TABLE (source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'talent'::text
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.talent_users tu ON tu.id = u.id
      WHERE lower(u.email) = lower(p_email)
    )
  UNION ALL
  SELECT 'talent'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.talent_users
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'business'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE lower(contact_email) = lower(p_email)
    )
  UNION ALL
  SELECT 'business'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE right(contact_phone_normalized, 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'auth'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_contact_exists(text, text) TO anon, authenticated, service_role;


-- ============================================================
-- 00034_link_leads_to_talent_users.sql
-- ============================================================
-- Migration: 00034_link_leads_to_talent_users
-- Description: Persist the connection between lead_submissions (Candidates) and
-- talent_users so admins can see "this signup originated from lead X" on the
-- Reviews and Talents pages, and "this lead has signed up as a talent" on the
-- Candidates page. Match by email (case-insensitive) OR last 10 digits of phone.

-- 1. Link column on lead_submissions (one talent → many leads)
ALTER TABLE lead_submissions
  ADD COLUMN linked_talent_user_id UUID REFERENCES talent_users(id) ON DELETE SET NULL;

CREATE INDEX lead_submissions_linked_talent_user_idx
  ON lead_submissions(linked_talent_user_id)
  WHERE linked_talent_user_id IS NOT NULL;

-- 2. Backfill existing leads against existing talent_users
UPDATE lead_submissions ls
SET linked_talent_user_id = tu.id
FROM talent_users tu
JOIN auth.users au ON au.id = tu.id
WHERE ls.linked_talent_user_id IS NULL
  AND (
    (ls.email IS NOT NULL AND lower(ls.email) = lower(au.email))
    OR (ls.phone IS NOT NULL AND tu.phone IS NOT NULL
        AND right(regexp_replace(ls.phone, '\D', '', 'g'), 10)
          = right(regexp_replace(tu.phone, '\D', '', 'g'), 10))
  );

-- 3. RPC called from the signup flow. SECURITY DEFINER so the service role's
-- session_role doesn't matter when invoked via supabase-js .rpc().
CREATE OR REPLACE FUNCTION link_leads_for_talent_user(
  p_user_id UUID,
  p_email TEXT,
  p_phone_last10 TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE lead_submissions
  SET linked_talent_user_id = p_user_id
  WHERE linked_talent_user_id IS NULL
    AND (
      (p_email IS NOT NULL AND email IS NOT NULL AND lower(email) = lower(p_email))
      OR (p_phone_last10 IS NOT NULL
          AND right(regexp_replace(phone, '\D', '', 'g'), 10) = p_phone_last10)
    );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;


-- ============================================================
-- 00034_portfolio_categories.sql
-- ============================================================
-- 00034_portfolio_categories.sql
-- Adds a fourth template axis ("Categories" — portfolio genres) per parent
-- category, plus per-portfolio-item category assignment and a many-to-many
-- skill tagging table. Backfills existing portfolio_items.skill_name into
-- the new junction so legacy rows render their old skill as a single chip.
-- Idempotent — safe to re-run.

-- =========================================================================
-- 1. template_categories — admin-managed list of portfolio genres per
--    parent category. Mirrors template_skill_sets shape.
-- =========================================================================

CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_template_categories_category
  ON template_categories(category_id);

DROP TRIGGER IF EXISTS set_template_categories_updated_at ON template_categories;
CREATE TRIGGER set_template_categories_updated_at
  BEFORE UPDATE ON template_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active template categories"
  ON template_categories;
CREATE POLICY "Public can read active template categories"
  ON template_categories FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage template categories"
  ON template_categories;
CREATE POLICY "Admins can manage template categories"
  ON template_categories FOR ALL USING (is_admin());

-- =========================================================================
-- 2. portfolio_items.category_name — which genre a video was uploaded
--    under. Nullable so legacy rows stay untouched and surface as
--    "Uncategorized" until the editor reassigns them.
-- =========================================================================

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS category_name TEXT;

CREATE INDEX IF NOT EXISTS idx_portfolio_items_category_name
  ON portfolio_items(category_name);

-- =========================================================================
-- 3. portfolio_item_skills — many-to-many tagging for "skills demonstrated
--    in this video". The single skill_name column on portfolio_items
--    stays for legacy reads; the junction is the source of truth going
--    forward (see talent.service.ts).
-- =========================================================================

CREATE TABLE IF NOT EXISTS portfolio_item_skills (
  portfolio_item_id UUID NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  PRIMARY KEY (portfolio_item_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_item_skills_item
  ON portfolio_item_skills(portfolio_item_id);

ALTER TABLE portfolio_item_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Talent can manage own portfolio item skills"
  ON portfolio_item_skills;
CREATE POLICY "Talent can manage own portfolio item skills"
  ON portfolio_item_skills FOR ALL
  USING (
    portfolio_item_id IN (
      SELECT pi.id FROM portfolio_items pi
      JOIN talent_profiles tp ON tp.id = pi.profile_id
      WHERE tp.talent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read portfolio item skills"
  ON portfolio_item_skills;
CREATE POLICY "Admins can read portfolio item skills"
  ON portfolio_item_skills FOR SELECT USING (is_admin());

-- =========================================================================
-- 4. Backfill existing portfolio_items so each legacy row contributes
--    its single skill_name to the junction. category_name stays NULL.
-- =========================================================================

INSERT INTO portfolio_item_skills (portfolio_item_id, skill_name)
SELECT id, skill_name
FROM portfolio_items
WHERE skill_name IS NOT NULL AND skill_name <> ''
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 5. Seed the genre list for the Designer + Editor parent category.
-- =========================================================================

WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_categories (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Shorts Edits'),
  ('Youtube Video'),
  ('Events'),
  ('Wedding'),
  ('Automobile'),
  ('Architecture'),
  ('Landscape'),
  ('Short Films'),
  ('Movies'),
  ('Music and Albums'),
  ('AI Video'),
  ('Motion Graphics')
) AS c(name)
ON CONFLICT (category_id, name) DO NOTHING;


-- ============================================================
-- 00035_ghost_profiles.sql
-- ============================================================
-- 00035_ghost_profiles.sql
-- Ghost Designer+Editor profile mechanism.
--
-- A "ghost" talent_profile is auto-generated for any talent who has both a
-- Designer profile and a Video Editor profile. It points to those two source
-- profiles via foreign keys and acts as a virtual Designer + Editor entry
-- for business discovery and subscription matching. Talents never create or
-- edit a ghost row directly — it's maintained by the backend
-- ghost-profile service.
--
-- Idempotent — safe to re-run.

-- 1. New columns on talent_profiles
ALTER TABLE talent_profiles
  ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_designer_profile_id UUID
    REFERENCES talent_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_editor_profile_id UUID
    REFERENCES talent_profiles(id) ON DELETE CASCADE;

-- 2. Constraint: ghost rows must reference both source profiles.
ALTER TABLE talent_profiles
  DROP CONSTRAINT IF EXISTS talent_profiles_ghost_source_check;
ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_ghost_source_check CHECK (
    is_ghost = FALSE OR (
      source_designer_profile_id IS NOT NULL
      AND source_editor_profile_id IS NOT NULL
    )
  );

-- The existing uq_talent_profiles_user_category index already enforces
-- "at most one non-deleted profile per (talent_user_id, category_id)",
-- which naturally caps a talent at one ghost in the designer-editor
-- category — no additional unique index needed.

-- 3. Index for cascade lookups (ghost cleanup when a source profile is
--    hard-deleted is handled by the FK CASCADE; this index speeds up the
--    ghost service's reverse lookups).
CREATE INDEX IF NOT EXISTS idx_talent_profiles_source_designer
  ON talent_profiles (source_designer_profile_id)
  WHERE source_designer_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_talent_profiles_source_editor
  ON talent_profiles (source_editor_profile_id)
  WHERE source_editor_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill existing data.
--
-- Slugs assumed:
--   * 'designer'        — Designer category
--   * 'video-editor'    — Video Editor category
--   * 'designer-editor' — Combined Designer + Editor (now ghost-only)
--
-- Steps:
--   4a. For talents who already have separate Designer + Video Editor
--       profiles AND a legacy combined Designer+Editor row: drop the
--       legacy combined row. The ghost (4c) will replace it.
--   4b. For talents who have ONLY a legacy combined row (no separates):
--       split it into a Designer profile and a Video Editor profile,
--       copying field_data and resume_url to both. Reassign portfolio
--       items to the new Designer profile (admins can re-tag editor
--       items later via the existing portfolio re-categorization UI).
--       Then drop the original combined row.
--   4c. Insert ghost rows for every talent who now has both a Designer
--       and a Video Editor profile but no ghost yet.
-- ---------------------------------------------------------------------------

-- 4a. Drop redundant legacy combined rows
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  redundant_legacy AS (
    SELECT c.id
    FROM talent_profiles c
    WHERE c.category_id = (SELECT id FROM combined_cat)
      AND c.is_ghost = FALSE
      AND c.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM talent_profiles d
        WHERE d.talent_user_id = c.talent_user_id
          AND d.category_id = (SELECT id FROM designer_cat)
          AND d.deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM talent_profiles e
        WHERE e.talent_user_id = c.talent_user_id
          AND e.category_id = (SELECT id FROM editor_cat)
          AND e.deleted_at IS NULL
      )
  )
DELETE FROM talent_profiles
WHERE id IN (SELECT id FROM redundant_legacy);

-- 4b. Split standalone-only legacy combined rows into separate Designer +
--     Video Editor profiles. We use a temp table so we can reassign
--     portfolio items by talent_user_id deterministically before deleting
--     the original combined row.
DROP TABLE IF EXISTS pg_temp.legacy_combined_split;
CREATE TEMP TABLE pg_temp.legacy_combined_split AS
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1)
SELECT p.id AS legacy_id, p.talent_user_id, p.status, p.field_data,
       p.resume_url, p.is_active,
       (SELECT id FROM designer_cat) AS designer_cat_id,
       (SELECT id FROM editor_cat)   AS editor_cat_id
FROM talent_profiles p
WHERE p.category_id = (SELECT id FROM combined_cat)
  AND p.is_ghost = FALSE
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM talent_profiles d
    WHERE d.talent_user_id = p.talent_user_id
      AND d.category_id = (SELECT id FROM designer_cat)
      AND d.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM talent_profiles e
    WHERE e.talent_user_id = p.talent_user_id
      AND e.category_id = (SELECT id FROM editor_cat)
      AND e.deleted_at IS NULL
  );

-- Insert separate Designer profiles, capturing the new IDs alongside legacy_id
DROP TABLE IF EXISTS pg_temp.split_designer_ids;
CREATE TEMP TABLE pg_temp.split_designer_ids (legacy_id UUID, new_id UUID);

WITH inserted AS (
  INSERT INTO talent_profiles (
    talent_user_id, category_id, status, field_data, resume_url, is_active
  )
  SELECT talent_user_id, designer_cat_id, status, field_data, resume_url, is_active
  FROM pg_temp.legacy_combined_split
  RETURNING id, talent_user_id
)
INSERT INTO pg_temp.split_designer_ids (legacy_id, new_id)
SELECT s.legacy_id, i.id
FROM pg_temp.legacy_combined_split s
JOIN inserted i ON i.talent_user_id = s.talent_user_id;

-- Insert separate Video Editor profiles
INSERT INTO talent_profiles (
  talent_user_id, category_id, status, field_data, resume_url, is_active
)
SELECT talent_user_id, editor_cat_id, status, field_data, resume_url, is_active
FROM pg_temp.legacy_combined_split;

-- Reassign portfolio items from legacy combined → new Designer profile
UPDATE portfolio_items pi
SET profile_id = sd.new_id
FROM pg_temp.split_designer_ids sd
WHERE pi.profile_id = sd.legacy_id;

-- Drop the legacy combined rows
DELETE FROM talent_profiles
WHERE id IN (SELECT legacy_id FROM pg_temp.legacy_combined_split);

DROP TABLE IF EXISTS pg_temp.legacy_combined_split;
DROP TABLE IF EXISTS pg_temp.split_designer_ids;

-- 4c. Insert ghost rows for talents with both Designer + Video Editor.
-- The ghost.status is 'approved' iff both source profiles are 'approved',
-- otherwise 'draft'. Business discovery / subscription matching only
-- considers 'approved' rows, so this preserves the existing gating.
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  pairs AS (
    SELECT
      d.talent_user_id,
      d.id AS designer_id,
      e.id AS editor_id,
      CASE
        WHEN d.status = 'approved' AND e.status = 'approved' THEN 'approved'
        ELSE 'draft'
      END AS computed_status
    FROM talent_profiles d
    JOIN talent_profiles e ON e.talent_user_id = d.talent_user_id
    WHERE d.category_id = (SELECT id FROM designer_cat)
      AND e.category_id = (SELECT id FROM editor_cat)
      AND d.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND d.is_ghost = FALSE
      AND e.is_ghost = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM talent_profiles g
        WHERE g.talent_user_id = d.talent_user_id
          AND g.category_id = (SELECT id FROM combined_cat)
          AND g.is_ghost = TRUE
          AND g.deleted_at IS NULL
      )
  )
INSERT INTO talent_profiles (
  talent_user_id, category_id, status, field_data, is_active, is_ghost,
  source_designer_profile_id, source_editor_profile_id
)
SELECT
  p.talent_user_id,
  (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  p.computed_status::profile_status_enum,
  '{}'::jsonb,
  TRUE,
  TRUE,
  p.designer_id,
  p.editor_id
FROM pairs p;


-- ============================================================
-- 00036_talent_profile_tier.sql
-- ============================================================
-- ============================================================
-- 00036_talent_profile_tier.sql
--
-- Per-profile tier override on talent_profiles.
--
-- Until now, tier was resolved exclusively from the latest
-- lead_submissions.profile_type matched by talent user email
-- (see 00025_talent_access_grants.sql, view v_talent_profile_tier).
--
-- This migration:
--   1. Adds tier / tier_custom columns to talent_profiles so admins
--      can set tier directly from the Talents page.
--   2. Updates v_talent_profile_tier to prefer the profile-level
--      tier when set, falling back to the lead-level tier otherwise.
--
-- Interim behavior (enforced in service layer, not in SQL): when
-- admin sets tier from a profile, the same value is written to ALL
-- of that talent's non-deleted profiles. Future direction is per-
-- profile tier — the column already supports that; the service just
-- needs to stop writing-to-all.
-- ============================================================

ALTER TABLE talent_profiles
    ADD COLUMN IF NOT EXISTS tier        TEXT,
    ADD COLUMN IF NOT EXISTS tier_custom TEXT;

ALTER TABLE talent_profiles
    DROP CONSTRAINT IF EXISTS talent_profiles_tier_check,
    ADD  CONSTRAINT talent_profiles_tier_check
        CHECK (tier IS NULL OR tier IN ('junior', 'pro', 'elite', 'custom'));

ALTER TABLE talent_profiles
    DROP CONSTRAINT IF EXISTS talent_profiles_tier_custom_check,
    ADD  CONSTRAINT talent_profiles_tier_custom_check
        CHECK (tier_custom IS NULL OR tier = 'custom');

COMMENT ON COLUMN talent_profiles.tier IS
    'Per-profile tier override. When null, tier resolves from latest matching lead_submission.';
COMMENT ON COLUMN talent_profiles.tier_custom IS
    'Custom tier label, only meaningful when tier = ''custom''.';

-- ----------------------------------------------------------------
-- Update v_talent_profile_tier to prefer profile-level tier.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_talent_profile_tier AS
SELECT
    tp.id                                              AS talent_profile_id,
    tp.category_id                                     AS category_id,
    COALESCE(tp.tier, ls.profile_type)                 AS tier,
    COALESCE(tp.tier_custom, ls.profile_type_custom)   AS tier_custom
FROM talent_profiles tp
JOIN talent_users tu ON tu.id = tp.talent_user_id
JOIN auth.users   au ON au.id = tu.id
LEFT JOIN LATERAL (
    SELECT profile_type, profile_type_custom
    FROM lead_submissions ls2
    WHERE ls2.email IS NOT NULL
      AND lower(ls2.email) = lower(au.email)
    ORDER BY ls2.created_at DESC
    LIMIT 1
) ls ON true;

COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/elite/custom) for each talent_profile. '
    'Prefers per-profile tier on talent_profiles; falls back to the '
    'latest matching lead_submissions.profile_type by talent user email.';


-- ============================================================
-- 00037_auto_approval_rules.sql
-- ============================================================
-- ============================================================
-- Auto-approval rules for public forms
-- ============================================================

ALTER TABLE public_forms
  ADD COLUMN IF NOT EXISTS auto_approval_rules JSONB NOT NULL
    DEFAULT '{"enabled": false, "match_mode": "all", "rules": [], "approved_redirect_url": ""}';

ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- 00038_auto_invite_invited_by_nullable.sql
-- ============================================================
-- ============================================================
-- Allow system-generated invitations (auto-invites on auto-approval)
-- to omit invited_by, since they are not initiated by an admin.
-- ============================================================

ALTER TABLE invitations
  ALTER COLUMN invited_by DROP NOT NULL;


-- ============================================================
-- 00039_lead_submissions_deleted_at.sql
-- ============================================================
-- ============================================================
-- Soft-delete support for lead_submissions
--
-- Mirrors the talent_profiles soft-delete pattern: a nullable
-- deleted_at timestamp lets admins move candidates to a recycle
-- view, restore them, or permanently delete them.
-- ============================================================

ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lead_submissions_deleted_at
  ON lead_submissions (deleted_at);


-- ============================================================
-- 00040_subscription_card_selection.sql
-- ============================================================
-- 00040: Subscription Card Selection
--
-- Mirrors the selection concept from SquadHub. When a talent is selected
-- (either by SquadHire admin or via SquadHub webhook), the recipient row
-- is stamped. The talent sees "Selected" in their subscriptions tab.

ALTER TABLE subscription_card_recipients
  ADD COLUMN IF NOT EXISTS selected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS passed_over_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scr_selected
  ON subscription_card_recipients(card_id)
  WHERE selected_at IS NOT NULL;

-- Card-level denormalized pointer (matches SquadHub pattern).
ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS selected_talent_user_id UUID REFERENCES talent_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ;


-- ============================================================
-- 00041_push_tokens.sql
-- ============================================================
BEGIN;

CREATE TABLE push_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    token         TEXT NOT NULL,
    platform      TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

CREATE TABLE notification_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    type             TEXT NOT NULL CHECK (type IN ('new_card', 'selected', 'cancelled')),
    ref_card_id      UUID REFERENCES subscription_cards(id) ON DELETE SET NULL,
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_dedup
    ON notification_log(user_id, type, ref_card_id);

COMMIT;


-- ============================================================
-- 00042_training_program.sql
-- ============================================================
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Training Chapters
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_chapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_training_chapters_updated_at
    BEFORE UPDATE ON training_chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Chapter ↔ Category (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_chapter_categories (
    chapter_id  UUID NOT NULL REFERENCES training_chapters(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id)        ON DELETE CASCADE,
    PRIMARY KEY (chapter_id, category_id)
);

CREATE INDEX idx_training_chapter_categories_category
    ON training_chapter_categories(category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Training Lessons (belong to one chapter)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_lessons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id  UUID NOT NULL REFERENCES training_chapters(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    loom_url    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_lessons_chapter_sort
    ON training_lessons(chapter_id, sort_order);

CREATE TRIGGER set_training_lessons_updated_at
    BEFORE UPDATE ON training_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Lesson Progress (per-user completion tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_lesson_progress (
    talent_user_id UUID NOT NULL REFERENCES talent_users(id)    ON DELETE CASCADE,
    lesson_id      UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
    completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (talent_user_id, lesson_id)
);

CREATE INDEX idx_training_lesson_progress_user
    ON training_lesson_progress(talent_user_id);

COMMIT;


-- ============================================================
-- 00043_permanent_address_fields.sql
-- ============================================================
-- Add structured fields for the permanent/official address on talent_profiles_basic.
-- The existing country/state/current_district/city/pin_code columns continue to
-- represent the talent's current address (captured during sign-up).
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS permanent_country TEXT,
  ADD COLUMN IF NOT EXISTS permanent_state TEXT,
  ADD COLUMN IF NOT EXISTS permanent_district TEXT,
  ADD COLUMN IF NOT EXISTS permanent_city TEXT,
  ADD COLUMN IF NOT EXISTS permanent_pin_code TEXT;


-- ============================================================
-- 00044_split_expected_salary_by_availability.sql
-- ============================================================
-- Split expected monthly salary into separate full-time and part-time
-- columns. The legacy expected_salary_monthly column is kept untouched so
-- historical data remains queryable; new writes go to the split columns.
ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS expected_salary_full_time INTEGER,
  ADD COLUMN IF NOT EXISTS expected_salary_part_time INTEGER;


-- ============================================================
-- 00045_onboarding_training_gate.sql
-- ============================================================
-- Track whether talent has completed onboarding training
ALTER TABLE talent_users
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Mark one chapter as the onboarding chapter (enforced as single in app code)
ALTER TABLE training_chapters
  ADD COLUMN is_onboarding BOOLEAN NOT NULL DEFAULT false;

-- Language tag per chapter, admin-set
ALTER TABLE training_chapters
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en';


-- ============================================================
-- 00046_lesson_language_variants.sql
-- ============================================================
-- Per-lesson language video variants. Each lesson can have one Loom URL per language.
CREATE TABLE training_lesson_videos (
  lesson_id UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  loom_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lesson_id, language)
);

CREATE INDEX idx_training_lesson_videos_lesson ON training_lesson_videos(lesson_id);

-- Backfill existing lessons' loom_url as the English variant
INSERT INTO training_lesson_videos (lesson_id, language, loom_url)
SELECT id, 'en', loom_url
FROM training_lessons
WHERE loom_url IS NOT NULL AND loom_url != ''
ON CONFLICT (lesson_id, language) DO NOTHING;


-- ============================================================
-- 00047_subscription_cards_recall_secondary.sql
-- ============================================================
-- 00047_subscription_cards_recall_secondary.sql
--
-- Adds two fields the SquadHub→Profiles webhook needs to classify cards
-- on the business dashboard:
--
--   recalled_at  — TIMESTAMPTZ. Stamped when SquadHub recalls a card that
--                  already had acceptances. Lets the business dashboard
--                  show a "Recalled" tag while the card stays in Open
--                  (the lead is still in flight via the acceptee).
--                  Null for never-recalled cards. Already present in the
--                  outbound webhook payload — currently dropped at the
--                  Profiles validator.
--
--   is_secondary — BOOLEAN. True for cards SquadHub created as a child of
--                  another card (parent_card_id IS NOT NULL on its side).
--                  Profiles uses it to hide secondaries from the business
--                  dashboard list. Defaults to false so existing rows
--                  classify as primaries until the next webhook fires.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_secondary BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS subscription_cards_recalled_at_idx
  ON subscription_cards (recalled_at)
  WHERE recalled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_cards_is_secondary_idx
  ON subscription_cards (is_secondary)
  WHERE is_secondary = true;


-- ============================================================
-- 00048_admin_edit_talent_policies.sql
-- ============================================================
-- Migration: 00048_admin_edit_talent_policies
-- Description: Allow admins to UPDATE talent_users and write to portfolio_items.
-- Backend services use the service role and bypass RLS, so these policies are
-- defense-in-depth for any future code path that uses an anon-key Supabase
-- client with an admin JWT.

-- ============================================================
-- talent_users: admin UPDATE
-- ============================================================

DROP POLICY IF EXISTS talent_users_update_admin ON talent_users;

CREATE POLICY talent_users_update_admin ON talent_users
    FOR UPDATE USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- portfolio_items: admin ALL
-- ============================================================

DROP POLICY IF EXISTS portfolio_items_admin_all ON portfolio_items;

CREATE POLICY portfolio_items_admin_all ON portfolio_items
    FOR ALL USING (is_admin())
    WITH CHECK (is_admin());


-- ============================================================
-- 00049_chapter_linked_module.sql
-- ============================================================
ALTER TABLE training_chapters
  ADD COLUMN linked_module TEXT;


-- ============================================================
-- 00050_training_courses.sql
-- ============================================================
-- Add a courses layer above training_chapters.
-- Migration is intentionally backward-compatible: course_id on chapters is
-- nullable so existing chapters survive without immediate triage. A follow-up
-- cleanup migration will tighten the schema (drop is_onboarding/language on
-- chapters, drop training_chapter_categories, set course_id NOT NULL) once
-- admins have moved every chapter into a course.

CREATE TABLE training_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_training_courses_updated_at
  BEFORE UPDATE ON training_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE training_course_categories (
  course_id   UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, category_id)
);

CREATE INDEX idx_training_course_categories_category
  ON training_course_categories(category_id);

-- Enforce: a category can appear in at most one ACTIVE onboarding course.
-- Postgres partial indexes can't reference other tables (IMMUTABLE-only)
-- so we use a BEFORE INSERT/UPDATE trigger on training_course_categories.
CREATE OR REPLACE FUNCTION enforce_onboarding_category_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM training_courses
    WHERE id = NEW.course_id
      AND is_onboarding = true
      AND deleted_at IS NULL
  ) AND EXISTS (
    SELECT 1
    FROM training_course_categories tcc
    JOIN training_courses c ON c.id = tcc.course_id
    WHERE tcc.category_id = NEW.category_id
      AND tcc.course_id <> NEW.course_id
      AND c.is_onboarding = true
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Category % is already linked to another active onboarding course', NEW.category_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_course_categories_onboarding_uniqueness
  BEFORE INSERT OR UPDATE ON training_course_categories
  FOR EACH ROW EXECUTE FUNCTION enforce_onboarding_category_uniqueness();

-- Add course_id to chapters (nullable for backward compatibility during rollout)
ALTER TABLE training_chapters
  ADD COLUMN course_id UUID REFERENCES training_courses(id) ON DELETE SET NULL;

CREATE INDEX idx_training_chapters_course_sort
  ON training_chapters(course_id, sort_order);

-- Lift the existing onboarding chapter into a new onboarding course (idempotent).
WITH src AS (
  SELECT id, title, description
  FROM training_chapters
  WHERE is_onboarding = true
  LIMIT 1
), new_course AS (
  INSERT INTO training_courses (title, description, is_onboarding, sort_order)
  SELECT title, description, true, 0 FROM src
  WHERE NOT EXISTS (SELECT 1 FROM training_courses WHERE is_onboarding = true)
  RETURNING id
), existing_course AS (
  SELECT id FROM training_courses WHERE is_onboarding = true LIMIT 1
), target_course AS (
  SELECT id FROM new_course
  UNION ALL
  SELECT id FROM existing_course
  LIMIT 1
)
UPDATE training_chapters
SET course_id = (SELECT id FROM target_course)
WHERE is_onboarding = true
  AND course_id IS NULL;

-- Copy categories from the onboarding chapter to its new course
INSERT INTO training_course_categories (course_id, category_id)
SELECT DISTINCT c.course_id, tcc.category_id
FROM training_chapters c
JOIN training_chapter_categories tcc ON tcc.chapter_id = c.id
WHERE c.is_onboarding = true
  AND c.course_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: allow admin (already covered by service role) and authenticated reads
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_course_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_courses_select_authenticated ON training_courses
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY training_course_categories_select_authenticated ON training_course_categories
  FOR SELECT
  TO authenticated
  USING (true);


-- ============================================================
-- 00051_course_countdown.sql
-- ============================================================
-- Per-course completion deadlines.
--
-- Admins can opt-in a course by setting countdown_enabled=true and a positive
-- countdown_hours. The first time a talent opens such a course they see a
-- start popup; clicking Start writes a row into training_course_starts.
-- The deadline is started_at + countdown_hours hours. Once exceeded the
-- course locks (chapters become unlocked=false and lesson completion is
-- rejected server-side). Approved talents bypass the lock.

ALTER TABLE training_courses
  ADD COLUMN countdown_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN countdown_hours INT;

ALTER TABLE training_courses
  ADD CONSTRAINT countdown_hours_positive
    CHECK (countdown_hours IS NULL OR countdown_hours > 0);

CREATE TABLE training_course_starts (
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (talent_user_id, course_id)
);

CREATE INDEX idx_training_course_starts_user
  ON training_course_starts(talent_user_id);

ALTER TABLE training_course_starts ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_course_starts_select_self ON training_course_starts
  FOR SELECT TO authenticated
  USING (talent_user_id = auth.uid());

CREATE POLICY training_course_starts_insert_self ON training_course_starts
  FOR INSERT TO authenticated
  WITH CHECK (talent_user_id = auth.uid());


-- ============================================================
-- 00052_course_available_to_all.sql
-- ============================================================
ALTER TABLE training_courses
  ADD COLUMN available_to_all BOOLEAN NOT NULL DEFAULT false;


-- ============================================================
-- 00053_how_it_works_videos.sql
-- ============================================================
CREATE TABLE how_it_works_videos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language   TEXT NOT NULL UNIQUE,
  loom_url   TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 00054_business_card_review.sql
-- ============================================================
ALTER TABLE subscription_card_recipients
  ADD COLUMN IF NOT EXISTS business_review_status TEXT
    CHECK (business_review_status IN ('shortlisted', 'rejected')),
  ADD COLUMN IF NOT EXISTS business_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scr_business_review
  ON subscription_card_recipients(card_id, business_review_status)
  WHERE business_review_status IS NOT NULL;


-- ============================================================
-- 00055_subscription_card_request_source.sql
-- ============================================================
-- Subscription Cards: support for locally-created request-sourced and custom cards.
-- Existing cards from SquadHub webhook default to source='webhook'.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'webhook'
    CHECK (source IN ('webhook', 'request', 'custom'));

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS subscription_request_id INTEGER;

-- Make external_id nullable for locally-created cards (no SquadHub reference)
ALTER TABLE subscription_cards
  ALTER COLUMN external_id DROP NOT NULL;

-- Drop the unique constraint on external_id (nullable columns need a partial unique index)
ALTER TABLE subscription_cards
  DROP CONSTRAINT IF EXISTS subscription_cards_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_cards_external_id_unique
  ON subscription_cards(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_cards_request_id
  ON subscription_cards(subscription_request_id)
  WHERE subscription_request_id IS NOT NULL;


-- ============================================================
-- 00056_automation_events.sql
-- ============================================================
-- Automation event log — tracks every automated action for audit/debugging
CREATE TABLE automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  lead_id UUID REFERENCES lead_submissions(id) ON DELETE SET NULL,
  talent_user_id UUID,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_events_lead ON automation_events(lead_id);
CREATE INDEX idx_automation_events_type ON automation_events(event_type, created_at DESC);

-- Seed default automation config
INSERT INTO admin_settings (key, value) VALUES
  ('automation_config', '{
    "auto_shortlist_on_approve": true,
    "auto_onboarding_on_signup": true,
    "auto_invite_on_shortlist": true,
    "crm_message_on_shortlist": false
  }'::jsonb),
  ('automation_templates', '{
    "shortlisted": {
      "enabled": false,
      "channel": "whatsapp",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": ""
    },
    "partner_onboarding": {
      "enabled": false,
      "channel": "whatsapp",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": ""
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 00056_education_courses.sql
-- ============================================================
-- Migration: 00056_education_courses
-- Description: Add education_courses JSONB column to talent_profiles_basic
--              for storing an array of education/course entries.

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS education_courses JSONB;


-- ============================================================
-- 00057_automation_pipeline_stages.sql
-- ============================================================
-- Add CRM pipeline-stage automation entries for creative leads.
-- Existing automation_templates rows (shortlisted, partner_onboarding) are
-- preserved; we just merge in the new event types.
UPDATE admin_settings
SET value = value || '{
  "creative_lead_received": {
    "enabled": false,
    "channel": "crm_pipeline",
    "template_name": "",
    "template_body": "",
    "crm_webhook_url": "",
    "pipeline_stage": "Form Filled / For Review"
  },
  "creative_lead_auto_approved": {
    "enabled": false,
    "channel": "crm_pipeline",
    "template_name": "",
    "template_body": "",
    "crm_webhook_url": "",
    "pipeline_stage": "Signed Up"
  }
}'::jsonb
WHERE key = 'automation_templates';


-- ============================================================
-- 00058_simplify_automation_events.sql
-- ============================================================
-- Consolidate CRM events down to just two:
--   1. creative_lead_received → "Form Filled / For Review"
--   2. shortlisted             → "Shortlisted"  (fires for auto-approve OR manual shortlist)
--
-- Drop creative_lead_auto_approved (handled by shortlisted via the auto-shortlist chain)
-- and partner_onboarding (no CRM update on signup → onboarding for now).

UPDATE admin_settings
SET value = value - 'creative_lead_auto_approved' - 'partner_onboarding'
WHERE key = 'automation_templates';

-- Default the shortlisted template to CRM Pipeline channel with stage "Shortlisted".
UPDATE admin_settings
SET value = jsonb_set(
  value,
  '{shortlisted}',
  COALESCE(value -> 'shortlisted', '{}'::jsonb) || jsonb_build_object(
    'channel', 'crm_pipeline',
    'pipeline_stage', 'Shortlisted'
  ),
  true
)
WHERE key = 'automation_templates';


-- ============================================================
-- 00059_lead_received_all_forms.sql
-- ============================================================
-- The "form received" CRM event now applies to ALL form types, not just creative.
-- Rename creative_lead_received → lead_received in automation_templates,
-- preserving any existing configuration the admin already saved.

UPDATE admin_settings
SET value = jsonb_set(
  value - 'creative_lead_received',
  '{lead_received}',
  COALESCE(
    value -> 'creative_lead_received',
    '{
      "enabled": false,
      "channel": "crm_pipeline",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": "",
      "pipeline_stage": "Form Filled / For Review"
    }'::jsonb
  ),
  true
)
WHERE key = 'automation_templates';


-- ============================================================
-- 00060_signed_up_crm_event.sql
-- ============================================================
-- Add a third CRM event: signed_up — fires when a candidate signs up
-- (auto-approved or manual). Pushes them to the "Signed Up" pipeline stage.
UPDATE admin_settings
SET value = jsonb_set(
  value,
  '{signed_up}',
  COALESCE(
    value -> 'signed_up',
    '{
      "enabled": false,
      "channel": "crm_pipeline",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": "",
      "pipeline_stage": "Signed Up"
    }'::jsonb
  ),
  true
)
WHERE key = 'automation_templates';


-- ============================================================
-- 00061_portfolio_admin_review.sql
-- ============================================================
-- Admin review columns: active/inactive toggle + optional comment
ALTER TABLE portfolio_items
  ADD COLUMN admin_is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN admin_comment  text;


-- ============================================================
-- 00062_add_crm_statuses.sql
-- ============================================================
-- Add CRM pipeline statuses to lead_status_enum so SquadHire and Squad CRM
-- share the same status vocabulary for creative (designer/editor) candidates.

ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'share_form';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'form_filled';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'signed_up';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'onboarding_training';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'basic_profile';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'job_profile';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'portfolio_updation';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'final_review';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'no_response';

-- Seed a default CRM-status-mapping config.  Admin can edit from the UI.
INSERT INTO admin_settings (key, value)
VALUES (
  'crm_status_mapping',
  '{
    "pipeline_name": "Designers and Editors",
    "form_types": ["creative"],
    "crm_webhook_url": "",
    "mappings": {
      "new": "New",
      "share_form": "Share form",
      "form_filled": "Form Filled / For Review",
      "under_review": "Form Filled / For Review",
      "shortlisted": "Shortlisted",
      "signed_up": "Signed Up",
      "partner_onboarding": "Onboarding Training",
      "onboarding_training": "Onboarding Training",
      "basic_profile": "Basic Profile",
      "job_profile": "Job Profile",
      "portfolio_updation": "Portfolio Updation",
      "final_review": "Final Review",
      "onboard_completed": "Live",
      "live": "Live",
      "no_response": "No Response / In Active",
      "archived": "No Response / In Active"
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- 00063_card_assigned_status.sql
-- ============================================================
-- 00063: Add 'assigned' status to subscription cards
--
-- When SquadHub assigns recipients to a card, the status moves from
-- 'active' to 'assigned'. Pending talents no longer see the card;
-- non-selected accepted talents see it as "Closed".

ALTER TABLE subscription_cards
  DROP CONSTRAINT IF EXISTS subscription_cards_status_check;

ALTER TABLE subscription_cards
  ADD CONSTRAINT subscription_cards_status_check
    CHECK (status IN ('active', 'assigned', 'archived'));


-- ============================================================
-- 00064_get_auth_users_by_emails.sql
-- ============================================================
-- Bulk lookup of auth.users by email for the SquadHub integration.
-- SECURITY DEFINER so the service-role RPC can read auth.users.
CREATE OR REPLACE FUNCTION public.get_auth_users_by_emails(email_list text[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE lower(au.email) = ANY(email_list);
$$;


-- ============================================================
-- 00065_admin_search_views.sql
-- ============================================================
-- Views for admin global search.
-- - admin_talent_search: joins auth.users.email and exposes digit-only phone for normalized matching
-- - admin_business_search: exposes digit-only contact_phone for normalized matching
-- service_role only — these views surface auth.users.email and must not be exposed to anon/authenticated.

CREATE OR REPLACE VIEW public.admin_talent_search AS
SELECT
    tu.id,
    tu.full_name,
    tu.phone,
    tu.current_location,
    tu.profile_photo_url,
    tu.is_active,
    tu.created_at,
    regexp_replace(COALESCE(tu.phone, ''), '\D', '', 'g') AS phone_digits,
    au.email
FROM public.talent_users tu
LEFT JOIN auth.users au ON au.id = tu.id;

REVOKE ALL ON public.admin_talent_search FROM PUBLIC;
GRANT SELECT ON public.admin_talent_search TO service_role;

CREATE OR REPLACE VIEW public.admin_business_search AS
SELECT
    bu.id,
    bu.company_name,
    bu.contact_person_name,
    bu.contact_email,
    bu.contact_phone,
    bu.created_at,
    regexp_replace(COALESCE(bu.contact_phone, ''), '\D', '', 'g') AS contact_phone_digits
FROM public.business_users bu;

REVOKE ALL ON public.admin_business_search FROM PUBLIC;
GRANT SELECT ON public.admin_business_search TO service_role;


-- ============================================================
-- 00066_course_reopen_requests.sql
-- ============================================================
-- Course reopen requests: talents request access to a course that has expired,
-- admins approve/reject from the Access Requests queue.

CREATE TABLE course_reopen_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT
);

-- Only one pending request per (talent, course) at a time
CREATE UNIQUE INDEX uniq_pending_course_reopen
  ON course_reopen_requests (talent_user_id, course_id)
  WHERE status = 'pending';

-- Fast queue queries
CREATE INDEX idx_course_reopen_requests_status_requested_at
  ON course_reopen_requests (status, requested_at DESC);

-- RLS: backend uses service role and bypasses; talents see/insert their own
ALTER TABLE course_reopen_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talent_insert_own_request"
  ON course_reopen_requests FOR INSERT
  TO authenticated
  WITH CHECK (talent_user_id = auth.uid());

CREATE POLICY "talent_view_own_requests"
  ON course_reopen_requests FOR SELECT
  TO authenticated
  USING (talent_user_id = auth.uid());


-- ============================================================
-- 00067_subscription_card_archived_at.sql
-- ============================================================
-- 00067: Hard-archive flag on subscription cards
--
-- Distinct from `status='archived'`, which SquadHub sends for any closed/
-- recalled card and which Profiles still surfaces in the talent's
-- Responded tab and the business dashboard's Closed bucket. `archived_at`
-- represents an explicit admin action on SquadHub's Archive tab and is a
-- harder hide: the card disappears from BOTH talent feeds (pending and
-- responded) AND the business dashboard. Cleared on republish via the
-- ingest webhook (SquadHub sends `archived_at: null`).

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscription_cards_archived_at
  ON subscription_cards(archived_at)
  WHERE archived_at IS NOT NULL;


-- ============================================================
-- 00068_get_auth_users_by_ids.sql
-- ============================================================
-- Bulk lookup of auth.users by id for the SquadHub integration.
-- Mirror of get_auth_users_by_emails (00064) but reversed — used so SquadHub
-- can resolve a talent_user_id back to the email it was registered with,
-- then match against its own users table.
-- SECURITY DEFINER so the service-role RPC can read auth.users.
CREATE OR REPLACE FUNCTION public.get_auth_users_by_ids(id_list uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.id = ANY(id_list);
$$;


-- ============================================================
-- 00069_crm_status_mapping_per_form_type.sql
-- ============================================================
-- 00069_crm_status_mapping_per_form_type.sql
-- Reshape admin_settings.crm_status_mapping from a single-pipeline config
-- (pipeline_name + form_types[] + mappings) to a per-form-type structure
-- (pipelines keyed by form_type, each with pipeline_name + mappings). The
-- top-level crm_webhook_url is kept since all form_types still use the
-- same shcrm endpoint.
--
-- Idempotent: only rewrites rows that don't already have the `pipelines`
-- key (i.e. haven't been migrated). The first form_type from the legacy
-- form_types array becomes the pipelines key; if absent, defaults to
-- 'creative' (the only deployed form_type today).

UPDATE admin_settings
SET value = jsonb_build_object(
  'crm_webhook_url', value->>'crm_webhook_url',
  'pipelines', jsonb_build_object(
    COALESCE(value->'form_types'->>0, 'creative'),
    jsonb_build_object(
      'pipeline_name', value->>'pipeline_name',
      'mappings', value->'mappings'
    )
  )
)
WHERE key = 'crm_status_mapping' AND NOT (value ? 'pipelines');


-- ============================================================
-- 00069_sync_talent_active_to_lead_live.sql
-- ============================================================
-- Set talent_users.is_active based on the linked lead's onboarding status.
-- Live -> active; anything else -> inactive. Talents with no linked lead are not touched.
UPDATE talent_users tu
SET is_active = (l.status = 'live'),
    updated_at = NOW()
FROM lead_submissions l
WHERE l.linked_talent_user_id = tu.id
  AND tu.is_active <> (l.status = 'live');


-- ============================================================
-- 00070_talent_whatsapp_throttle.sql
-- ============================================================
-- Talent WhatsApp opt-out + throttle for the "subscription card received" automation.
-- whatsapp_subscription_updates_enabled  : per-talent opt-out toggle (UI on subscriptions page)
-- last_subscription_whatsapp_at          : timestamp of the most recent WhatsApp sent — used by the
--                                          throttle (max 1/day if the talent has unviewed prior cards)
-- viewed_at on subscription_card_recipients: stamped when the talent's app fetches the card —
--                                          drives the "engagement" signal for throttle decisions

ALTER TABLE talent_users
  ADD COLUMN whatsapp_subscription_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN last_subscription_whatsapp_at TIMESTAMPTZ;

ALTER TABLE subscription_card_recipients
  ADD COLUMN viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS subscription_card_recipients_unviewed_idx
  ON subscription_card_recipients (talent_user_id)
  WHERE viewed_at IS NULL AND cancelled_at IS NULL;


-- ============================================================
-- 00071_admin_lead_search_view.sql
-- ============================================================
-- View for admin global search to surface leads (form submissions) alongside
-- talents and businesses. Mirrors admin_talent_search / admin_business_search.
-- Excludes soft-deleted leads. Includes signed-up leads (those with a linked
-- talent_users row) — they may surface twice in the dropdown (once per group).
-- service_role only — surfaces lead PII.

CREATE OR REPLACE VIEW public.admin_lead_search AS
SELECT
    ls.id,
    ls.name,
    ls.email,
    ls.phone,
    ls.form_type,
    ls.status,
    ls.profile_type,
    ls.auto_approved,
    ls.linked_talent_user_id,
    ls.created_at,
    regexp_replace(COALESCE(ls.phone, ''), '\D', '', 'g') AS phone_digits
FROM public.lead_submissions ls
WHERE ls.deleted_at IS NULL;

REVOKE ALL ON public.admin_lead_search FROM PUBLIC;
GRANT SELECT ON public.admin_lead_search TO service_role;


-- ============================================================
-- 00072_subscription_card_activated_at.sql
-- ============================================================
-- Tracks when SquadHub admin "Finalized" a selection — moving the card from
-- "Selected" (waiting admin approval) to "Assigned" (active subscription).
-- Set by the /squadhub/cards/activation webhook from SquadHub. The talent's
-- "My Clients" tab groups cards by whether this is null (Selected) or set
-- (Assigned). Earnings + commitment summary only counts assigned cards.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';


-- ============================================================
-- 00073_admin_saved_lead_filters.sql
-- ============================================================
-- Migration: 00073_admin_saved_lead_filters
-- Description: Per-admin saved filter presets for the Candidates list
--              (/admin/leads). Stores structured form_data filter rules so
--              admins can recall named cohorts (e.g. "Bangalore accountants").
--              The shape of `filter_json` is owned by the admin frontend.

CREATE TABLE IF NOT EXISTS admin_saved_lead_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  form_type text,
  filter_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_saved_lead_filters_user_idx
  ON admin_saved_lead_filters(admin_user_id, form_type);

COMMENT ON TABLE admin_saved_lead_filters IS
  'Saved filter presets owned by individual admin users. Filter JSON shape is owned by the admin UI.';


-- ============================================================
-- 00074_notifications.sql
-- ============================================================
-- Migration: 00074_notifications
-- Description: Admin-authored notifications to talent users.
--   - `notifications`            : the message (title, body, multi-media: image/pdf/loom)
--   - `notification_recipients`  : per-talent recipient row, tracks read state
--
-- Targeting is filter-based; the admin picks filters (approval_status, gender,
-- languages, location, active flag), the backend expands matching talent_users
-- into recipient rows at send time. The filter snapshot is kept in
-- `target_filters` for audit and for the "sent to X users" stat in the admin UI.

-- ---------------------------------------------------------------------------
-- Enum: notification kind
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE notification_kind AS ENUM ('broadcast', 'system');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------------------------
-- notifications: one row per message
-- ---------------------------------------------------------------------------
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind notification_kind NOT NULL DEFAULT 'broadcast',
  -- Used only when kind='system' (e.g. interest_request, profile_approved, profile_rejected)
  system_type TEXT,
  title TEXT NOT NULL,
  body TEXT,
  -- Array of { type: 'image'|'pdf'|'loom', url: string, name?: string }
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Snapshot of admin filter selections at send time (audit + UI "sent to N")
  target_filters JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);
CREATE INDEX idx_notifications_created_by ON notifications (created_by);

-- ---------------------------------------------------------------------------
-- notification_recipients: per-talent state
-- ---------------------------------------------------------------------------
CREATE TABLE notification_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notification_id, talent_user_id)
);

CREATE INDEX idx_notification_recipients_inbox
  ON notification_recipients (talent_user_id, created_at DESC);

CREATE INDEX idx_notification_recipients_unread
  ON notification_recipients (talent_user_id)
  WHERE read_at IS NULL;

CREATE INDEX idx_notification_recipients_notif
  ON notification_recipients (notification_id);

-- ---------------------------------------------------------------------------
-- RLS
-- Server routes use the service-role client (bypasses RLS); these policies
-- are defense-in-depth for any direct PostgREST/anon access.
-- ---------------------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_recipients ENABLE ROW LEVEL SECURITY;

-- Admins: full access to notifications
CREATE POLICY notifications_admin_all ON notifications
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Talents: can read notifications they are a recipient of
CREATE POLICY notifications_select_recipient ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM notification_recipients nr
      WHERE nr.notification_id = notifications.id
        AND nr.talent_user_id = auth.uid()
    )
  );

-- Admins: full access to recipient rows (for admin "sent to N / read by M" stats)
CREATE POLICY notification_recipients_admin_all ON notification_recipients
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Talents: read + update (mark as read) their own recipient rows
CREATE POLICY notification_recipients_select_own ON notification_recipients
  FOR SELECT USING (talent_user_id = auth.uid());

CREATE POLICY notification_recipients_update_own ON notification_recipients
  FOR UPDATE USING (talent_user_id = auth.uid())
  WITH CHECK (talent_user_id = auth.uid());


-- ============================================================
-- 00075_top_talents_tier_phase1.sql
-- ============================================================
-- ============================================================
-- 00075_top_talents_tier_phase1.sql
--
-- Top Talents tier rename — Phase 1 (read-tolerant widening)
--
-- Widens both tier-value CHECK constraints to ACCEPT the new value
-- 'Top Talents' alongside the legacy 'elite'. No data is rewritten in
-- this migration — that happens in the Phase 2 backfill once the
-- application has shipped Phase 1 code.
--
-- Note the case asymmetry: legacy Profiles data uses lowercase
-- ('junior','pro','elite','custom'); the new value 'Top Talents' is
-- PascalCase with a space, matching Squad Hub's chosen canonical
-- string. Read paths in the application must tolerate both.
--
-- Affected constraints:
--   1. lead_submissions.profile_type    (junior/pro/elite/custom)
--   2. talent_profiles.tier             (junior/pro/elite/custom)
--
-- The v_talent_profile_tier view doesn't reference the literal value
-- itself (it COALESCEs), so it doesn't need to change in Phase 1.
-- Its comment is updated to reflect the new tier vocabulary.
-- ============================================================

-- 1) lead_submissions.profile_type — adds 'Top Talents'
ALTER TABLE lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_profile_type_check;
ALTER TABLE lead_submissions
  ADD CONSTRAINT lead_submissions_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN ('junior', 'pro', 'elite', 'Top Talents', 'custom'));

-- 2) talent_profiles.tier — adds 'Top Talents'
ALTER TABLE talent_profiles
  DROP CONSTRAINT IF EXISTS talent_profiles_tier_check;
ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_tier_check
  CHECK (tier IS NULL OR tier IN ('junior', 'pro', 'elite', 'Top Talents', 'custom'));

-- The talent_profiles.tier_custom CHECK references tier = 'custom' (lowercase).
-- That doesn't change in this rename, so the constraint stays as-is.

-- Update the view's comment to reflect the new tier vocabulary.
COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/elite/Top Talents/custom) for each talent_profile. '
    'Prefers per-profile tier on talent_profiles; falls back to the '
    'latest matching lead_submissions.profile_type by talent user email. '
    'Phase 1 of the Elite -> Top Talents rename accepts both values; '
    'Phase 2 backfills lowercase ''elite'' rows to ''Top Talents''.';


-- ============================================================
-- 00076_check_contact_exists_auth_standalone.sql
-- ============================================================
-- Migration: 00076_check_contact_exists_auth_standalone
-- Description: Update check_contact_exists to also detect orphaned auth users
-- (auth.users rows without a corresponding talent_users or business_users profile).
-- This prevents the signup pre-check from missing orphaned records and letting
-- users fill out the form only to hit a 409 on submit.

CREATE OR REPLACE FUNCTION public.check_contact_exists(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL
)
RETURNS TABLE (source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'talent'::text
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.talent_users tu ON tu.id = u.id
      WHERE lower(u.email) = lower(p_email)
    )
  UNION ALL
  SELECT 'talent'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.talent_users
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'business'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE lower(contact_email) = lower(p_email)
    )
  UNION ALL
  SELECT 'business'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE right(contact_phone_normalized, 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'auth'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_contact_exists(text, text) TO anon, authenticated, service_role;


-- ============================================================
-- 00077_check_contact_exists_exclude_deleted.sql
-- ============================================================
-- Migration: 00077_check_contact_exists_exclude_deleted
-- Description: Exclude soft-deleted lead_submissions from the duplicate
-- contact check so that archived/removed leads no longer block new
-- submissions with the same phone or email.

CREATE OR REPLACE FUNCTION public.check_contact_exists(
  p_email text DEFAULT NULL,
  p_phone_digits text DEFAULT NULL
)
RETURNS TABLE (source text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT 'talent'::text
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users u
      JOIN public.talent_users tu ON tu.id = u.id
      WHERE lower(u.email) = lower(p_email)
    )
  UNION ALL
  SELECT 'talent'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.talent_users
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'business'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE lower(contact_email) = lower(p_email)
    )
  UNION ALL
  SELECT 'business'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.business_users
      WHERE right(contact_phone_normalized, 10) = p_phone_digits
    )
  UNION ALL
  SELECT 'auth'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE lower(email) = lower(p_email)
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_email IS NOT NULL AND length(p_email) > 0
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE lower(email) = lower(p_email) AND deleted_at IS NULL
    )
  UNION ALL
  SELECT 'lead'
  WHERE p_phone_digits IS NOT NULL AND length(p_phone_digits) = 10
    AND EXISTS (
      SELECT 1 FROM public.lead_submissions
      WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = p_phone_digits
        AND deleted_at IS NULL
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_contact_exists(text, text) TO anon, authenticated, service_role;


-- ============================================================
-- 00078_talent_skip_onboarding.sql
-- ============================================================
-- Migration: 00078_talent_skip_onboarding
-- Description: Allow admins to mark a talent_user as exempt from the onboarding
-- training course. When `skip_onboarding = true` the talent is treated as if
-- they had completed onboarding (gates, lesson locks, module access, 5-stage
-- progress strip, and `onboarding_completed` checks all short-circuit on this
-- flag). Audit columns track who flipped it and why.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_at TIMESTAMPTZ;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_by UUID REFERENCES auth.users(id);

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_reason TEXT;

-- Backfill: explicitly bypass onboarding for the test account requested in
-- the original ticket. Safe to re-run; the WHERE clause is idempotent.
UPDATE public.talent_users tu
SET skip_onboarding = true,
    skip_onboarding_at = now(),
    skip_onboarding_reason = 'Manual bypass (seed/test account)'
FROM auth.users au
WHERE au.id = tu.id
  AND lower(au.email) = 'testapple@gmail.com';


-- ============================================================
-- 00079_accounting_tools_proficiency.sql
-- ============================================================
-- Migration: 00079_accounting_tools_proficiency
-- Description: Convert legacy `string[]` entries in `field_data._accounting_software`
-- and `field_data._tools` to `{name, level}[]` so each selected item can carry
-- a per-item proficiency (1-5: Learning / Beginner / Intermediate / Advanced
-- / Expert — same labels as `_skills`). Default level = 3 (Intermediate) for
-- migrated entries; users can re-rate on next profile edit.
--
-- Safe to re-run: the WHERE filter only touches rows whose array is still
-- plain strings (not yet object-shaped). The frontend form also defensively
-- `coerceLeveledList()`s on read, so any rows that slip through still render.

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_accounting_software}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', elem, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_accounting_software') AS elem
    )
  ),
  true
)
WHERE field_data ? '_accounting_software'
  AND jsonb_typeof(field_data -> '_accounting_software') = 'array'
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(field_data -> '_accounting_software') AS e
    WHERE jsonb_typeof(e) <> 'object'
  ) = jsonb_array_length(field_data -> '_accounting_software');

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_tools}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', elem, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_tools') AS elem
    )
  ),
  true
)
WHERE field_data ? '_tools'
  AND jsonb_typeof(field_data -> '_tools') = 'array'
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(field_data -> '_tools') AS e
    WHERE jsonb_typeof(e) <> 'object'
  ) = jsonb_array_length(field_data -> '_tools');


-- ============================================================
-- 00080_ai_tools_proficiency.sql
-- ============================================================
-- 00080_ai_tools_proficiency.sql
-- Convert legacy `string[]` `_ai_tools` rows to `{name, level}[]` so each AI
-- tool can carry a 1-5 proficiency level (Learning / Beginner / Intermediate
-- / Advanced / Expert). Mirrors 00079 (which did the same for accounting
-- software and tools). Defaults legacy entries to level 3 (Intermediate).
--
-- Idempotent: the WHERE filter only touches rows that are still a plain
-- `text[]`. Rows already converted (objects) are left alone.
--
-- Run AFTER 00079_accounting_tools_proficiency.sql (no schema dependency, but
-- keeps the proficiency migrations together).

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_ai_tools}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', v, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_ai_tools') AS v
    )
  )
)
WHERE jsonb_typeof(field_data -> '_ai_tools') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(field_data -> '_ai_tools') AS el
    WHERE jsonb_typeof(el) <> 'object'
  );


-- ============================================================
-- 00081_skills_proficiency_1to5.sql
-- ============================================================
-- 00081_skills_proficiency_1to5.sql
-- Convert legacy 1-10 `_skills` levels to 1-5 so the level-selector UI
-- (Learning / Beginner / Intermediate / Advanced / Expert) is consistent
-- across skills, tools, and AI tools.
--
-- Mapping: ceiling(level / 2) so the relative position is preserved.
--   1-2 -> 1 (Learning)
--   3-4 -> 2 (Beginner)
--   5-6 -> 3 (Intermediate)
--   7-8 -> 4 (Advanced)
--   9-10 -> 5 (Expert)
--
-- Idempotent: the WHERE filter only touches rows whose level is still > 5
-- (i.e. legacy 1-10 values). Rows already in 1-5 are untouched.
--
-- Run AFTER 00079_accounting_tools_proficiency.sql and
-- 00080_ai_tools_proficiency.sql.

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_skills}',
  (
    SELECT to_jsonb(
      ARRAY(
        SELECT
          jsonb_build_object(
            'skill',
            s ->> 'skill',
            'level',
            LEAST(5, GREATEST(1, CEIL((s ->> 'level')::numeric / 2)::int))
          )
        FROM jsonb_array_elements(field_data -> '_skills') AS s
        WHERE jsonb_typeof(s) = 'object'
      )
    )
  )
)
WHERE jsonb_typeof(field_data -> '_skills') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(field_data -> '_skills') AS s
    WHERE jsonb_typeof(s) = 'object'
      AND (s ->> 'level')::numeric > 5
  );


-- ============================================================
-- 00082_categories_proficiency_1to5.sql
-- ============================================================
-- 00082_categories_proficiency_1to5.sql
-- Convert legacy 1-10 `_categories` levels to 1-5 so the level-selector UI
-- (Learning / Beginner / Intermediate / Advanced / Expert) is consistent
-- across categories, skills, tools, and AI tools.
--
-- Mapping: ceiling(level / 2) so the relative position is preserved.
--   1-2 -> 1 (Learning)
--   3-4 -> 2 (Beginner)
--   5-6 -> 3 (Intermediate)
--   7-8 -> 4 (Advanced)
--   9-10 -> 5 (Expert)
--
-- Idempotent: the WHERE filter only touches rows whose level is still > 5
-- (i.e. legacy 1-10 values). Rows already in 1-5 are untouched.
--
-- Run AFTER 00079_accounting_tools_proficiency.sql,
-- 00080_ai_tools_proficiency.sql, and 00081_skills_proficiency_1to5.sql.

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_categories}',
  (
    SELECT to_jsonb(
      ARRAY(
        SELECT
          jsonb_build_object(
            'category',
            s ->> 'category',
            'level',
            LEAST(5, GREATEST(1, CEIL((s ->> 'level')::numeric / 2)::int))
          )
        FROM jsonb_array_elements(field_data -> '_categories') AS s
        WHERE jsonb_typeof(s) = 'object'
      )
    )
  )
)
WHERE jsonb_typeof(field_data -> '_categories') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(field_data -> '_categories') AS s
    WHERE jsonb_typeof(s) = 'object'
      AND (s ->> 'level')::numeric > 5
  );


-- ============================================================
-- 00083_experience.sql
-- ============================================================
-- Migration: 00083_experience
-- Description: Add experience JSONB column to talent_profiles_basic
--              for storing an array of work experience entries.
--              Mirrors the education_courses column (migration 00056).

ALTER TABLE talent_profiles_basic
  ADD COLUMN IF NOT EXISTS experience JSONB;


-- ============================================================
-- 00084_experience_field_type.sql
-- ============================================================
-- Migration: 00084_experience_field_type
-- Description: Add 'experience' to the field_type_enum so admins can
-- configure a field that captures both years and months of experience.
-- The value is stored in talent_profiles.field_data as
-- { "years": <int 0-50>, "months": <int 0-11> }.

ALTER TYPE field_type_enum ADD VALUE IF NOT EXISTS 'experience';


-- ============================================================
-- 00085_sales_form_and_category.sql
-- ============================================================
-- Migration: 00085_sales_form_and_category
-- Description: Add the "Sales" job profile end-to-end:
--   1. 'sales' value on lead_form_type_enum (public lead form)
--   2. public_forms row for /apply/sales
--   3. 'sales' category (talent job profile)
--   4. Sales skill sets / tools / AI tools template content
--
-- Safe to re-run (ON CONFLICT / IF NOT EXISTS). Paste into the Supabase
-- SQL editor and run. NOTE: the ALTER TYPE statement (step 1) must be run
-- on its own (Postgres will not let a new enum value be used in the same
-- transaction it is added in) — running this file top-to-bottom is fine
-- because nothing here inserts a lead with form_type = 'sales'.

-- ============================================================================
-- 1. Lead form type enum — add 'sales'
-- ============================================================================
ALTER TYPE lead_form_type_enum ADD VALUE IF NOT EXISTS 'sales';

-- ============================================================================
-- 2. Public form row — drives /apply/sales + admin Form Manager
-- ============================================================================
INSERT INTO public_forms (form_type, title, description, url_path, enabled) VALUES
  ('sales', 'Sales', 'Form for sales professionals arriving from Meta ads', '/apply/sales', true)
ON CONFLICT (form_type) DO NOTHING;

-- ============================================================================
-- 3. Talent job-profile category
-- ============================================================================
INSERT INTO categories (name, slug, description, is_active, sort_order)
VALUES (
  'Sales',
  'sales',
  'Sales, business development, and account management professionals.',
  TRUE,
  40
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 4a. Skill Sets
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_skill_sets (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('Lead Generation',                 0),
  ('Prospecting',                    10),
  ('Cold Calling',                   20),
  ('Inside Sales',                   30),
  ('Field Sales',                    40),
  ('B2B Sales',                      50),
  ('B2C Sales',                      60),
  ('Telesales',                      70),
  ('Solution Selling',               80),
  ('Negotiation',                    90),
  ('Closing Deals',                 100),
  ('Account Management',            110),
  ('Key Account Management',        120),
  ('Relationship Building',         130),
  ('Channel & Distributor Sales',   140),
  ('Retail Sales',                  150),
  ('Upselling & Cross-selling',     160),
  ('Sales Pipeline Management',     170),
  ('Territory Management',          180),
  ('Customer Retention',            190),
  ('After-sales Support',           200),
  ('Sales Presentations & Demos',   210),
  ('Proposal & Tender Management',  220),
  ('Market Research',               230)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 4b. Tools: CRM (grouped) + Other Tools
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_tools (category_id, name, "group", sort_order)
SELECT cat.id, v.name, v."group", v.sort_order FROM cat CROSS JOIN (VALUES
  -- CRM
  ('Salesforce',                  'CRM',          0),
  ('HubSpot',                     'CRM',         10),
  ('Zoho CRM',                    'CRM',         20),
  ('Freshsales',                  'CRM',         30),
  ('Pipedrive',                   'CRM',         40),
  ('Microsoft Dynamics 365',      'CRM',         50),
  ('LeadSquared',                 'CRM',         60),
  ('Kylas',                       'CRM',         70),
  ('Bitrix24',                    'CRM',         80),
  ('Close',                       'CRM',         90),
  ('Monday Sales CRM',            'CRM',        100),
  -- Other Tools
  ('Microsoft Excel',             'Other Tools', 1000),
  ('Google Sheets',               'Other Tools', 1010),
  ('LinkedIn Sales Navigator',    'Other Tools', 1020),
  ('WhatsApp Business',           'Other Tools', 1030),
  ('Gmail / Outlook',             'Other Tools', 1040),
  ('Zoom / Google Meet',          'Other Tools', 1050),
  ('Calendly',                    'Other Tools', 1060),
  ('Slack',                       'Other Tools', 1070),
  ('Canva',                       'Other Tools', 1080),
  ('IndiaMART',                   'Other Tools', 1090),
  ('Justdial',                    'Other Tools', 1100),
  ('Razorpay / Payment Links',    'Other Tools', 1110)
) AS v(name, "group", sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 4c. AI Tools
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_ai_tools (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('ChatGPT',            0),
  ('Claude',            10),
  ('Google Gemini',     20),
  ('Microsoft Copilot', 30),
  ('Perplexity',        40),
  ('Apollo.io',         50),
  ('Lusha',             60),
  ('Clay',              70),
  ('Gong',              80),
  ('Chorus.ai',         90),
  ('Outreach',         100),
  ('Lavender',         110),
  ('Instantly',        120),
  ('Notion AI',        130),
  ('Otter.ai',         140)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;


-- ============================================================
-- 00086_subscription_card_group_id.sql
-- ============================================================
-- SquadHub fans a multi-tier brief out to one card per tier and sends each to
-- this app via the ingest webhook. They now share a `group_id` (SquadHub's
-- brief_group_id) so the business dashboard can collapse the per-tier siblings
-- into a single card with a tab per tier.
--
-- NULL for single-tier and legacy cards — they render one card each, unchanged.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS group_id UUID;

COMMENT ON COLUMN subscription_cards.group_id IS
  'Shared id across the per-tier sibling cards SquadHub fanned out from one multi-tier brief. The business dashboard collapses cards with the same group_id into one card with a tab per tier. NULL for single-tier / legacy cards.';

CREATE INDEX IF NOT EXISTS subscription_cards_group_id_idx
  ON subscription_cards (group_id)
  WHERE group_id IS NOT NULL;

