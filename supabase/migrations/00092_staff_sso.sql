-- 00092_staff_sso.sql
-- "Sign in with SquadHub" SSO for the staff portal.
--
-- SquadHub-linked staff have NO local password: they authenticate against
-- SquadHub via redirect SSO, and SquadHire mints its own staff session after a
-- one-time code is exchanged server-to-server. So password_hash becomes
-- nullable, and we record which SquadHub user a staff row maps to.
--
-- Existing password staff are untouched: auth_provider defaults to 'local'.

ALTER TABLE staff_users
  ADD COLUMN auth_provider    TEXT NOT NULL DEFAULT 'local',
  ADD COLUMN squadhub_user_id UUID;

-- SSO users carry no password; local users still must have one (enforced below).
ALTER TABLE staff_users ALTER COLUMN password_hash DROP NOT NULL;

-- At most one staff row per SquadHub user.
CREATE UNIQUE INDEX idx_staff_users_squadhub_user_id
  ON staff_users (squadhub_user_id) WHERE squadhub_user_id IS NOT NULL;

-- Integrity: a 'local' row must have a password; a 'squadhub' row must be linked.
-- Any other auth_provider value fails both branches and is rejected.
ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_auth_consistent_chk CHECK (
    (auth_provider = 'local'    AND password_hash IS NOT NULL) OR
    (auth_provider = 'squadhub' AND squadhub_user_id IS NOT NULL)
  );
