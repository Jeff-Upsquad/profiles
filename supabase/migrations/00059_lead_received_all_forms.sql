-- The "form received" CRM event now applies to ALL form types, not just creative.
-- Rename creative_lead_received → lead_received in automation_templates,
-- preserving any existing configuration the admin already saved.

UPDATE admin_settings
SET value = jsonb_set(
  value - 'creative_lead_received',
  '{lead_received}',
  COALESCE(
    value -> 'creative_lead_received',
    '{
      "enabled": false,
      "channel": "crm_pipeline",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": "",
      "pipeline_stage": "Form Filled / For Review"
    }'::jsonb
  ),
  true
)
WHERE key = 'automation_templates';
