-- Columns + checklist seed for the request-changes review outcome.
-- Requires 00146 (enum value) to be committed first.

ALTER TABLE talent_profiles
  -- [{ key, label, section, note? }] — the ticked checklist items, snapshotted
  -- at request time so later edits to the checklist don't rewrite history.
  ADD COLUMN IF NOT EXISTS requested_changes JSONB,
  ADD COLUMN IF NOT EXISTS changes_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS changes_requested_by UUID REFERENCES auth.users(id),
  -- Stamped when the talent taps "Resubmit for review"; cleared on approve.
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ,
  -- Whether the CRM confirmed a WhatsApp send for the request (null = not attempted).
  ADD COLUMN IF NOT EXISTS changes_whatsapp_sent BOOLEAN;

COMMENT ON COLUMN talent_profiles.requested_changes IS
  'Checklist items the reviewer asked the talent to fix (status=changes_requested). Kept after resubmit so the reviewer sees what was asked.';

CREATE INDEX IF NOT EXISTS idx_talent_profiles_changes_requested
  ON talent_profiles (changes_requested_at)
  WHERE status = 'changes_requested' AND deleted_at IS NULL;

-- Editable checklist the "Request changes" dialog offers. Category-specific
-- form fields are appended at runtime from category_fields, so only the
-- shared items live here.
INSERT INTO admin_settings (key, value)
VALUES ('review_checklist', '[
  {"key":"basic.photo","section":"Basic profile","label":"Profile photo","message":"Upload a clear, front-facing profile photo"},
  {"key":"basic.address","section":"Basic profile","label":"Permanent address","message":"Complete your permanent address (country, state, district, city)"},
  {"key":"basic.language","section":"Basic profile","label":"Languages","message":"Add your languages and mark one as native"},
  {"key":"basic.education","section":"Basic profile","label":"Education","message":"Add at least one course with institution name"},
  {"key":"basic.experience","section":"Basic profile","label":"Experience","message":"Add your work experience (company and designation)"},
  {"key":"basic.work_type","section":"Basic profile","label":"Work preference","message":"Choose your work preference (salary / freelance / partner program)"},
  {"key":"basic.job_preference","section":"Basic profile","label":"Job preference","message":"Set your availability and job type (remote / office / hybrid / field)"},
  {"key":"basic.resume","section":"Basic profile","label":"Resume","message":"Upload your resume"},
  {"key":"basic.freelance","section":"Basic profile","label":"Freelance availability","message":"Confirm your freelance availability"},
  {"key":"basic.partner_hours","section":"Basic profile","label":"Partner program hours","message":"Set your office hours and daily available hours"},
  {"key":"identity.aadhaar","section":"Identity & payments","label":"Aadhaar","message":"Upload a readable copy of your Aadhaar"},
  {"key":"identity.pan","section":"Identity & payments","label":"PAN","message":"Upload a readable copy of your PAN card"},
  {"key":"identity.bank","section":"Identity & payments","label":"Bank details","message":"Add your bank account details (holder name, account no., IFSC)"},
  {"key":"job.portfolio_count","section":"Job profile","label":"Portfolio / work samples","message":"Add at least 10 work samples to your portfolio"},
  {"key":"job.portfolio_quality","section":"Job profile","label":"Portfolio quality","message":"Replace low-quality or unrelated work samples"},
  {"key":"job.bio","section":"Job profile","label":"Bio / summary","message":"Rewrite your bio: 3-4 lines about what you do and who you have worked with"},
  {"key":"job.skills","section":"Job profile","label":"Skills","message":"Review your skills list and remove ones you do not actually use"},
  {"key":"job.experience_level","section":"Job profile","label":"Experience level","message":"Your experience level does not match your work history, please correct it"},
  {"key":"job.rate","section":"Job profile","label":"Rate / expected pay","message":"Add your expected rate or salary"},
  {"key":"job.contact","section":"Job profile","label":"Contact details","message":"Verify your phone number and email"}
]'::jsonb)
ON CONFLICT (key) DO NOTHING;
