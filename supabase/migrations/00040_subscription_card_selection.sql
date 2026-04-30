-- 00040: Subscription Card Selection
--
-- Mirrors the selection concept from SquadHub. When a talent is selected
-- (either by SquadHire admin or via SquadHub webhook), the recipient row
-- is stamped. The talent sees "Selected" in their subscriptions tab.

ALTER TABLE subscription_card_recipients
  ADD COLUMN IF NOT EXISTS selected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS passed_over_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scr_selected
  ON subscription_card_recipients(card_id)
  WHERE selected_at IS NOT NULL;

-- Card-level denormalized pointer (matches SquadHub pattern).
ALTER TABLE subscription_cards
  ADD COLUMN IF NOT EXISTS selected_talent_user_id UUID REFERENCES talent_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ;
