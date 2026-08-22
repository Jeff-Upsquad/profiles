-- Migration: 00124_squadhub_talent_sso_codes
-- Description: One-time authorization codes for "Open SquadHub" auto-login on
--   the TALENT side — the twin of squadhub_business_sso_codes (00123).
--
--   Kept as its own table rather than a subject_type column on the business
--   one: a code minted for a talent must never be redeemable at the business
--   endpoint or vice versa, and separate tables make that structural instead of
--   a condition someone can forget. Same reasoning as the separate jobs and
--   card event outboxes.
--
--   category_slug is snapshotted at mint time because it decides the talent's
--   role on the SquadHub side (designer → Designer, video-editor → Video
--   Editor, designer-editor → Designer + Editor, accountant → Accountant,
--   sales → Sales). Snapshotting means redemption is one round-trip and the
--   role can't shift under a code that's already in flight.

CREATE TABLE IF NOT EXISTS squadhub_talent_sso_codes (
    code            TEXT PRIMARY KEY,
    talent_user_id  UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    name            TEXT,
    phone           TEXT,
    category_slug   TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    consumed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_squadhub_talent_sso_codes_expires
    ON squadhub_talent_sso_codes (expires_at);

-- RLS: only the backend touches this table, with the service role (which
-- bypasses RLS). A live code is a sign-in credential, so no policy is granted
-- to anon/authenticated.
ALTER TABLE squadhub_talent_sso_codes ENABLE ROW LEVEL SECURITY;
