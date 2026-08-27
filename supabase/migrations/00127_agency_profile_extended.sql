-- Migration: 00127_agency_profile_extended
-- Adds agency name short form, primary contact, address & pincode to agency tables

ALTER TABLE agency_users
  ADD COLUMN IF NOT EXISTS agency_short_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

ALTER TABLE agency_profiles
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS agency_short_name TEXT;

-- Backfill: keep existing data
