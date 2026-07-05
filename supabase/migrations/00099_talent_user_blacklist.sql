-- Talent blacklist as a first-class, queryable column.
--
-- Mirrors talent_users.suspended (see 00095): an admin-controlled block on NEW
-- opportunities (subscription/assignment/hiring cards), enforced in SQL by the
-- subscription matcher, manual assignment, and admin selection paths. A
-- blacklisted talent keeps their existing engagements but must receive NO new
-- opportunities. Independent of `suspended`, `is_active` (visibility) and
-- approval_status (vetting) — a separate, sterner-labeled flag. Does not ban
-- login.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS blacklisted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blacklisted_reason TEXT;

COMMENT ON COLUMN talent_users.blacklisted IS
  'Admin-controlled block on NEW opportunities (subscription/assignment/hiring cards). Existing engagements are untouched. Independent of suspended, is_active and approval_status. Does not ban login.';

-- Fan-out matcher filters on this; most talents are not blacklisted, so a
-- partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_talent_users_blacklisted
  ON talent_users (id) WHERE blacklisted = true;
