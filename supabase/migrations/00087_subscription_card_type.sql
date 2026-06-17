-- SquadHub now sends a `card_type` on every ingested card so this app can tell
-- the three client paths apart:
--   'subscription' — the existing recurring-plan card (DEFAULT; every legacy
--                    row keeps behaving exactly as before, no backfill needed).
--   'assignment'   — a one-off freelance project. Talent clients tag it
--                    "Assignment" in the same Pending/Responded feed; the
--                    business portal lists it in a separate Assignments section.
--   'hiring'       — reserved for the third path; not used yet.
--
-- Project budget/scope/timeline for assignment cards ride inside the existing
-- `content` JSONB (no extra columns needed).
--
-- Additive + defaulted — no data touched.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'subscription';

COMMENT ON COLUMN subscription_cards.card_type IS
  'Product line of the ingested card: subscription (recurring plan, default), assignment (one-off freelance project) or hiring (reserved). Talent clients tag by it; the business portal shows assignments in a separate section.';

-- Cheap discriminator filter for the business Assignments section. Partial
-- index keeps the common card_type = subscription path off it.
CREATE INDEX IF NOT EXISTS subscription_cards_card_type_idx
  ON subscription_cards (card_type)
  WHERE card_type <> 'subscription';
