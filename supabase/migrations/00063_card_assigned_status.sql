-- 00063: Add 'assigned' status to subscription cards
--
-- When SquadHub assigns recipients to a card, the status moves from
-- 'active' to 'assigned'. Pending talents no longer see the card;
-- non-selected accepted talents see it as "Closed".

ALTER TABLE subscription_cards
  DROP CONSTRAINT IF EXISTS subscription_cards_status_check;

ALTER TABLE subscription_cards
  ADD CONSTRAINT subscription_cards_status_check
    CHECK (status IN ('active', 'assigned', 'archived'));
