-- Business WhatsApp card alerts (00150).
--
-- Business owners get a WhatsApp nudge when talents start responding to a card
-- they published — acceptances/applications on one side, priced bids on the
-- other. The point is a NUDGE, not a feed: one message per "round", where a
-- round ends when the business actually opens the card. Once they've looked,
-- the next new response re-arms the alert. Capped at MAX sends per card+kind so
-- a busy card can never turn into a WhatsApp firehose.
--
-- State is per (card_id, kind) rather than per recipient, because the alert
-- speaks about the card ("3 talents are waiting for your review"), not about a
-- single talent.

-- Per-business opt-out. Default ON: businesses that published a card asked for
-- responses, so the nudge is expected. Flipping this off silences every card
-- alert for that business without touching in-app notifications.
ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS whatsapp_card_alerts_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS business_card_alert_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  -- 'acceptance' = talents accepted / candidates applied.
  -- 'bid'        = talents named a price / candidates opened a negotiation.
  kind TEXT NOT NULL CHECK (kind IN ('acceptance', 'bid')),
  -- How many WhatsApp nudges this card+kind has already spent (hard cap).
  sends_used INT NOT NULL DEFAULT 0,
  -- true  = the next qualifying event may send.
  -- false = a nudge is outstanding; wait until the business opens the card.
  armed BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (card_id, kind)
);

CREATE INDEX IF NOT EXISTS business_card_alert_state_business_idx
  ON business_card_alert_state (business_user_id);

-- Service-role only, like the rest of the jobs/cards tables: all access goes
-- through Express. RLS on with no policies keeps anon/user JWTs out.
ALTER TABLE business_card_alert_state ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_business_card_alert_state_updated_at ON business_card_alert_state;
CREATE TRIGGER trg_business_card_alert_state_updated_at
  BEFORE UPDATE ON business_card_alert_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Atomic send claim
-- ---------------------------------------------------------------------------
-- Several talents can accept the same card within milliseconds, and each
-- acceptance runs its own fire-and-forget notify. Claiming the send slot in one
-- statement (disarm + increment under a row lock) is what collapses that burst
-- into a single WhatsApp instead of N.
--
-- Returns the send number on success (1..p_max_sends), or 0 with a reason when
-- the alert is not allowed to fire right now.
CREATE OR REPLACE FUNCTION claim_business_card_alert(
  p_card_id UUID,
  p_business_user_id UUID,
  p_kind TEXT,
  p_max_sends INT,
  p_cooldown_seconds INT
) RETURNS TABLE (out_send_number INT, out_reason TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state business_card_alert_state%ROWTYPE;
BEGIN
  INSERT INTO business_card_alert_state (card_id, business_user_id, kind)
  VALUES (p_card_id, p_business_user_id, p_kind)
  ON CONFLICT (card_id, kind) DO NOTHING;

  -- FOR UPDATE serializes concurrent claims on the same card+kind.
  SELECT * INTO v_state
  FROM business_card_alert_state
  WHERE card_id = p_card_id AND kind = p_kind
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, 'state_missing'::TEXT;
    RETURN;
  END IF;

  IF v_state.sends_used >= p_max_sends THEN
    RETURN QUERY SELECT 0::INT, 'max_sends_reached'::TEXT;
    RETURN;
  END IF;

  IF NOT v_state.armed THEN
    RETURN QUERY SELECT 0::INT, 'awaiting_business_view'::TEXT;
    RETURN;
  END IF;

  -- Floor between two nudges even when the business views the card the instant
  -- one lands. Does NOT spend a send slot, so the next event still notifies.
  IF v_state.last_sent_at IS NOT NULL
     AND v_state.last_sent_at > now() - make_interval(secs => p_cooldown_seconds) THEN
    RETURN QUERY SELECT 0::INT, 'cooldown'::TEXT;
    RETURN;
  END IF;

  UPDATE business_card_alert_state
  SET armed = false,
      sends_used = sends_used + 1,
      last_sent_at = now(),
      updated_at = now()
  WHERE id = v_state.id;

  RETURN QUERY SELECT (v_state.sends_used + 1)::INT, NULL::TEXT;
END $$ LANGUAGE plpgsql;

-- Delivery failed after the slot was claimed — hand it back so a later
-- acceptance still gets its nudge.
CREATE OR REPLACE FUNCTION release_business_card_alert(
  p_card_id UUID,
  p_kind TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE business_card_alert_state
  SET armed = true,
      sends_used = GREATEST(sends_used - 1, 0),
      last_sent_at = NULL,
      updated_at = now()
  WHERE card_id = p_card_id AND kind = p_kind;
END $$ LANGUAGE plpgsql;
