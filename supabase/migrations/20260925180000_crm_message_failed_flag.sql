-- Onboarding hub flag: a WhatsApp message the CRM tried to send this talent
-- failed (24-hour window closed, template not approved, Meta rejected it, or a
-- technical error). The SquadHire CRM posts a `message_failed` event to the
-- CRM webhook; the latest failure is kept here until an admin dismisses it.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS crm_message_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS crm_message_failed_template TEXT,
  ADD COLUMN IF NOT EXISTS crm_message_failed_reason TEXT;

COMMENT ON COLUMN talent_users.crm_message_failed_at IS
  'Latest failed CRM WhatsApp send to this talent. NULL = none open (or dismissed).';
