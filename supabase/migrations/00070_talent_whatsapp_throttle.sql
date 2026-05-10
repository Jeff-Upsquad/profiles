-- Talent WhatsApp opt-out + throttle for the "subscription card received" automation.
-- whatsapp_subscription_updates_enabled  : per-talent opt-out toggle (UI on subscriptions page)
-- last_subscription_whatsapp_at          : timestamp of the most recent WhatsApp sent — used by the
--                                          throttle (max 1/day if the talent has unviewed prior cards)
-- viewed_at on subscription_card_recipients: stamped when the talent's app fetches the card —
--                                          drives the "engagement" signal for throttle decisions

ALTER TABLE talent_users
  ADD COLUMN whatsapp_subscription_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN last_subscription_whatsapp_at TIMESTAMPTZ;

ALTER TABLE subscription_card_recipients
  ADD COLUMN viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS subscription_card_recipients_unviewed_idx
  ON subscription_card_recipients (talent_user_id)
  WHERE viewed_at IS NULL AND cancelled_at IS NULL;
