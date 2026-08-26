-- =============================================================
-- Card payments: multi-gateway support (Razorpay | Cashfree)
-- =============================================================
-- Which gateway collects a card payment now follows the org's Payment Gateway
-- setting in SQUADbooks (asked server-to-server before each mint): Razorpay
-- while that is what SQUADbooks has enabled, Cashfree otherwise.
--
--   * `gateway` stamps the row with the gateway that minted its link, so
--     reconciliation, cancellation and invoice wording route correctly.
--   * The Razorpay-specific columns become gateway-neutral: they hold whichever
--     provider's link/payment ids the row was created with. Existing rows keep
--     their values (default gateway 'razorpay').
-- =============================================================

ALTER TABLE card_payments
  ADD COLUMN gateway TEXT NOT NULL DEFAULT 'razorpay'
    CHECK (gateway IN ('razorpay', 'cashfree'));

ALTER TABLE card_payments RENAME COLUMN razorpay_payment_link_id TO payment_link_id;
ALTER TABLE card_payments RENAME COLUMN razorpay_payment_link_url TO payment_link_url;
ALTER TABLE card_payments RENAME COLUMN razorpay_payment_id TO gateway_payment_id;

ALTER INDEX card_payments_razorpay_link_idx RENAME TO card_payments_payment_link_idx;
