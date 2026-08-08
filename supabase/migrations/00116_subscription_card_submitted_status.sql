-- 00116: Allow 'submitted' status on subscription cards (CRM pending briefs)
--
-- Squad CRM creates cards before SquadHub publishes them. Those land here as
-- status='submitted' with published_at NULL so the business portal can show
-- "Awaiting team review" without fanning out to talent.

ALTER TABLE subscription_cards
  DROP CONSTRAINT IF EXISTS subscription_cards_status_check;

ALTER TABLE subscription_cards
  ADD CONSTRAINT subscription_cards_status_check
    CHECK (status IN ('active', 'assigned', 'archived', 'submitted'));

-- Pending briefs are not published yet; allow NULL so list ordering can fall
-- back to created_at for submitted rows.
ALTER TABLE subscription_cards
  ALTER COLUMN published_at DROP NOT NULL;
