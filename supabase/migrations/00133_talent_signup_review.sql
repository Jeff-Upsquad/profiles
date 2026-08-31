-- Talent account review is an ops process, independent of signup.
-- New talent can use the app while approval_status is still pending.
-- Persist a rejection reason when an operator declines a signup.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

COMMENT ON COLUMN talent_users.approval_status IS
  'Ops review of the talent account (pending/approved/rejected). Does not gate login or profile submission; rejected accounts cannot submit profiles.';

UPDATE admin_modules
  SET name = 'Sign-ups'
  WHERE slug = 'approvals';
