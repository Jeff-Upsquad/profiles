-- ============================================================
-- Auto-approval rules for public forms
-- ============================================================

ALTER TABLE public_forms
  ADD COLUMN IF NOT EXISTS auto_approval_rules JSONB NOT NULL
    DEFAULT '{"enabled": false, "match_mode": "all", "rules": [], "approved_redirect_url": ""}';

ALTER TABLE lead_submissions
  ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN NOT NULL DEFAULT false;
