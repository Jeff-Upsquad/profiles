-- Migration: 00073_admin_saved_lead_filters
-- Description: Per-admin saved filter presets for the Candidates list
--              (/admin/leads). Stores structured form_data filter rules so
--              admins can recall named cohorts (e.g. "Bangalore accountants").
--              The shape of `filter_json` is owned by the admin frontend.

CREATE TABLE IF NOT EXISTS admin_saved_lead_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  form_type text,
  filter_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_saved_lead_filters_user_idx
  ON admin_saved_lead_filters(admin_user_id, form_type);

COMMENT ON TABLE admin_saved_lead_filters IS
  'Saved filter presets owned by individual admin users. Filter JSON shape is owned by the admin UI.';
