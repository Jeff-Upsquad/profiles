-- Migration: 00024_subscription_cards
-- Description: Cards published by SquadHub admin, fanned out to matching talents.
-- Each talent's accept/reject response is stored alongside webhook-delivery state
-- so the outbound callback to SquadHub can be retried by a simple sweeper.
--
-- `content` and `match_rules` are flexible JSONB so SquadHub can evolve the
-- payload shape (new fields, new match dimensions) without a Profiles migration.

-- ============================================================
-- subscription_cards
-- ============================================================

CREATE TABLE subscription_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL UNIQUE,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    match_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX subscription_cards_status_published_at_idx
    ON subscription_cards (status, published_at DESC);

CREATE INDEX subscription_cards_match_rules_gin_idx
    ON subscription_cards USING GIN (match_rules);

CREATE TRIGGER set_subscription_cards_updated_at
    BEFORE UPDATE ON subscription_cards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- subscription_card_recipients
-- ============================================================

CREATE TABLE subscription_card_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES subscription_cards(id) ON DELETE CASCADE,
    talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    responded_at TIMESTAMPTZ,
    callback_delivered_at TIMESTAMPTZ,
    callback_attempts INT NOT NULL DEFAULT 0,
    callback_last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (card_id, talent_user_id)
);

CREATE INDEX subscription_card_recipients_talent_status_idx
    ON subscription_card_recipients (talent_user_id, status, created_at DESC);

-- Partial index used by the retry sweeper to find responded-but-undelivered rows.
CREATE INDEX subscription_card_recipients_pending_callbacks_idx
    ON subscription_card_recipients (callback_delivered_at)
    WHERE status <> 'pending' AND callback_delivered_at IS NULL;

CREATE TRIGGER set_subscription_card_recipients_updated_at
    BEFORE UPDATE ON subscription_card_recipients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS (defense in depth — backend writes use the service role key and bypass RLS)
-- ============================================================

ALTER TABLE subscription_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_card_recipients ENABLE ROW LEVEL SECURITY;

-- Recipients: talents can read only their own rows, and may only flip their
-- status forward to accepted/rejected (never back to pending).
CREATE POLICY subscription_card_recipients_select_own ON subscription_card_recipients
    FOR SELECT USING (auth.uid() = talent_user_id);

CREATE POLICY subscription_card_recipients_update_own ON subscription_card_recipients
    FOR UPDATE USING (auth.uid() = talent_user_id)
    WITH CHECK (auth.uid() = talent_user_id AND status IN ('accepted', 'rejected'));

CREATE POLICY subscription_card_recipients_select_admin ON subscription_card_recipients
    FOR SELECT USING (is_admin());

-- Cards: readable if a recipient row ties the card to the current talent,
-- or by any admin.
CREATE POLICY subscription_cards_select_via_recipient ON subscription_cards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM subscription_card_recipients r
            WHERE r.card_id = subscription_cards.id
              AND r.talent_user_id = auth.uid()
        )
    );

CREATE POLICY subscription_cards_select_admin ON subscription_cards
    FOR SELECT USING (is_admin());

-- No INSERT or DELETE policies on either table: all writes go through the
-- service-role backend.
