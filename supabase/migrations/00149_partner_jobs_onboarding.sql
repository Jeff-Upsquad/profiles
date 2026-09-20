-- Job access and Partner Program approval are independent. Existing accounts
-- retain their current access; new role-specific signups set both explicitly.
BEGIN;

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS wants_jobs boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS partner_approval_status text,
  ADD COLUMN IF NOT EXISTS partner_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS jobs_pipeline_stage text,
  ADD COLUMN IF NOT EXISTS crm_jobs_pipeline_name text,
  ADD COLUMN IF NOT EXISTS crm_jobs_stage_id text,
  ADD COLUMN IF NOT EXISTS crm_jobs_stage_name text,
  ADD COLUMN IF NOT EXISTS crm_jobs_stage_changed_at timestamptz;

ALTER TABLE talent_users
  ADD CONSTRAINT talent_partner_approval_status_check
  CHECK (partner_approval_status IS NULL OR partner_approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE talent_users
  ADD CONSTRAINT talent_jobs_pipeline_stage_check
  CHECK (jobs_pipeline_stage IS NULL OR jobs_pipeline_stage IN (
    'applicants', 'application_approved', 'signed_up', 'onboarding_course',
    'basic_profile', 'job_profile', 'final_review', 'live', 'no_response'
  ));

-- Before this migration, every talent was in the Partner Program flow. Keep
-- those accounts in that queue, and infer Jobs from recorded preferences.
UPDATE talent_users tu
SET wants_jobs = EXISTS (
      SELECT 1 FROM talent_profiles_basic b
      WHERE b.talent_user_id = tu.id AND 'salary' = ANY(COALESCE(b.employment_type, '{}'::text[]))
    ) OR EXISTS (
      SELECT 1 FROM lead_submissions l
      WHERE l.linked_talent_user_id = tu.id
        AND COALESCE((l.form_data->'work_type_seeking') ?| ARRAY['Job', 'Full Time Job', 'Part Time Job'], false)
    ),
    partner_approval_status = CASE
      WHEN tu.approval_status = 'approved' THEN 'approved'
      WHEN tu.approval_status = 'rejected' THEN 'rejected'
      ELSE 'pending' END,
    partner_requested_at = COALESCE(tu.created_at, now()),
    partner_approved_at = CASE WHEN tu.approval_status = 'approved' THEN COALESCE(tu.approved_at, now()) END
WHERE tu.partner_approval_status IS NULL;

ALTER TYPE talent_pipeline_stage ADD VALUE IF NOT EXISTS 'applicants' BEFORE 'signed_up';
ALTER TYPE talent_pipeline_stage ADD VALUE IF NOT EXISTS 'application_approved' AFTER 'applicants';

CREATE INDEX IF NOT EXISTS idx_talent_partner_approval
  ON talent_users (partner_approval_status, partner_requested_at DESC);

UPDATE talent_users SET jobs_pipeline_stage = pipeline_stage::text
WHERE wants_jobs AND jobs_pipeline_stage IS NULL;

-- Link the new CRM boards by name. Stage ids are filled in when an admin
-- refreshes CRM Mapping; name-valued mappings work immediately meanwhile.
UPDATE admin_settings
SET value = jsonb_set(
  jsonb_set(value, '{pipelines}',
    coalesce(value->'pipelines', '{}'::jsonb) || jsonb_build_object('jobs', jsonb_build_object(
      'pipeline_name', 'Jobs Candidates',
      'mappings', jsonb_build_object(
        'new', 'New Applicants', 'share_form', 'Share Landing Page',
        'form_filled', 'Applicants', 'signed_up', 'Application Approved',
        'onboarding_training', 'Onboarding Training', 'basic_profile', 'Basic Profile',
        'job_profile', 'Job Profile', 'final_review', 'Final Review', 'live', 'Live'
      ), 'stages', '[]'::jsonb
    )), true),
  '{talent_pipelines}',
  coalesce(value->'talent_pipelines', '{}'::jsonb) ||
    jsonb_build_object('jobs', jsonb_build_object('pipeline_name', 'Jobs Onboarding', 'stages', '[]'::jsonb)),
  true)
WHERE key = 'crm_status_mapping';

COMMIT;
