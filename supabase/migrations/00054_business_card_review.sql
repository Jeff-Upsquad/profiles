ALTER TABLE subscription_card_recipients
  ADD COLUMN IF NOT EXISTS business_review_status TEXT
    CHECK (business_review_status IN ('shortlisted', 'rejected')),
  ADD COLUMN IF NOT EXISTS business_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scr_business_review
  ON subscription_card_recipients(card_id, business_review_status)
  WHERE business_review_status IS NOT NULL;
