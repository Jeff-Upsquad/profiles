-- Preserve all self-selected roles; signup_form_type remains the legacy primary pipeline.
ALTER TABLE public.talent_users
  ADD COLUMN IF NOT EXISTS signup_categories text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_talent_users_signup_categories
  ON public.talent_users USING gin (signup_categories);
COMMENT ON COLUMN public.talent_users.signup_categories IS
  'Explicit role slugs selected at signup, including separate designer and video-editor choices.';
