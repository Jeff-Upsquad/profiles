-- Migration: 00090_talent_app_installs
-- Description: Track which talent users have the mobile app installed and which
--   build they are running. `talent_app_installs` holds one current-state row per
--   user (upserted on every app-launch check-in); `talent_app_install_events`
--   appends one row each time a user's version/platform changes, preserving an
--   upgrade history for adoption analysis over time. Written/read server-side via
--   the service-role client (mirrors push_tokens), so no RLS policies are needed.

BEGIN;

CREATE TABLE talent_app_installs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL UNIQUE REFERENCES talent_users(id) ON DELETE CASCADE,
    version_name   TEXT NOT NULL,
    version_code   INTEGER NOT NULL,
    platform       TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_talent_app_installs_last_seen ON talent_app_installs(last_seen_at DESC);
CREATE INDEX idx_talent_app_installs_version ON talent_app_installs(version_code);

CREATE TABLE talent_app_install_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    version_name   TEXT NOT NULL,
    version_code   INTEGER NOT NULL,
    platform       TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_talent_app_install_events_user ON talent_app_install_events(user_id, created_at DESC);
CREATE INDEX idx_talent_app_install_events_version ON talent_app_install_events(version_code, created_at DESC);

COMMIT;
