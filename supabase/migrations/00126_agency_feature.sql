-- Migration: 00126_agency_feature
-- Description: Agency login + profiles + squad members + job profiles + general portfolio
-- Agency is a new user role similar to Talent. Agencies have a profile, squad members,
-- job profiles linked to squad members, and a general agency portfolio.

-- Extend user_role enum (Postgres: cannot add value inside transaction if used elsewhere, but this is safe)
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agency';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- agency_users (mirrors talent_users)
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  description TEXT,
  website TEXT,
  logo_url TEXT,
  location TEXT,
  approval_status TEXT DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_agency_users_updated_at
  BEFORE UPDATE ON agency_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_users_select_own ON agency_users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY agency_users_select_admin ON agency_users
  FOR SELECT USING (is_admin());
CREATE POLICY agency_users_update_own ON agency_users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY agency_users_insert_own ON agency_users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- agency_profiles (basic agency profile, like talent_profiles_basic)
-- We keep it as one row per agency for simplicity
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE UNIQUE,
  tagline TEXT,
  about TEXT,
  founded_year INTEGER,
  team_size TEXT,
  services TEXT[],
  industries TEXT[],
  location_country TEXT DEFAULT 'India',
  location_state TEXT,
  location_district TEXT,
  location_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_agency_profiles_updated_at
  BEFORE UPDATE ON agency_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agency_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_profiles_select_own ON agency_profiles FOR SELECT USING (auth.uid() = agency_user_id);
CREATE POLICY agency_profiles_select_admin ON agency_profiles FOR SELECT USING (is_admin());
CREATE POLICY agency_profiles_select_business ON agency_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid())
);
CREATE POLICY agency_profiles_insert_own ON agency_profiles FOR INSERT WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_profiles_update_own ON agency_profiles FOR UPDATE USING (auth.uid() = agency_user_id) WITH CHECK (auth.uid() = agency_user_id);

-- ============================================================
-- agency_squad_members (each squad member details similar to talent basic profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_squad_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role_title TEXT,
  email TEXT,
  phone TEXT,
  age INTEGER,
  gender TEXT,
  current_location TEXT,
  languages_spoken JSONB DEFAULT '[]',
  experience_years INTEGER DEFAULT 0,
  experience_months INTEGER DEFAULT 0,
  skills TEXT[] DEFAULT '{}',
  bio TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER set_agency_squad_members_updated_at
  BEFORE UPDATE ON agency_squad_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agency_squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_squad_members_select_own ON agency_squad_members FOR SELECT USING (auth.uid() = agency_user_id);
CREATE POLICY agency_squad_members_select_admin ON agency_squad_members FOR SELECT USING (is_admin());
CREATE POLICY agency_squad_members_select_business ON agency_squad_members FOR SELECT USING (EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid()));
CREATE POLICY agency_squad_members_insert_own ON agency_squad_members FOR INSERT WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_squad_members_update_own ON agency_squad_members FOR UPDATE USING (auth.uid() = agency_user_id) WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_squad_members_delete_own ON agency_squad_members FOR DELETE USING (auth.uid() = agency_user_id);

-- ============================================================
-- agency_member_profiles (job profiles linked to squad members, per category)
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  squad_member_id UUID NOT NULL REFERENCES agency_squad_members(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'draft',
  field_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (squad_member_id, category_id)
);
CREATE TRIGGER set_agency_member_profiles_updated_at
  BEFORE UPDATE ON agency_member_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agency_member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_member_profiles_select_own ON agency_member_profiles FOR SELECT USING (auth.uid() = agency_user_id);
