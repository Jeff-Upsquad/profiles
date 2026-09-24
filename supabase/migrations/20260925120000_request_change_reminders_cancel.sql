-- Request-change reminders + auto-cancel.
--
-- While a talent has an open "request changes" ask (basic or job profile) the
-- reminder sweeper walks them through: reminder → reminder → final warning →
-- cancelled. rc_* track where they are in that sequence; rc_anchor_at is the
-- changes_requested_at of the oldest open ask, so a fresh request (after the
-- previous one was resolved) starts a new sequence.
ALTER TABLE public.talent_users
  ADD COLUMN IF NOT EXISTS rc_anchor_at timestamptz,
  ADD COLUMN IF NOT EXISTS rc_reminders_sent smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rc_last_sent_at timestamptz,
  -- Cancelled applicants live in Exceptions → Cancelled Applicants and are
  -- locked out of everything but Contact Support until an admin restores them.
  ADD COLUMN IF NOT EXISTS application_cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS application_cancelled_reason text;

CREATE INDEX IF NOT EXISTS talent_users_application_cancelled_idx
  ON public.talent_users (application_cancelled_at)
  WHERE application_cancelled_at IS NOT NULL;
