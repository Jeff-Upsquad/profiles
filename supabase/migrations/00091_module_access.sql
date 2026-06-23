-- =============================================================================
-- 00091_module_access.sql
-- Module-level access control for the admin panel + a separate "staff" user
-- class (custom-JWT, mirrors business_users) with per-module permission tiers.
--
-- Tiers: view < edit < full < admin
--   view  — read only (GET)
--   edit  — read + create/update (POST/PUT/PATCH)
--   full  — + delete (DELETE)
--   admin — full + may manage other users' access to that same module
--
-- Staff users authenticate at /api/staff-auth/login and use the same
-- /api/admin/* surface as full admins, gated per-module by enforceModuleAccess.
-- Full admins (Supabase user_metadata.role='admin') bypass these checks.
-- =============================================================================

-- Permission tiers (ordered low -> high)
CREATE TYPE module_permission AS ENUM ('view', 'edit', 'full', 'admin');

-- Registry of grantable admin modules (seeded to match the sidebar)
CREATE TABLE admin_modules (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  section     TEXT NOT NULL,            -- 'Talent' | 'Clients & Pipeline' | 'Content' | 'System'
  sort        INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff users (custom-JWT class; NOT Supabase auth users)
CREATE TABLE staff_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_users_email ON staff_users (lower(email));

-- Revocable sessions (mirrors business_sessions)
CREATE TABLE staff_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_sessions_token ON staff_sessions (token);

-- Per-(user, module) grant at a tier
CREATE TABLE staff_module_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  module_slug   TEXT NOT NULL REFERENCES admin_modules(slug) ON DELETE CASCADE,
  permission    module_permission NOT NULL DEFAULT 'view',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, module_slug)
);
CREATE INDEX idx_staff_module_grants_user ON staff_module_grants (staff_user_id);

-- RLS: admin-only. The backend uses the service-role key and bypasses RLS;
-- these policies guard against any direct (anon/user-JWT) access.
ALTER TABLE admin_modules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_module_grants  ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_modules_admin_all       ON admin_modules        FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY staff_users_admin_all         ON staff_users          FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY staff_sessions_admin_all      ON staff_sessions       FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY staff_module_grants_admin_all ON staff_module_grants  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Seed the module registry (matches admin/src/config/modules.tsx)
INSERT INTO admin_modules (slug, name, section, sort) VALUES
  ('talents',         'Talent (Partner/Freelance/Jobs)', 'Talent',             10),
  ('invitations',     'Invitations',                     'Talent',             20),
  ('approvals',       'Approvals',                       'Talent',             30),
  ('reviews',         'Reviews',                         'Talent',             40),
  ('training',        'Training',                        'Talent',             50),
  ('business',        'Business',                        'Clients & Pipeline', 60),
  ('candidates',      'Candidates',                      'Clients & Pipeline', 70),
  ('shortlists',      'Shortlists',                      'Clients & Pipeline', 80),
  ('published-cards', 'Published Cards',                 'Clients & Pipeline', 90),
  ('talent-access',   'Talent Access',                   'Clients & Pipeline', 100),
  ('categories',      'Categories',                      'Content',            110),
  ('how-it-works',    'How it works',                    'Content',            120),
  ('forms',           'Public Forms',                    'Content',            130),
  ('notifications',   'Notifications',                   'Content',            140),
  ('users',           'Users',                           'System',             150),
  ('talent-app',      'Talent App',                      'System',             160),
  ('access-requests', 'Access Requests',                 'System',             170),
  ('automations',     'Automations',                     'System',             180),
  ('crm-mapping',     'CRM Mapping',                     'System',             190),
  ('archive',         'Archive (Recycle Bin)',           'System',             200),
  ('team-access',     'Team & Access',                   'System',             210)
ON CONFLICT (slug) DO NOTHING;
