-- Business card alerts, staged ladder (00151, extends 00150).
--
-- 00150 had one rule: send, then stay quiet until the business opens the card.
-- That fired on the very first acceptance and always reported a count of 1,
-- because the count was taken the instant the first talent responded.
--
-- The ladder replaces it with three stages a card walks down once and never
-- climbs back up:
--
--   Stage 1  first acceptance from each GROUP (junior / pro / top_talents /
--            other / agency) sends immediately. One shot per group per card —
--            the business hears straight away when a given calibre shows up.
--   Stage 2  30 minutes after the FIRST acceptance, one roll-up with the real
--            total, but only if more arrived than stage 1 already announced.
--   Stage 3  everything after: silent until the business opens the card, which
--            re-arms; the next new acceptance sends. Capped (00150's
--            armed/sends_used columns, unchanged).
--
-- Bids never enter stages 1–2; their row keeps rollup_sent_at NULL and is
-- exempted by kind in claim_business_card_alert.

ALTER TABLE business_card_alert_state
  -- Groups whose first-acceptance message has already been spent.
  ADD COLUMN IF NOT EXISTS groups_notified TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_event_at TIMESTAMPTZ,
  -- When the stage-2 roll-up becomes due; NULL once it has been settled.
  ADD COLUMN IF NOT EXISTS rollup_due_at TIMESTAMPTZ,
  -- Set when stage 2 is settled — whether or not a message actually went out.
  -- This is the gate that opens stage 3.
  ADD COLUMN IF NOT EXISTS rollup_sent_at TIMESTAMPTZ;

-- Sweeper lookup: due, not yet settled.
CREATE INDEX IF NOT EXISTS business_card_alert_state_rollup_due_idx
  ON business_card_alert_state (rollup_due_at)
  WHERE rollup_due_at IS NOT NULL AND rollup_sent_at IS NULL;

-- Agencies accept into their own table. Give it the same "business has looked
-- at this" marker the talent side has, so agency acceptances can be counted as
-- unseen and cleared when the business reviews the card.
ALTER TABLE agency_card_recipients
  ADD COLUMN IF NOT EXISTS business_seen_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Stage 1 — claim a group's one-shot instant alert
-- ---------------------------------------------------------------------------
-- Also starts the stage-2 timer on the first acceptance of any group.
-- Returns 1 when this call owns the group's message, 0 + reason otherwise.
CREATE OR REPLACE FUNCTION claim_business_card_group_alert(
  p_card_id UUID,
  p_business_user_id UUID,
  p_kind TEXT,
  p_group TEXT,
  p_rollup_minutes INT
) RETURNS TABLE (out_claimed INT, out_reason TEXT)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state business_card_alert_state%ROWTYPE;
BEGIN
  INSERT INTO business_card_alert_state (card_id, business_user_id, kind)
  VALUES (p_card_id, p_business_user_id, p_kind)
  ON CONFLICT (card_id, kind) DO NOTHING;

  SELECT * INTO v_state
  FROM business_card_alert_state
  WHERE card_id = p_card_id AND kind = p_kind
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, 'state_missing'::TEXT;
    RETURN;
  END IF;

  -- First acceptance on this card starts the roll-up clock.
  IF v_state.first_event_at IS NULL THEN
    UPDATE business_card_alert_state
    SET first_event_at = now(),
        rollup_due_at = now() + make_interval(mins => p_rollup_minutes),
        updated_at = now()
    WHERE id = v_state.id;
  END IF;

  -- Past stage 2 — the ladder has moved on, stage 3 owns this card now.
  IF v_state.rollup_sent_at IS NOT NULL THEN
    RETURN QUERY SELECT 0::INT, 'ladder_past_stage_one'::TEXT;
    RETURN;
  END IF;

  IF p_group = ANY(v_state.groups_notified) THEN
    RETURN QUERY SELECT 0::INT, 'group_already_notified'::TEXT;
    RETURN;
  END IF;

  UPDATE business_card_alert_state
  SET groups_notified = array_append(groups_notified, p_group),
      last_sent_at = now(),
      updated_at = now()
  WHERE id = v_state.id;

  RETURN QUERY SELECT 1::INT, NULL::TEXT;
END $$ LANGUAGE plpgsql;

-- Stage 1 delivery failed — give the group's shot back.
CREATE OR REPLACE FUNCTION release_business_card_group_alert(
  p_card_id UUID,
  p_kind TEXT,
  p_group TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE business_card_alert_state
  SET groups_notified = array_remove(groups_notified, p_group),
      updated_at = now()
  WHERE card_id = p_card_id AND kind = p_kind;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Stage 2 — settle the roll-up
-- ---------------------------------------------------------------------------
-- Stamps rollup_sent_at unconditionally (that is what opens stage 3) and hands
-- back how many groups stage 1 already announced, so the caller can decide
-- whether there is anything NEW worth a message.
CREATE OR REPLACE FUNCTION claim_business_card_rollup(
  p_card_id UUID,
  p_kind TEXT
) RETURNS TABLE (out_claimed INT, out_announced INT)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state business_card_alert_state%ROWTYPE;
BEGIN
  SELECT * INTO v_state
  FROM business_card_alert_state
  WHERE card_id = p_card_id
    AND kind = p_kind
    AND rollup_due_at IS NOT NULL
    AND rollup_sent_at IS NULL
    AND rollup_due_at <= now()
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, 0::INT;
    RETURN;
  END IF;

  UPDATE business_card_alert_state
  SET rollup_sent_at = now(),
      last_sent_at = now(),
      updated_at = now()
  WHERE id = v_state.id;

  RETURN QUERY SELECT 1::INT, COALESCE(array_length(v_state.groups_notified, 1), 0)::INT;
END $$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Stage 3 — gate behind the roll-up
-- ---------------------------------------------------------------------------
-- Same as 00150 plus one rule: an 'acceptance' card cannot reach stage 3 until
-- its roll-up has been settled. Bids are exempt (they never set rollup_due_at).
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

  SELECT * INTO v_state
  FROM business_card_alert_state
  WHERE card_id = p_card_id AND kind = p_kind
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INT, 'state_missing'::TEXT;
    RETURN;
  END IF;

  IF p_kind = 'acceptance' AND v_state.rollup_sent_at IS NULL THEN
    RETURN QUERY SELECT 0::INT, 'awaiting_rollup'::TEXT;
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
