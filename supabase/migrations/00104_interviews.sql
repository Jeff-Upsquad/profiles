-- =============================================================
-- Jobs module — interview rounds + FIFO queue
-- =============================================================
-- interview_rounds: a scheduled interview day/window for a card (multiple
-- rounds per card supported via round_no). capacity = floor(window /
-- minutes_per_interview), computed server-side and stored.
--
-- interview_invites: one row per invited candidate per round. Lifecycle:
--   rsvp invited -> accepted|declined            (talent answers the call)
--   T-10min cron opens the confirm window        (confirm_opened_at)
--   confirm -> FIFO ticket via confirm_seq       (queued | waitlisted)
--   business console: showed_up -> start (link reveal) -> outcome
--   no_show / not_joined -> waitlist promotion.
--
-- meeting_link is NEVER serialized to a talent until their own invite has
-- started_at set (reveal-on-start; enforced at the serializer level).
--
-- Queue atomicity lives in two SECURITY DEFINER functions called via
-- supabaseAdmin.rpc() — the supabase-js client has no transactions, so all
-- confirms/promotions for a round serialize on the round row lock.
-- =============================================================

CREATE TABLE interview_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('virtual','physical')),
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  minutes_per_interview INTEGER NOT NULL CHECK (minutes_per_interview > 0),
  capacity INTEGER NOT NULL,              -- floor((window_end-window_start)/minutes); server-computed
  queue_seq BIGINT NOT NULL DEFAULT 0,    -- monotonic ticket source (bumped under round row lock)
  meeting_provider TEXT CHECK (meeting_provider IN ('meet','zoom','teams','other')),
  meeting_link TEXT,
  location_id UUID REFERENCES business_locations(id) ON DELETE SET NULL,
  location_snapshot JSONB,                -- {label,address,maps_url} frozen at schedule time
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  day_before_notified_at TIMESTAMPTZ,     -- cron stamp (T-24h)
  confirm_opened_at TIMESTAMPTZ,          -- cron stamp (T-10min)
  created_by TEXT NOT NULL DEFAULT 'business' CHECK (created_by IN ('business','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (window_end > window_start)
);

CREATE INDEX interview_rounds_card_idx     ON interview_rounds (card_id, window_start);
CREATE INDEX interview_rounds_sweeper_idx  ON interview_rounds (window_start) WHERE status = 'scheduled';

CREATE TRIGGER trg_interview_rounds_updated_at
  BEFORE UPDATE ON interview_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE interview_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES interview_rounds(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES job_candidates(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  rsvp TEXT NOT NULL DEFAULT 'invited' CHECK (rsvp IN ('invited','accepted','declined')),
  rsvp_at TIMESTAMPTZ,
  queue_status TEXT NOT NULL DEFAULT 'none'
    CHECK (queue_status IN ('none','queued','waitlisted','in_progress','done',
                            'no_show','not_joined','removed')),
  confirm_seq BIGINT,                     -- FIFO ticket; assigned once, never reused
  confirmed_at TIMESTAMPTZ,               -- the T-10 "I'm available" tap
  promoted_at TIMESTAMPTZ,                -- waitlist -> queued on a no-show
  showed_up_at TIMESTAMPTZ,               -- business marks arrival / lobby join
  started_at TIMESTAMPTZ,                 -- business "Start Interview" -> link revealed to THIS candidate
  completed_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('selected','rejected','on_hold')),
  outcome_at TIMESTAMPTZ,
  no_show_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, candidate_id)
);

CREATE INDEX interview_invites_fifo_idx
  ON interview_invites (round_id, confirm_seq)
  WHERE queue_status IN ('queued','waitlisted');
CREATE INDEX interview_invites_talent_idx ON interview_invites (talent_user_id, created_at DESC);

CREATE TRIGGER trg_interview_invites_updated_at
  BEFORE UPDATE ON interview_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Atomic T-10 confirm: serialize on the round row, assign the next FIFO
-- ticket, split queued/waitlisted by remaining capacity. Idempotent on
-- re-tap (returns the existing ticket).
CREATE OR REPLACE FUNCTION confirm_interview_attendance(p_invite_id UUID)
RETURNS TABLE (out_seq BIGINT, out_queue_status TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite interview_invites%ROWTYPE;
  v_round  interview_rounds%ROWTYPE;
  v_occupied INTEGER;
  v_status TEXT;
BEGIN
  SELECT * INTO v_invite FROM interview_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  -- Lock the ROUND first: all confirms for one round serialize here.
  SELECT * INTO v_round FROM interview_rounds WHERE id = v_invite.round_id FOR UPDATE;
  IF v_round.status NOT IN ('scheduled','in_progress') THEN RAISE EXCEPTION 'round_closed'; END IF;

  SELECT * INTO v_invite FROM interview_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.rsvp <> 'accepted' THEN RAISE EXCEPTION 'rsvp_not_accepted'; END IF;
  IF v_invite.confirmed_at IS NOT NULL THEN          -- idempotent replay
    RETURN QUERY SELECT v_invite.confirm_seq, v_invite.queue_status;
    RETURN;
  END IF;

  SELECT count(*) INTO v_occupied FROM interview_invites
    WHERE round_id = v_round.id AND queue_status IN ('queued','in_progress','done');

  UPDATE interview_rounds SET queue_seq = queue_seq + 1
    WHERE id = v_round.id RETURNING queue_seq INTO v_round.queue_seq;

  v_status := CASE WHEN v_occupied < v_round.capacity THEN 'queued' ELSE 'waitlisted' END;

  UPDATE interview_invites SET
      confirm_seq = v_round.queue_seq,
      confirmed_at = now(),
      queue_status = v_status
    WHERE id = p_invite_id;

  RETURN QUERY SELECT v_round.queue_seq, v_status;
END $$ LANGUAGE plpgsql;

-- Atomic no-show/not-joined + waitlist promotion. Returns the promoted
-- invite id (or NULL) so the caller can notify the promoted talent.
CREATE OR REPLACE FUNCTION mark_absent_and_promote(
  p_invite_id UUID,
  p_kind TEXT  -- 'no_show' | 'not_joined'
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id UUID;
  v_promoted UUID;
BEGIN
  IF p_kind NOT IN ('no_show','not_joined') THEN RAISE EXCEPTION 'invalid_kind'; END IF;

  SELECT round_id INTO v_round_id FROM interview_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  PERFORM 1 FROM interview_rounds WHERE id = v_round_id FOR UPDATE;   -- serialize with confirms

  UPDATE interview_invites SET queue_status = p_kind, no_show_at = now()
    WHERE id = p_invite_id AND queue_status IN ('queued','in_progress');
  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE interview_invites SET queue_status = 'queued', promoted_at = now()
    WHERE id = (SELECT id FROM interview_invites
                WHERE round_id = v_round_id AND queue_status = 'waitlisted'
                ORDER BY confirm_seq LIMIT 1)
    RETURNING id INTO v_promoted;

  RETURN v_promoted;
END $$ LANGUAGE plpgsql;

ALTER TABLE interview_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_invites ENABLE ROW LEVEL SECURITY;
