-- Migration: 20261116163500_agency_share_links.sql
-- Description: Create agency_share_links table for time-limited public access to agency previews.

CREATE TABLE IF NOT EXISTS public.agency_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_user_id UUID NOT NULL REFERENCES public.agency_users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agency_share_links_token ON public.agency_share_links (token);
CREATE INDEX IF NOT EXISTS idx_agency_share_links_agency_user_id ON public.agency_share_links (agency_user_id);

ALTER TABLE public.agency_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY agency_share_links_select_own ON public.agency_share_links
  FOR SELECT TO authenticated
  USING (agency_user_id = (SELECT auth.uid()));

CREATE POLICY agency_share_links_insert_own ON public.agency_share_links
  FOR INSERT TO authenticated
  WITH CHECK (agency_user_id = (SELECT auth.uid()));

CREATE POLICY agency_share_links_update_own ON public.agency_share_links
  FOR UPDATE TO authenticated
  USING (agency_user_id = (SELECT auth.uid()))
  WITH CHECK (agency_user_id = (SELECT auth.uid()));

CREATE POLICY agency_share_links_delete_own ON public.agency_share_links
  FOR DELETE TO authenticated
  USING (agency_user_id = (SELECT auth.uid()));

CREATE POLICY agency_share_links_admin_all ON public.agency_share_links
  FOR ALL TO authenticated
  USING (is_admin());
