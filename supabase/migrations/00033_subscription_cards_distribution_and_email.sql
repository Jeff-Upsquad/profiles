-- Migration: 00033_subscription_cards_distribution_and_email
-- Description: Persist two SquadHub-side fields on each subscription card so
-- ingest can honour them and reads can recover from a timing race.
--
-- 1. `distribution` — broadcast vs manual ("soft publish") from SquadHub.
--    Manual cards must NEVER be auto-fanned out to talents; the existing
--    ingest path was creating recipient rows for every matching talent
--    regardless of this flag, which leaked manual cards into talent feeds.
--
-- 2. `business_email` — the lead email SquadHub sent. We resolve it to a
--    business_users row at ingest time, but the business_user can be created
--    AFTER the card arrives (the lead accepts an invitation later). With
--    only the resolved FK stored, late-arriving business_users orphan their
--    cards forever. Storing the email lets the dashboard query fall back to
--    matching by email when the FK is null.

ALTER TABLE subscription_cards
    ADD COLUMN distribution TEXT NOT NULL DEFAULT 'broadcast'
        CHECK (distribution IN ('broadcast', 'manual'));

ALTER TABLE subscription_cards
    ADD COLUMN business_email TEXT NULL;

-- Case-insensitive lookup index — the dashboard fallback compares against
-- business_users.contact_email, also stored verbatim, and we want both
-- sides to ignore case.
CREATE INDEX subscription_cards_business_email_lower_idx
    ON subscription_cards (LOWER(business_email))
    WHERE business_email IS NOT NULL;
