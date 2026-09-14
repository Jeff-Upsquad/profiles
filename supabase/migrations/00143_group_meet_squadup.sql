-- Move Group Meet from externally supplied meeting URLs to SquadUp rooms.
-- Media is handled by LiveKit; Profiles owns scheduling, authorization,
-- RSVP state, room membership, and the persistent message thread.

ALTER TABLE group_meets
  DROP CONSTRAINT IF EXISTS group_meets_provider_check;

ALTER TABLE group_meets
  ADD CONSTRAINT group_meets_provider_check
  CHECK (provider IN ('squadup','meet','zoom','teams','other'));

ALTER TABLE group_meets
  ADD COLUMN IF NOT EXISTS room_name TEXT,
  ADD COLUMN IF NOT EXISTS room_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS room_ended_at TIMESTAMPTZ;

UPDATE group_meets
SET room_name = 'group-meet-' || replace(id::text, '-', '')
WHERE room_name IS NULL;

ALTER TABLE group_meets
  ALTER COLUMN room_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS group_meets_room_name_uniq
  ON group_meets (room_name);

ALTER TABLE group_meet_members
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ;

-- Existing scheduled fixtures become internal SquadUp rooms as well.
UPDATE group_meets
SET provider = 'squadup',
    meeting_link = '/group-meet/' || id::text
WHERE status IN ('scheduled', 'rescheduled');
