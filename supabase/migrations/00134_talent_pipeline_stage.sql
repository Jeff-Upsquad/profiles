-- Add pipeline_stage to talent_users for tracking onboarding progress.
-- This syncs with the Squad Hire CRM candidates pipeline stages.

-- Define the pipeline stage enum type
DO $$ BEGIN
  CREATE TYPE talent_pipeline_stage AS ENUM (
    'signed_up',
    'onboarding_course',
    'basic_profile',
    'job_profile',
    'final_review',
    'live',
    'no_response'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add the pipeline_stage column
ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS pipeline_stage talent_pipeline_stage DEFAULT 'signed_up';

-- Add index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_talent_users_pipeline_stage
  ON talent_users (pipeline_stage);

-- Backfill existing users: set stage based on their current state
-- Approved users who completed onboarding -> live
-- Approved users -> signed_up (starting point)
-- Pending users -> signed_up
-- Rejected users -> no_response
UPDATE talent_users SET pipeline_stage = 
  CASE 
    WHEN approval_status = 'rejected' THEN 'no_response'::talent_pipeline_stage
    WHEN approval_status = 'approved' AND onboarding_completed = true THEN 'live'::talent_pipeline_stage
    WHEN approval_status = 'approved' THEN 'signed_up'::talent_pipeline_stage
    ELSE 'signed_up'::talent_pipeline_stage
  END
WHERE pipeline_stage IS NULL;

COMMENT ON COLUMN talent_users.pipeline_stage IS
  'Tracks talent onboarding pipeline stage. Syncs with Squad Hire CRM candidates pipeline.';