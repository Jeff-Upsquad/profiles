-- Migration: 00111_business_password_auth
-- Description: Give business users real password accounts.
--   * Adds password columns to business_users.
--   * Existing business users predate passwords, so they are grandfathered onto
--     the passwordless path (password_required = false). Every NEW row goes on
--     the password track via the column default (password_required = true), so
--     provisioned / invited users must set a password on first login.
--   * Relaxes the email NOT NULL on invitations + business_users so a business
--     user can be invited / provisioned with only a phone number.

-- ── 1. Password columns on business_users ──────────────────────────────────
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE business_users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE business_users
    ADD COLUMN IF NOT EXISTS password_required BOOLEAN NOT NULL DEFAULT true;

-- ── 2. Grandfather existing users onto passwordless login ──────────────────
-- Runs once inside this migration's transaction, so it touches exactly the
-- rows that existed before this change; anything created afterwards keeps the
-- default (true) and must set a password.
UPDATE business_users SET password_required = false;

-- ── 3. Allow phone-only invites / business users (email becomes optional) ──
ALTER TABLE business_users ALTER COLUMN contact_email DROP NOT NULL;
ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL;
