-- Consolidate CRM events down to just two:
--   1. creative_lead_received → "Form Filled / For Review"
--   2. shortlisted             → "Shortlisted"  (fires for auto-approve OR manual shortlist)
--
-- Drop creative_lead_auto_approved (handled by shortlisted via the auto-shortlist chain)
-- and partner_onboarding (no CRM update on signup → onboarding for now).

UPDATE admin_settings
SET value = value - 'creative_lead_auto_approved' - 'partner_onboarding'
WHERE key = 'automation_templates';

-- Default the shortlisted template to CRM Pipeline channel with stage "Shortlisted".
UPDATE admin_settings
SET value = jsonb_set(
  value,
  '{shortlisted}',
  COALESCE(value -> 'shortlisted', '{}'::jsonb) || jsonb_build_object(
    'channel', 'crm_pipeline',
    'pipeline_stage', 'Shortlisted'
  ),
  true
)
WHERE key = 'automation_templates';
