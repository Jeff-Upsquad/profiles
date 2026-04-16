-- Migration: 00016_add_access_requested_at
-- Description: Add access_requested_at column to business_users for access renewal requests

ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS access_requested_at TIMESTAMPTZ;
