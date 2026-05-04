-- Add CRM pipeline-stage automation entries for creative leads.
-- Existing automation_templates rows (shortlisted, partner_onboarding) are
-- preserved; we just merge in the new event types.
UPDATE admin_settings
SET value = value || '{
  "creative_lead_received": {
    "enabled": false,
    "channel": "crm_pipeline",
    "template_name": "",
    "template_body": "",
    "crm_webhook_url": "",
    "pipeline_stage": "Form Filled / For Review"
  },
  "creative_lead_auto_approved": {
    "enabled": false,
    "channel": "crm_pipeline",
    "template_name": "",
    "template_body": "",
    "crm_webhook_url": "",
    "pipeline_stage": "Signed Up"
  }
}'::jsonb
WHERE key = 'automation_templates';
