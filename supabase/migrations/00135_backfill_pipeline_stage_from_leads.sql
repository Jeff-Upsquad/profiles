-- Backfill talent_users.pipeline_stage from linked lead_submissions.status
-- Uses the highest-progress stage when a talent has multiple leads.

WITH lead_stage_map AS (
  SELECT
    ls.linked_talent_user_id,
    CASE ls.status
      WHEN 'signed_up' THEN 1
      WHEN 'onboarding_training' THEN 2
      WHEN 'basic_profile' THEN 3
      WHEN 'job_profile' THEN 4
      WHEN 'final_review' THEN 5
      WHEN 'live' THEN 6
      WHEN 'no_response' THEN 7
      ELSE 0
    END AS stage_rank,
    CASE ls.status
      WHEN 'signed_up' THEN 'signed_up'::talent_pipeline_stage
      WHEN 'onboarding_training' THEN 'onboarding_course'::talent_pipeline_stage
      WHEN 'basic_profile' THEN 'basic_profile'::talent_pipeline_stage
      WHEN 'job_profile' THEN 'job_profile'::talent_pipeline_stage
      WHEN 'final_review' THEN 'final_review'::talent_pipeline_stage
      WHEN 'live' THEN 'live'::talent_pipeline_stage
      WHEN 'no_response' THEN 'no_response'::talent_pipeline_stage
    END AS target_stage
  FROM lead_submissions ls
  WHERE ls.linked_talent_user_id IS NOT NULL
    AND ls.deleted_at IS NULL
),
best_stage AS (
  SELECT DISTINCT ON (linked_talent_user_id)
    linked_talent_user_id,
    target_stage
  FROM lead_stage_map
  WHERE target_stage IS NOT NULL
  ORDER BY linked_talent_user_id, stage_rank DESC
)
UPDATE talent_users tu
SET pipeline_stage = bs.target_stage
FROM best_stage bs
WHERE tu.id = bs.linked_talent_user_id
  AND tu.pipeline_stage != bs.target_stage;
