-- Migration: 00132_agency_card_offers
-- Agency accept/decline/bid parity with talent. `respond` on agency_card_recipients
-- covers accept/decline (recipients already carry status). This table adds the
-- negotiation thread for agency bidding on assignment-style cards, mirroring
-- `assignment_offers` but keyed to agency_card_recipients + agency_users.

CREATE TABLE IF NOT EXISTS agency_card_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES agency_card_recipients(id) ON DELETE CASCADE,
  agency_user_id UUID NOT NULL REFERENCES agency_users(id) ON DELETE CASCADE,
  pricing_mode TEXT NOT NULL DEFAULT 'priced'
    CHECK (pricing_mode IN ('priced','unpriced')),
  current_amount JSONB NOT NULL DEFAULT '{}',
  current_terms JSONB,
  status TEXT NOT NULL DEFAULT 'pending_business'
    CHECK (status IN ('pending_business','pending_talent','accepted','declined','withdrawn','expired')),
  opened_by TEXT NOT NULL DEFAULT 'agency'
    CHECK (opened_by IN ('agency','business','admin')),
  last_actor_side TEXT
    CHECK (last_actor_side IN ('agency','business','admin')),
  expires_on DATE,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live offer per recipient (terminal history rows excluded).
CREATE UNIQUE INDEX agency_card_offers_one_open_per_recipient
  ON agency_card_offers (recipient_id)
  WHERE status IN ('pending_business','pending_talent','accepted');
CREATE INDEX agency_card_offers_card_idx ON agency_card_offers (card_id, status);
CREATE INDEX agency_card_offers_agency_idx ON agency_card_offers (agency_user_id, created_at DESC);

CREATE TRIGGER trg_agency_card_offers_updated_at
  BEFORE UPDATE ON agency_card_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS agency_card_offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES agency_card_offers(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('business','agency','admin','system')),
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('submitted','countered','accepted',
    'declined','withdrawn','expired','question_asked','question_answered')),
  amount JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX agency_card_offer_events_offer_idx ON agency_card_offer_events (offer_id, created_at);

ALTER TABLE agency_card_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_card_offer_events ENABLE ROW LEVEL SECURITY;