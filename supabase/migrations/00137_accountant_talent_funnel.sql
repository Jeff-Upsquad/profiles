-- Accountants join the talent-onboarding funnel (same stages as designers /
-- editors, minus portfolio). Remap leftover generic-pipeline statuses so
-- existing accountant candidates land on the new board.

UPDATE lead_submissions
SET status = 'form_filled'
WHERE form_type = 'accountant'
  AND status = 'under_review'
  AND deleted_at IS NULL;

UPDATE lead_submissions
SET status = 'onboarding_training'
WHERE form_type = 'accountant'
  AND status = 'partner_onboarding'
  AND deleted_at IS NULL;

UPDATE lead_submissions
SET status = 'live'
WHERE form_type = 'accountant'
  AND status = 'onboard_completed'
  AND deleted_at IS NULL;
