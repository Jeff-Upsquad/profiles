-- SquadHub fans a multi-tier brief out to one card per tier and sends each to
-- this app via the ingest webhook. They now share a `group_id` (SquadHub's
-- brief_group_id) so the business dashboard can collapse the per-tier siblings
-- into a single card with a tab per tier.
--
-- NULL for single-tier and legacy cards — they render one card each, unchanged.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS group_id UUID;

COMMENT ON COLUMN subscription_cards.group_id IS
  'Shared id across the per-tier sibling cards SquadHub fanned out from one multi-tier brief. The business dashboard collapses cards with the same group_id into one card with a tab per tier. NULL for single-tier / legacy cards.';

CREATE INDEX IF NOT EXISTS subscription_cards_group_id_idx
  ON subscription_cards (group_id)
  WHERE group_id IS NOT NULL;
