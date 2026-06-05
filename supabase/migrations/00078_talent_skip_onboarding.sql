-- Migration: 00078_talent_skip_onboarding
-- Description: Allow admins to mark a talent_user as exempt from the onboarding
-- training course. When `skip_onboarding = true` the talent is treated as if
-- they had completed onboarding (gates, lesson locks, module access, 5-stage
-- progress strip, and `onboarding_completed` checks all short-circuit on this
-- flag). Audit columns track who flipped it and why.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_at TIMESTAMPTZ;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_by UUID REFERENCES auth.users(id);

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS skip_onboarding_reason TEXT;

-- Backfill: explicitly bypass onboarding for the test account requested in
-- the original ticket. Safe to re-run; the WHERE clause is idempotent.
UPDATE public.talent_users tu
SET skip_onboarding = true,
    skip_onboarding_at = now(),
    skip_onboarding_reason = 'Manual bypass (seed/test account)'
FROM auth.users au
WHERE au.id = tu.id
  AND lower(au.email) = 'testapple@gmail.com';
