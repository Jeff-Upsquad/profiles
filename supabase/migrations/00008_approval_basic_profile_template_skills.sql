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
