-- 00047_subscription_cards_recall_secondary.sql
--
-- Adds two fields the SquadHub→Profiles webhook needs to classify cards
-- on the business dashboard:
--
--   recalled_at  — TIMESTAMPTZ. Stamped when SquadHub recalls a card that
--                  already had acceptances. Lets the business dashboard
--                  show a "Recalled" tag while the card stays in Open
--                  (the lead is still in flight via the acceptee).
--                  Null for never-recalled cards. Already present in the
--                  outbound webhook payload — currently dropped at the
--                  Profiles validator.
--
--   is_secondary — BOOLEAN. True for cards SquadHub created as a child of
--                  another card (parent_card_id IS NOT NULL on its side).
--                  Profiles uses it to hide secondaries from the business
--                  dashboard list. Defaults to false so existing rows
--                  classify as primaries until the next webhook fires.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS recalled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_secondary BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS subscription_cards_recalled_at_idx
  ON subscription_cards (recalled_at)
  WHERE recalled_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscription_cards_is_secondary_idx
  ON subscription_cards (is_secondary)
  WHERE is_secondary = true;
