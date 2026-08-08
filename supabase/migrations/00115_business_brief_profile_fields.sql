-- Migration: 00115_business_brief_profile_fields
-- Description: Persist brief-form brand note + location on the business account
-- so subsequent requirement forms can prefill from account details.

ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS business_note TEXT,
  ADD COLUMN IF NOT EXISTS business_location TEXT;
