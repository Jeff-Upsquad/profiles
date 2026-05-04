-- Automation event log — tracks every automated action for audit/debugging
CREATE TABLE automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  lead_id UUID REFERENCES lead_submissions(id) ON DELETE SET NULL,
  talent_user_id UUID,
  triggered_by TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_automation_events_lead ON automation_events(lead_id);
CREATE INDEX idx_automation_events_type ON automation_events(event_type, created_at DESC);

-- Seed default automation config
INSERT INTO admin_settings (key, value) VALUES
  ('automation_config', '{
    "auto_shortlist_on_approve": true,
    "auto_onboarding_on_signup": true,
    "auto_invite_on_shortlist": true,
    "crm_message_on_shortlist": false
  }'::jsonb),
  ('automation_templates', '{
    "shortlisted": {
      "enabled": false,
      "channel": "whatsapp",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": ""
    },
    "partner_onboarding": {
      "enabled": false,
      "channel": "whatsapp",
      "template_name": "",
      "template_body": "",
      "crm_webhook_url": ""
    }
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;
