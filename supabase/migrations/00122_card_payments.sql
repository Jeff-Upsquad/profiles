-- =============================================================
-- Card payments — the business pays for the talent it selected
-- =============================================================
-- After a business selects a talent on a subscription / assignment card, it
-- pays the agreed figure through Razorpay from inside SquadHire. Once Razorpay
-- confirms, SquadBooks is asked to raise the invoice (find-or-create the
-- customer, write a PAID invoice, record the payment) and WhatsApp it to the
-- client with receipt wording — no pay link, because the money is already in.
--
-- This table is the durable record that makes that two-system handoff safe:
--   * the row is written BEFORE the customer is sent to Razorpay, so a payment
--     can never complete against a link we have no record of;
--   * `status` tracks the money (created -> paid | failed | cancelled);
--   * `invoice_*` tracks the SquadBooks handoff SEPARATELY, so a successful
--     charge whose invoice call failed is a retryable state, not a lost invoice.
--     The sweeper retries `status='paid' AND invoice_synced_at IS NULL`.
--
-- One live payment per (card, recipient): a partial unique index lets a failed
-- or cancelled attempt be superseded while preventing double-charging for the
-- same selection.
-- =============================================================

CREATE TABLE card_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES subscription_card_recipients(id) ON DELETE CASCADE,
  business_user_id UUID NOT NULL REFERENCES business_users(id) ON DELETE CASCADE,
  talent_user_id UUID REFERENCES talent_users(id) ON DELETE SET NULL,

  -- What was charged. Snapshotted at link-creation time so a later bid edit
  -- can never retroactively change what the client actually paid.
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  -- 'per_month' (subscription: one month at the agreed rate) | 'project'
  -- (assignment: the whole one-off figure). Drives the invoice line wording.
  period TEXT NOT NULL DEFAULT 'per_month'
    CHECK (period IN ('per_month', 'project')),
  -- Invoice line snapshot: {name, description}. Built from the card's
  -- subscription/plan/tier so it matches SquadBooks' synced catalog item.
  line_item JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Razorpay
  razorpay_payment_link_id TEXT,
  razorpay_payment_link_url TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'paid', 'failed', 'cancelled')),
  paid_at TIMESTAMPTZ,

  -- SquadBooks handoff (retried independently of the payment itself)
  squadbooks_customer_id UUID,
  squadbooks_invoice_id UUID,
  squadbooks_invoice_number TEXT,
  squadbooks_invoice_url TEXT,
  invoice_synced_at TIMESTAMPTZ,
  invoice_attempts INT NOT NULL DEFAULT 0,
  invoice_last_error TEXT,
  -- Set when SquadBooks confirmed the WhatsApp went out. An invoice can be
  -- synced but undelivered (CRM/Meta blip); the sweeper retries just the send.
  invoice_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One live (created/paid) payment per selection — a failed/cancelled attempt
-- can be retried, a successful one can't be duplicated.
CREATE UNIQUE INDEX card_payments_live_per_recipient_idx
  ON card_payments (recipient_id)
  WHERE status IN ('created', 'paid');

-- Webhook lookup: Razorpay hands us the link id.
CREATE UNIQUE INDEX card_payments_razorpay_link_idx
  ON card_payments (razorpay_payment_link_id)
  WHERE razorpay_payment_link_id IS NOT NULL;

-- The card review page reads every payment for a card in one go.
CREATE INDEX card_payments_card_idx ON card_payments (card_id);
CREATE INDEX card_payments_business_idx ON card_payments (business_user_id, created_at DESC);

-- Sweeper: paid but not yet invoiced, or invoiced but never delivered.
CREATE INDEX card_payments_pending_invoice_idx
  ON card_payments (paid_at)
  WHERE status = 'paid' AND (invoice_synced_at IS NULL OR invoice_sent_at IS NULL);

CREATE TRIGGER set_card_payments_updated_at
  BEFORE UPDATE ON card_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: the backend writes with the service role (which bypasses RLS). Businesses
-- read their payments through the authenticated API, never directly. Defense in
-- depth — no permissive policy is granted.
ALTER TABLE card_payments ENABLE ROW LEVEL SECURITY;
