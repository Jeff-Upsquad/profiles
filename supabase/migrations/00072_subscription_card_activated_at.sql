-- Tracks when SquadHub admin "Finalized" a selection — moving the card from
-- "Selected" (waiting admin approval) to "Assigned" (active subscription).
-- Set by the /squadhub/cards/activation webhook from SquadHub. The talent's
-- "My Clients" tab groups cards by whether this is null (Selected) or set
-- (Assigned). Earnings + commitment summary only counts assigned cards.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS subscription_activated_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
