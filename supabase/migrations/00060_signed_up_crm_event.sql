-- Add a third CRM event: signed_up — fires when a candidate signs up
-- (auto-approved or manual). Pushes them to the "Signed Up" pipeline stage.
UPDATE admin_settings
SET value = jsonb_set(
  value,
  '{signed_up}',
  COALESCE(
    value -> 'signed_up',
    '{
      "enabled": false,
      "channel": "crm_pipeline",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": "",
      "pipeline_stage": "Signed Up"
    }'::jsonb
  ),
  true
)
WHERE key = 'automation_templates';
