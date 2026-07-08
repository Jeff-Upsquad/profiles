-- =============================================================
-- Jobs module — outbound event outbox (Profiles -> SquadHub)
-- =============================================================
-- Generalizes the per-row callback columns of 00024 to N event types: the
-- mutating request writes an outbox row, delivers inline once, and the
-- outbox sweeper retries failures (5-min tick, batch 50, max 10 attempts —
-- same constants as the accept/reject callback sweeper).
--
-- dedupe_key makes re-emits idempotent (e.g. 'offer_sent:<offer_id>').
-- Events post to SQUADHUB_JOBS_EVENTS_URL as a single envelope:
--   { event, external_id, job_profile_external_id, recipient_id,
--     candidate_id, actor, occurred_at, data }
-- =============================================================

CREATE TABLE squadhub_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  dedupe_key TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX squadhub_event_outbox_pending_idx
  ON squadhub_event_outbox (created_at) WHERE delivered_at IS NULL;

ALTER TABLE squadhub_event_outbox ENABLE ROW LEVEL SECURITY;
