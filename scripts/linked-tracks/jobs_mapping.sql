-- Link the per-category Jobs boards in Profiles' CRM Mapping (jobs_<category>).
WITH cats(key, name) AS (VALUES
  ('jobs_creative', 'Jobs – Designers and Editors'),
  ('jobs_accountant', 'Jobs – Accountants'),
  ('jobs_sales', 'Jobs – Sales')),
keys(internal, stage_name) AS (VALUES
  ('new', 'New Applicants'), ('share_form', 'Share Landing Page'), ('form_filled', 'Signed Up / Applicants'),
  ('signed_up', 'Application Approved'), ('onboarding_training', 'Onboarding Training'),
  ('basic_profile', 'Basic Profile'), ('job_profile', 'Job Profile'), ('final_review', 'Final Review'),
  ('live', 'Live'), ('rejected', 'Rejected / Disqualified')),
boards AS (
  SELECT c.key, c.name,
    (SELECT id FROM crm_pipelines WHERE workspace_id = '00000000-0000-0000-0000-000000005408' AND kind = 'candidates' AND name = c.name) cand_id,
    (SELECT id FROM crm_pipelines WHERE workspace_id = '00000000-0000-0000-0000-000000005408' AND kind = 'talent' AND name = c.name) talent_id
  FROM cats c
),
cand_cfg AS (
  SELECT jsonb_object_agg(b.key, jsonb_build_object(
    'pipeline_name', b.name,
    'mappings', (SELECT jsonb_object_agg(k.internal, s.id) FROM keys k JOIN crm_stages s ON s.pipeline_id = b.cand_id AND s.name = k.stage_name),
    'stages', (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'sort_order', s.sort_order) ORDER BY s.sort_order) FROM crm_stages s WHERE s.pipeline_id = b.cand_id)
  )) v FROM boards b WHERE b.cand_id IS NOT NULL
),
talent_cfg AS (
  SELECT jsonb_object_agg(b.key, jsonb_build_object(
    'pipeline_name', b.name,
    'stages', (SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'sort_order', s.sort_order) ORDER BY s.sort_order) FROM crm_stages s WHERE s.pipeline_id = b.talent_id)
  )) v FROM boards b WHERE b.talent_id IS NOT NULL
)
UPDATE admin_settings
SET value = jsonb_set(jsonb_set(value,
    '{pipelines}', coalesce(value->'pipelines', '{}'::jsonb) || (SELECT v FROM cand_cfg), true),
    '{talent_pipelines}', coalesce(value->'talent_pipelines', '{}'::jsonb) || (SELECT v FROM talent_cfg), true)
WHERE key = 'crm_status_mapping'
  AND (SELECT v FROM cand_cfg) IS NOT NULL AND (SELECT v FROM talent_cfg) IS NOT NULL;
