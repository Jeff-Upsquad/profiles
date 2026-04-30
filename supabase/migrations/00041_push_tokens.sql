BEGIN;

CREATE TABLE push_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    token         TEXT NOT NULL,
    platform      TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);

CREATE TABLE notification_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
    type             TEXT NOT NULL CHECK (type IN ('new_card', 'selected', 'cancelled')),
    ref_card_id      UUID REFERENCES subscription_cards(id) ON DELETE SET NULL,
    payload          JSONB NOT NULL DEFAULT '{}'::jsonb,
    status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_log_dedup
    ON notification_log(user_id, type, ref_card_id);

COMMIT;
