-- 00100: Track paused / cancelled lifecycle on subscription cards
--
-- SquadHub pauses a subscription by removing the assigned talent WITHOUT
-- closing the card (it stays status='assigned' here), and cancels by closing it
-- (status='archived'). Neither transition was distinguishable on the business
-- portal before: a paused card looked like a still-active assignment, and a
-- cancelled card looked identical to a recall or plain close.
--
-- These two nullable timestamps let the business "My subscription" page split
-- cards into Open / Active / Paused / Cancelled. Both are written verbatim on
-- every ingest from SquadHub (null clears them on resume / re-publish), mirroring
-- how recalled_at / archived_at already flow.

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS paused_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
