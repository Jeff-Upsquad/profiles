-- Add CRM pipeline statuses to lead_status_enum so SquadHire and Squad CRM
-- share the same status vocabulary for creative (designer/editor) candidates.

ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'share_form';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'form_filled';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'signed_up';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'onboarding_training';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'basic_profile';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'job_profile';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'portfolio_updation';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'final_review';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'live';
ALTER TYPE lead_status_enum ADD VALUE IF NOT EXISTS 'no_response';

-- Seed a default CRM-status-mapping config.  Admin can edit from the UI.
INSERT INTO admin_settings (key, value)
VALUES (
  'crm_status_mapping',
  '{
    "pipeline_name": "Designers and Editors",
    "form_types": ["creative"],
    "crm_webhook_url": "",
    "mappings": {
      "new": "New",
      "share_form": "Share form",
      "form_filled": "Form Filled / For Review",
      "under_review": "Form Filled / For Review",
      "shortlisted": "Shortlisted",
      "signed_up": "Signed Up",
      "partner_onboarding": "Onboarding Training",
      "onboarding_training": "Onboarding Training",
      "basic_profile": "Basic Profile",
      "job_profile": "Job Profile",
      "portfolio_updation": "Portfolio Updation",
      "final_review": "Final Review",
      "onboard_completed": "Live",
      "live": "Live",
      "no_response": "No Response / In Active",
      "archived": "No Response / In Active"
    }
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
