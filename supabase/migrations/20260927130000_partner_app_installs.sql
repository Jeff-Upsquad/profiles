-- Talents who have the SquadHub Partner app (in.squadhub.partner) installed.
-- SquadHub owns the source data (its partner_app_installs, fed by the app's
-- launch check-in); backend/src/services/partner-app-install.service.ts pulls it
-- every few minutes and keeps one row per matched talent here, matched by
-- email. Drives the admin "Partner App" page and the "Partner app downloaded"
-- tick on the Onboarding Hub talent board.
CREATE TABLE public.partner_app_installs (
  talent_user_id    uuid PRIMARY KEY REFERENCES public.talent_users(id) ON DELETE CASCADE,
  squadhub_user_id  uuid NOT NULL,
  platform          text NOT NULL CHECK (platform IN ('android', 'ios')),
  -- NULL for installs seen only through push registration on older builds.
  version_name      text,
  version_code      integer,
  first_seen_at     timestamptz NOT NULL,
  last_seen_at      timestamptz NOT NULL,
  synced_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_app_installs_last_seen_idx
  ON public.partner_app_installs (last_seen_at DESC);

ALTER TABLE public.partner_app_installs ENABLE ROW LEVEL SECURITY;

-- Only the backend's service-role client reads or writes this table.
REVOKE ALL ON TABLE public.partner_app_installs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.partner_app_installs TO service_role;
