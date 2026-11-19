-- Migration: 20261119120000_profile_share_links.sql
-- Description: Create profile_share_links table for time-limited public access to talent profiles.

CREATE TABLE IF NOT EXISTS public.profile_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  created_by UUID,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_profile_share_links_token ON public.profile_share_links (token);
CREATE INDEX IF NOT EXISTS idx_profile_share_links_profile_id ON public.profile_share_links (profile_id);

ALTER TABLE public.profile_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_share_links_admin_all ON public.profile_share_links
  FOR ALL TO authenticated
  USING (is_admin());
