-- One Jobs candidates board + Jobs talent board per category, cloned from the
-- shared "Jobs Candidates" / "Jobs Onboarding" boards. No automations.
WITH cats(ord, name) AS (VALUES (1, 'Jobs – Designers and Editors'), (2, 'Jobs – Accountants'), (3, 'Jobs – Sales')),
ws AS (SELECT '00000000-0000-0000-0000-000000005408'::uuid AS id),
talent AS (
  INSERT INTO crm_pipelines (workspace_id, kind, name, color, sort_order, is_default, is_archived, access_mode)
  SELECT ws.id, 'talent', c.name, '#64748B', 100 + c.ord, false, false, 'assigned' FROM cats c, ws
  WHERE NOT EXISTS (SELECT 1 FROM crm_pipelines p WHERE p.workspace_id = ws.id AND p.kind = 'talent' AND p.name = c.name)
  RETURNING id, name
),
cand AS (
  INSERT INTO crm_pipelines (workspace_id, kind, name, color, sort_order, is_default, is_archived, access_mode, connected_deals_pipeline_id)
  SELECT ws.id, 'candidates', t.name, '#64748B', 100 + c.ord, false, false, 'assigned', t.id
  FROM talent t JOIN cats c ON c.name = t.name, ws
  RETURNING id, name
),
talent_stages AS (
  INSERT INTO crm_stages (workspace_id, pipeline_id, name, color, sort_order, is_terminal, is_converted, system_role)
  SELECT s.workspace_id, t.id, s.name, s.color, s.sort_order, s.is_terminal, s.is_converted, s.system_role
  FROM talent t, crm_stages s WHERE s.pipeline_id = '81f5b25a-04ca-46ac-a142-8b6a68fdad53'
  RETURNING id
),
cand_stages AS (
  INSERT INTO crm_stages (workspace_id, pipeline_id, name, color, sort_order, is_terminal, is_converted, system_role)
  SELECT s.workspace_id, c.id, s.name, s.color, s.sort_order, s.is_terminal, s.is_converted, s.system_role
  FROM cand c, crm_stages s WHERE s.pipeline_id = '5c56577b-eff8-40d5-8dd3-be8efa7bd236'
  RETURNING id, pipeline_id, name
),
qualify AS (
  UPDATE crm_pipelines p SET qualify_stage_id = cs.id
  FROM cand_stages cs WHERE cs.pipeline_id = p.id AND cs.name = 'Live'
  RETURNING p.id
),
reasons AS (
  INSERT INTO crm_stage_reasons (workspace_id, pipeline_id, stage_id, label, color, sort_order, is_active)
  SELECT r.workspace_id, cs.pipeline_id, cs.id, r.label, r.color, r.sort_order, r.is_active
  FROM cand_stages cs
  JOIN crm_stages src ON src.pipeline_id = '5c56577b-eff8-40d5-8dd3-be8efa7bd236' AND src.name = cs.name
  JOIN crm_stage_reasons r ON r.stage_id = src.id
  RETURNING id
)
SELECT (SELECT count(*) FROM talent) talent_boards, (SELECT count(*) FROM cand) candidate_boards,
  (SELECT count(*) FROM talent_stages) talent_stages, (SELECT count(*) FROM cand_stages) candidate_stages,
  (SELECT count(*) FROM qualify) qualify_set, (SELECT count(*) FROM reasons) reasons;

-- Hand-off stage (a data-modifying CTE can't update rows it just inserted).
UPDATE crm_pipelines p SET qualify_stage_id = s.id
FROM crm_stages s
WHERE p.workspace_id = '00000000-0000-0000-0000-000000005408' AND p.kind = 'candidates'
  AND p.name IN ('Jobs – Designers and Editors', 'Jobs – Accountants', 'Jobs – Sales')
  AND p.qualify_stage_id IS NULL AND s.pipeline_id = p.id AND s.name = 'Live';
