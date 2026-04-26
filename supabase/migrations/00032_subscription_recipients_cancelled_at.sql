-- Migration 00032: subscription_card_recipients.cancelled_at + partial unique index
--
-- Recipients can now exist in multiple rounds per (card, talent). When a partner
-- recalls a card, every recipient row for that card gets `cancelled_at` set —
-- the row stays around as audit/display state but is no longer actionable. When
-- the card is republished (status archived → active), a fresh `pending` row is
-- inserted alongside the cancelled one. The partial unique index keeps at most
-- one *active* row per (card, talent).

ALTER TABLE subscription_card_recipients
    ADD COLUMN cancelled_at TIMESTAMPTZ NULL;

ALTER TABLE subscription_card_recipients
    DROP CONSTRAINT subscription_card_recipients_card_id_talent_user_id_key;

CREATE UNIQUE INDEX subscription_card_recipients_active_unique
    ON subscription_card_recipients (card_id, talent_user_id)
    WHERE cancelled_at IS NULL;

CREATE INDEX subscription_card_recipients_talent_active_idx
    ON subscription_card_recipients (talent_user_id, cancelled_at, status, created_at DESC);

-- Backfill: for cards already archived, mark their existing recipient rows
-- cancelled at the card's updated_at (best approximation of "when the recall
-- happened"). Uncancelled rows on still-active cards stay uncancelled.
UPDATE subscription_card_recipients r
SET cancelled_at = c.updated_at
FROM subscription_cards c
WHERE r.card_id = c.id
  AND c.status = 'archived'
  AND r.cancelled_at IS NULL;

-- Replace the talent UPDATE policy to also block flipping status on a row
-- whose offer has been recalled (cancelled_at set). Backend uses the service
-- role and bypasses RLS, but adds its own guard in respond().
DROP POLICY subscription_card_recipients_update_own ON subscription_card_recipients;
CREATE POLICY subscription_card_recipients_update_own ON subscription_card_recipients
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (
        auth.uid() = talent_user_id
        AND status IN ('accepted', 'rejected')
        AND cancelled_at IS NULL
    );
