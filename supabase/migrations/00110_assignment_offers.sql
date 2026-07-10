-- =============================================================
-- Assignments module — offer + counter-offer negotiation
-- =============================================================
-- Assignment cards (subscription_cards.card_type='assignment') are broadcast
-- to talents in two modes (assignment_details.pricing_mode):
--   'priced'   — the card carries a price; a talent accepts/declines it via the
--                existing recipient respond(). COUNTERING opens an offer row.
--   'unpriced' — no price; the talent's only way in is to SUBMIT an offer,
--                which opens an offer row.
--
-- Negotiation is UNLIMITED-round (unlike jobs' one-shot final counter): the
-- offer bounces between the two turn states until someone accepts / declines.
--   (talent submit / counter)   -> pending_business
--   (business / admin counter)  -> pending_talent
--   (either side accept)        -> accepted   [terminal -> recipient selected]
--   (decline / withdraw / expire) -> declined | withdrawn | expired [terminal]
--
-- One LIVE offer per recipient (history rows stay terminal). Profiles is
-- canonical; SquadHub admin reads it live via a signed snapshot and can drive
-- the business-side transitions via signed proxy (actor source='squadhub').
-- =============================================================

CREATE TABLE assignment_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES subscription_card_recipients(id) ON DELETE CASCADE,
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  business_user_id UUID REFERENCES business_users(id) ON DELETE SET NULL,
  pricing_mode TEXT NOT NULL DEFAULT 'priced'
    CHECK (pricing_mode IN ('priced','unpriced')),
  -- Latest figure on the table: {currency, amount, period?}. period e.g.
  -- 'project' (one-off) | 'per_month' | 'per_hour'.
  current_amount JSONB NOT NULL DEFAULT '{}',
  -- Optional negotiable non-price terms (scope / dates), free-form.
  current_terms JSONB,
  status TEXT NOT NULL DEFAULT 'pending_business'
    CHECK (status IN ('pending_business','pending_talent','accepted',
                      'declined','withdrawn','expired')),
  -- Who first opened the negotiation. Always the talent today (a priced counter
  -- or an unpriced submit); kept explicit for audit + future business-opened flows.
  opened_by TEXT NOT NULL DEFAULT 'talent'
    CHECK (opened_by IN ('talent','business','admin')),
  -- Side that made the most recent move (drives whose "turn" it is in the UI).
  last_actor_side TEXT
    CHECK (last_actor_side IN ('talent','business','admin')),
  expires_on DATE,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live offer per recipient (terminal history rows excluded). A second
-- concurrent open offer trips 23505 -> 409 in the service.
CREATE UNIQUE INDEX assignment_offers_one_open_per_recipient
  ON assignment_offers (recipient_id)
  WHERE status IN ('pending_business','pending_talent','accepted');
CREATE INDEX assignment_offers_card_idx   ON assignment_offers (card_id, status);
CREATE INDEX assignment_offers_talent_idx ON assignment_offers (talent_user_id, created_at DESC);

CREATE TRIGGER trg_assignment_offers_updated_at
  BEFORE UPDATE ON assignment_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- The negotiation thread + audit (mirrors offer_events). The thread IS the
-- revision history — each counter mutates the offer row + appends an event.
CREATE TABLE assignment_offer_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES assignment_offers(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('business','talent','admin','system')),
  actor_id UUID,
  action TEXT NOT NULL CHECK (action IN ('submitted','countered','accepted',
    'declined','withdrawn','expired','question_asked','question_answered')),
  amount JSONB,                            -- the figure / counter package at this step
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX assignment_offer_events_offer_idx ON assignment_offer_events (offer_id, created_at);

ALTER TABLE assignment_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_offer_events ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- Card-events outbox (Profiles -> SquadHub), DELIBERATELY separate from the
-- jobs squadhub_event_outbox (00107) so a card event can never be delivered to
-- the jobs endpoint and vice versa (the sync-isolation lesson). Posts to
-- SQUADHUB_CARD_EVENTS_URL with the envelope
--   { event, external_id, recipient_id, offer_id, actor, occurred_at, data }
-- signed with SQUADHUB_CALLBACK_SECRET. Same retry semantics as the jobs outbox
-- (inline deliver once + 5-min sweeper, max 10 attempts). dedupe_key idempotent.
-- =============================================================
CREATE TABLE card_event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  dedupe_key TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX card_event_outbox_pending_idx
  ON card_event_outbox (created_at) WHERE delivered_at IS NULL;

ALTER TABLE card_event_outbox ENABLE ROW LEVEL SECURITY;
