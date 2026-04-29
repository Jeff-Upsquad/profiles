-- ============================================================
-- Allow system-generated invitations (auto-invites on auto-approval)
-- to omit invited_by, since they are not initiated by an admin.
-- ============================================================

ALTER TABLE invitations
  ALTER COLUMN invited_by DROP NOT NULL;
