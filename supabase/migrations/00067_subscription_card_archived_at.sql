-- 00067: Hard-archive flag on subscription cards
--
-- Distinct from `status='archived'`, which SquadHub sends for any closed/
-- recalled card and which Profiles still surfaces in the talent's
-- Responded tab and the business dashboard's Closed bucket. `archived_at`
-- represents an explicit admin action on SquadHub's Archive tab and is a
-- harder hide: the card disappears from BOTH talent feeds (pending and
-- responded) AND the business dashboard. Cleared on republish via the
-- ingest webhook (SquadHub sends `archived_at: null`).

ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subscription_cards_archived_at
  ON subscription_cards(archived_at)
  WHERE archived_at IS NOT NULL;
