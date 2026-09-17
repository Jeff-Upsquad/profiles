-- Mirror of the SquadHire CRM *talent* pipeline (the post-onboarding board:
-- Welcome → Download App → Onboarding webinar … → Onboarding completed) on
-- talent_users, alongside the existing candidate-pipeline `pipeline_stage`.
--
-- The CRM owns the stage names/order; we store the stable stage id + the name
-- we last saw so the admin Onboarding hub can filter/badge without a lookup.
-- Written by the inbound CRM stage webhook (pipeline_kind = 'talent') and by
-- the admin when they move a talent from the hub (which pushes to the CRM).

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS crm_talent_pipeline_name TEXT,
  ADD COLUMN IF NOT EXISTS crm_talent_stage_id TEXT,
  ADD COLUMN IF NOT EXISTS crm_talent_stage_name TEXT,
  ADD COLUMN IF NOT EXISTS crm_talent_stage_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_talent_users_crm_talent_stage_id
  ON talent_users (crm_talent_stage_id)
  WHERE crm_talent_stage_id IS NOT NULL;

COMMENT ON COLUMN talent_users.crm_talent_stage_id IS
  'SquadHire CRM talent-pipeline stage id (post-onboarding board). NULL = card not in a talent pipeline.';
COMMENT ON COLUMN talent_users.crm_talent_stage_name IS
  'Display name of crm_talent_stage_id as last seen from the CRM (renames flow in via webhook).';
