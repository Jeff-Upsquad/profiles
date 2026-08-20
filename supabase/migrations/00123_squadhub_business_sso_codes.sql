-- Migration: 00123_squadhub_business_sso_codes
-- Description: One-time authorization codes for "Open SquadHub" auto-login.
--   SquadHire is the identity provider here (the mirror of squadhire_sso_codes
--   on the SquadHub side, where SquadHub is the IdP for our /staff portal).
--
--   A signed-in business user taps "Log in via website" on the SquadHub tab; we
--   mint a short-lived, single-use opaque code and send the browser to
--   SquadHub with it. SquadHub redeems the code server-to-server (shared
--   secret) for the business's identity and starts their session — so the
--   business never types a second set of credentials for an account we already
--   created for them.
--
--   Codes are single-use (consumed_at stamped on redemption) and expire in
--   minutes; the identity is snapshotted at mint time so redemption is one
--   round-trip.

CREATE TABLE IF NOT EXISTS squadhub_business_sso_codes (
    code             TEXT PRIMARY KEY,
    business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
    email            TEXT NOT NULL,
    name             TEXT,
    company_name     TEXT,
    phone            TEXT,
    expires_at       TIMESTAMPTZ NOT NULL,
    consumed_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sweep target: expired/consumed codes are dead weight, nothing reads them.
CREATE INDEX IF NOT EXISTS idx_squadhub_business_sso_codes_expires
    ON squadhub_business_sso_codes (expires_at);

-- RLS: only the backend touches this table, with the service role (which
-- bypasses RLS). A live code is a sign-in credential, so no policy is granted
-- to anon/authenticated — nobody reads it through PostgREST.
ALTER TABLE squadhub_business_sso_codes ENABLE ROW LEVEL SECURITY;
