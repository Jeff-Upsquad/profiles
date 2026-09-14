-- Stamp so the start-time Join notice is sent once per Group Meet.
ALTER TABLE group_meets
  ADD COLUMN IF NOT EXISTS join_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS group_meets_join_notify_idx
  ON group_meets (starts_at)
  WHERE join_notified_at IS NULL AND status IN ('scheduled', 'rescheduled');
