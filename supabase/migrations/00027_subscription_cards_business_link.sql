-- Migration: 00027_subscription_cards_business_link
-- Description: Link a SquadHub-published subscription card to a Profiles
-- business user. The webhook payload now carries the client's email; the
-- ingest service resolves that to a business_users row and stores its id
-- here so that talent acceptances can write into business_shared_profiles.

ALTER TABLE subscription_cards
    ADD COLUMN business_user_id UUID NULL REFERENCES business_users(id) ON DELETE SET NULL;

CREATE INDEX subscription_cards_business_user_id_idx
    ON subscription_cards (business_user_id)
    WHERE business_user_id IS NOT NULL;
