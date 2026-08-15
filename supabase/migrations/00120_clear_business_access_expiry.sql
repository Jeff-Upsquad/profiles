-- Business accounts no longer expire. Clear every access window so existing
-- users can sign in without requesting renewal. access_expires_at stays on
-- the table so historical rows remain valid; it is just unused going forward.

UPDATE business_users
SET access_expires_at = NULL,
    access_requested_at = NULL
WHERE access_expires_at IS NOT NULL
   OR access_requested_at IS NOT NULL;
