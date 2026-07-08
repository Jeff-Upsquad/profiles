-- The candidate/user activity timeline queries automation_events by
-- talent_user_id (for the user-profile entry point) in addition to the existing
-- lead_id path. lead_id is already indexed (00056); add the matching index for
-- talent_user_id so per-user timeline reads stay fast as the event log grows.

CREATE INDEX IF NOT EXISTS idx_automation_events_talent
  ON automation_events (talent_user_id, created_at DESC);
