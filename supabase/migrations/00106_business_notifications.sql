-- =============================================================
-- Jobs module — business in-app notification channel (net-new)
-- =============================================================
-- Business users had no notifications surface. Deliberately NOT reusing
-- notifications/notification_recipients (00074) — those FK to talent_users
-- and carry admin-broadcast semantics. This is a simple per-business-user
-- inbox written by the jobs services (candidate applied, question asked,
-- RSVP, offer responses, ...).
-- =============================================================

CREATE TABLE business_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- 'job_candidate_applied','job_question_asked','job_offer_response',...
  title TEXT NOT NULL,
  body TEXT,
  ref JSONB NOT NULL DEFAULT '{}',   -- {card_id, candidate_id, round_id, offer_id, question_id, route}
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX business_notifications_inbox_idx
  ON business_notifications (business_user_id, created_at DESC);
CREATE INDEX business_notifications_unread_idx
  ON business_notifications (business_user_id) WHERE read_at IS NULL;

ALTER TABLE business_notifications ENABLE ROW LEVEL SECURITY;
