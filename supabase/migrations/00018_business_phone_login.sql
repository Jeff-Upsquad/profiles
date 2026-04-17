-- Migration: 00018_business_phone_login
-- Description: Allow business users to be invited with a phone number and log in
--              with email or phone. Adds a normalized phone column (digits-only)
--              so lookups are tolerant of formatting differences like "+91 ..."
--              vs "...".

-- 1. invitations: add optional phone + normalized generated column
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone_normalized TEXT
    GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) STORED;

-- Only one pending invitation per phone (ignores empty/no-phone rows)
CREATE UNIQUE INDEX IF NOT EXISTS invitations_phone_pending
    ON invitations(phone_normalized)
    WHERE status = 'pending' AND phone_normalized <> '';

-- 2. business_users: add normalized phone column on top of the existing contact_phone
ALTER TABLE business_users ADD COLUMN IF NOT EXISTS contact_phone_normalized TEXT
    GENERATED ALWAYS AS (regexp_replace(COALESCE(contact_phone, ''), '[^0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS idx_business_users_phone_normalized
    ON business_users(contact_phone_normalized)
    WHERE contact_phone_normalized <> '';
