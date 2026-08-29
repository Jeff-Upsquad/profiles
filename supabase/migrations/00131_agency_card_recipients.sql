-- Migration: 00131_agency_card_recipients
-- Agency-side mirror of subscription_card_recipients. Powers the agency
-- requirement-card feed (subscriptions / assignments / hiring) and the
-- backfill that makes existing cards visible to newly signed-up agencies.

CREATE TABLE IF NOT EXISTS agency_card_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  responded_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  callback_delivered_at TIMESTAMPTZ,
  callback_attempts INT NOT NULL DEFAULT 0,
  callback_last_error TEXT,
  selected_at TIMESTAMPTZ,
  passed_over_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: one active row per (card, agency). Cancelled rows stay as audit.
CREATE UNIQUE INDEX IF NOT EXISTS agency_card_recipients_card_agency_active_idx
  ON agency_card_recipients (card_id, agency_user_id) WHERE cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS agency_card_recipients_agency_status_idx
  ON agency_card_recipients (agency_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS agency_card_recipients_card_idx
  ON agency_card_recipients (card_id);

CREATE TRIGGER set_agency_card_recipients_updated_at
  BEFORE UPDATE ON agency_card_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE agency_card_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_card_recipients_select_own ON agency_card_recipients
  FOR SELECT USING (auth.uid() = agency_user_id);

CREATE POLICY agency_card_recipients_update_own ON agency_card_recipients
  FOR UPDATE USING (auth.uid() = agency_user_id)
  WITH CHECK (auth.uid() = agency_user_id AND status IN ('accepted','rejected'));

CREATE POLICY agency_card_recipients_select_admin ON agency_card_recipients
  FOR SELECT USING (is_admin());

-- No INSERT/DELETE policies: writes go through service_role backend only.