CREATE POLICY agency_member_profiles_select_admin ON agency_member_profiles FOR SELECT USING (is_admin());
CREATE POLICY agency_member_profiles_select_business ON agency_member_profiles FOR SELECT USING (EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid()) AND status = 'approved' AND deleted_at IS NULL);
CREATE POLICY agency_member_profiles_insert_own ON agency_member_profiles FOR INSERT WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_member_profiles_update_own ON agency_member_profiles FOR UPDATE USING (auth.uid() = agency_user_id) WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_member_profiles_delete_own ON agency_member_profiles FOR DELETE USING (auth.uid() = agency_user_id);

-- ============================================================
-- agency_general_portfolios (agency-level portfolio, similar to talent_profiles but general)
-- We create a single general portfolio per agency per category, not tied to a member
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_general_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  status TEXT NOT NULL DEFAULT 'draft',
  field_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (agency_user_id, category_id)
);
CREATE TRIGGER set_agency_general_portfolios_updated_at
  BEFORE UPDATE ON agency_general_portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
ALTER TABLE agency_general_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_general_portfolios_select_own ON agency_general_portfolios FOR SELECT USING (auth.uid() = agency_user_id);
CREATE POLICY agency_general_portfolios_select_admin ON agency_general_portfolios FOR SELECT USING (is_admin());
CREATE POLICY agency_general_portfolios_select_business ON agency_general_portfolios FOR SELECT USING (EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid()) AND status = 'approved' AND deleted_at IS NULL);
CREATE POLICY agency_general_portfolios_insert_own ON agency_general_portfolios FOR INSERT WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_general_portfolios_update_own ON agency_general_portfolios FOR UPDATE USING (auth.uid() = agency_user_id) WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_general_portfolios_delete_own ON agency_general_portfolios FOR DELETE USING (auth.uid() = agency_user_id);

-- ============================================================
-- agency_portfolio_items (unified portfolio items for both member-linked and general)
-- Linked either to a member profile or a general portfolio via polymorphic cols
-- ============================================================
CREATE TABLE IF NOT EXISTS agency_portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  member_profile_id UUID REFERENCES agency_member_profiles(id) ON DELETE CASCADE,
  general_portfolio_id UUID REFERENCES agency_general_portfolios(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_name TEXT,
  category_name TEXT,
  skill_name TEXT,
  provider TEXT,
  external_url TEXT,
  embed_url TEXT,
  thumbnail_url TEXT,
  source_type TEXT DEFAULT 'upload' CHECK (source_type IN ('upload','link')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CHECK (
    (member_profile_id IS NOT NULL AND general_portfolio_id IS NULL)
    OR (member_profile_id IS NULL AND general_portfolio_id IS NOT NULL)
  )
);
ALTER TABLE agency_portfolio_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_portfolio_items_select_own ON agency_portfolio_items FOR SELECT USING (auth.uid() = agency_user_id);
CREATE POLICY agency_portfolio_items_select_admin ON agency_portfolio_items FOR SELECT USING (is_admin());
CREATE POLICY agency_portfolio_items_select_business ON agency_portfolio_items FOR SELECT USING (EXISTS (SELECT 1 FROM business_users WHERE id = auth.uid()));
CREATE POLICY agency_portfolio_items_insert_own ON agency_portfolio_items FOR INSERT WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_portfolio_items_update_own ON agency_portfolio_items FOR UPDATE USING (auth.uid() = agency_user_id) WITH CHECK (auth.uid() = agency_user_id);
CREATE POLICY agency_portfolio_items_delete_own ON agency_portfolio_items FOR DELETE USING (auth.uid() = agency_user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agency_squad_members_agency ON agency_squad_members(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_member_profiles_agency ON agency_member_profiles(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_member_profiles_member ON agency_member_profiles(squad_member_id);
CREATE INDEX IF NOT EXISTS idx_agency_general_portfolios_agency ON agency_general_portfolios(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_portfolio_items_agency ON agency_portfolio_items(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_portfolio_items_member ON agency_portfolio_items(member_profile_id);
CREATE INDEX IF NOT EXISTS idx_agency_portfolio_items_general ON agency_portfolio_items(general_portfolio_id);
