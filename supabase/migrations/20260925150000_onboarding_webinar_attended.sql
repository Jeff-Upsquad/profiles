-- Talent-board checklist: the one common onboarding webinar (Partner Program
-- and Jobs share it now — the CRM talent pipelines were merged to a single
-- "Onboarding webinar" stage). There's no automatic attendance feed from the
-- meeting tool, so an admin ticks it from the Onboarding hub or the Webinars
-- registrant list. The other checklist items are derived: App downloaded from
-- talent_app_installs.first_seen_at, courses from training progress.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS onboarding_webinar_attended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_webinar_attended_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN talent_users.onboarding_webinar_attended_at IS
  'When an admin marked the common onboarding webinar as attended. NULL = not attended yet.';
