-- Tracks when the business last saw each talent's acceptance of a subscription /
-- assignment card. NULL = still unseen, which drives the unread badge on the
-- card list and the "New" markers in the review pool. Cleared (set to now())
-- when the business opens the card's review page.
ALTER TABLE subscription_card_recipients
  ADD COLUMN IF NOT EXISTS business_seen_at TIMESTAMPTZ;

-- Speeds up the per-card "count unseen acceptances" lookup used by the
-- dashboard card summary.
CREATE INDEX IF NOT EXISTS idx_scr_business_unseen
  ON subscription_card_recipients(card_id)
  WHERE status = 'accepted' AND business_seen_at IS NULL;
