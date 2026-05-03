-- Subscription Cards: support for locally-created request-sourced and custom cards.
-- Existing cards from SquadHub webhook default to source='webhook'.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'webhook'
    CHECK (source IN ('webhook', 'request', 'custom'));

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS subscription_request_id INTEGER;

-- Make external_id nullable for locally-created cards (no SquadHub reference)
ALTER TABLE subscription_cards
  ALTER COLUMN external_id DROP NOT NULL;

-- Drop the unique constraint on external_id (nullable columns need a partial unique index)
ALTER TABLE subscription_cards
  DROP CONSTRAINT IF EXISTS subscription_cards_external_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS subscription_cards_external_id_unique
  ON subscription_cards(external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_cards_request_id
  ON subscription_cards(subscription_request_id)
  WHERE subscription_request_id IS NOT NULL;
