-- Talent suspension as a first-class, queryable column.
--
-- The old suspend action only wrote `suspended` into auth.users
-- raw_user_meta_data, where no domain query (subscription matcher, manual
-- assignment, admin selection) could see it — so "suspended" users kept
-- receiving new subscription/assignment/hiring offers. Moving the flag onto
-- talent_users makes it enforceable in SQL. Independent of is_active
-- (visibility) and approval_status (vetting): a suspended talent keeps their
-- existing engagements but must receive NO new opportunities.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

COMMENT ON COLUMN talent_users.suspended IS
  'Admin-controlled block on NEW opportunities (subscription/assignment/hiring cards). Existing engagements are untouched. Independent of is_active and approval_status.';

-- Fan-out matcher filters on this; most talents are not suspended, so a
-- partial index keeps it cheap.
CREATE INDEX IF NOT EXISTS idx_talent_users_suspended
  ON talent_users (id) WHERE suspended = true;

-- Backfill: honor suspensions previously recorded only in auth metadata.
UPDATE talent_users tu
SET suspended = true,
    suspended_at = COALESCE(tu.suspended_at, now())
FROM auth.users au
WHERE au.id = tu.id
  AND (au.raw_user_meta_data ->> 'suspended')::boolean IS TRUE
  AND tu.suspended = false;
