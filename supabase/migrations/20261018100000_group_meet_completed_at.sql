-- Stamp when a Group Meet is auto-completed past its end time, mirroring
-- cancelled_at. The completion sweeper uses it to free the card's one-live-
-- meeting slot and close the SquadUp room.

ALTER TABLE group_meets
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
