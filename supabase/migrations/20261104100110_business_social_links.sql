-- Public business profile links used by creator requirement cards.
-- Existing business_users ownership policies and grants continue to apply.
ALTER TABLE public.business_users
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(social_links) = 'object');
COMMENT ON COLUMN public.business_users.social_links IS
  'Public business social URLs keyed by platform; website remains in company_website.';
