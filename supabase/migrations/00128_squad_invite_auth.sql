-- Migration: 00128_squad_invite_auth
-- Adds invite/auth columns to agency_squad_members for squad member & manager flow
-- Squad members can be created directly by agency OR via invite (email + password)
-- They get a limited dashboard (basic profile + job profiles) and are restricted to agency's service categories

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'squad_member';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'squad_manager';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE agency_squad_members
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('invited','active','inactive')),
  ADD COLUMN IF NOT EXISTS invite_email TEXT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'member' CHECK (role_type IN ('member','manager')),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- For quick lookup by invite email
CREATE INDEX IF NOT EXISTS idx_agency_squad_members_invite_email ON agency_squad_members(invite_email);
CREATE INDEX IF NOT EXISTS idx_agency_squad_members_auth_user ON agency_squad_members(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_agency_squad_members_status ON agency_squad_members(status);
