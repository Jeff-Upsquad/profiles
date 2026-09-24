-- Applicant review: a terminal "Rejected / Disqualified" stage on both
-- onboarding tracks, per-track rejection bookkeeping, and retirement of the
-- legacy `signed_up` pipeline stage (superseded by `application_approved`).
--
-- Run the ALTER TYPE on its own first: a newly added enum value cannot be used
-- in the same transaction that adds it.
ALTER TYPE talent_pipeline_stage ADD VALUE IF NOT EXISTS 'rejected';

-- Jobs track stores its stage as text behind a CHECK.
ALTER TABLE talent_users DROP CONSTRAINT IF EXISTS talent_jobs_pipeline_stage_check;
ALTER TABLE talent_users ADD CONSTRAINT talent_jobs_pipeline_stage_check CHECK (
  jobs_pipeline_stage IS NULL OR jobs_pipeline_stage = ANY (ARRAY[
    'applicants', 'application_approved', 'signed_up', 'onboarding_course', 'basic_profile',
    'job_profile', 'final_review', 'live', 'no_response', 'rejected'
  ])
);

-- `rejection_reason` / `rejected_at` stay the account-level (Jobs) record; the
-- Partner Program keeps its own so rejecting one track never overwrites the other.
ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS partner_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS partner_rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jobs_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS jobs_rejected_at TIMESTAMPTZ;

-- Legacy `signed_up` meant "application approved" — fold it in so the hub
-- shows one stage. The enum value itself stays (Postgres can't drop it).
UPDATE talent_users SET pipeline_stage = 'application_approved' WHERE pipeline_stage = 'signed_up';
UPDATE talent_users SET jobs_pipeline_stage = 'application_approved' WHERE jobs_pipeline_stage = 'signed_up';
ALTER TABLE talent_users ALTER COLUMN pipeline_stage SET DEFAULT 'application_approved';
