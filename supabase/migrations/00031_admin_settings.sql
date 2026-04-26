-- Generic key/value store for global admin settings.
-- Seeded with the auto_approve_signups flag used by the User Approvals page.

CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

INSERT INTO admin_settings (key, value)
VALUES ('auto_approve_signups', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
