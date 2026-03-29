-- Migration: 00009_ai_tools_portfolio_share_links
-- Description: Add template AI tools, portfolio items, and profile share links tables.

-- =========================================================================
-- 1. Template AI Tools (per category, same pattern as template_tools)
-- =========================================================================

CREATE TABLE IF NOT EXISTS template_ai_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE TRIGGER set_template_ai_tools_updated_at
  BEFORE UPDATE ON template_ai_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active template ai tools"
  ON template_ai_tools FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage template ai tools"
  ON template_ai_tools FOR ALL
  USING (is_admin());

-- =========================================================================
-- 2. Portfolio Items (per profile, grouped by skill)
-- =========================================================================

CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'video')),
  file_name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_portfolio_items_profile ON portfolio_items (profile_id);

CREATE TRIGGER set_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Talent users can read own portfolio items"
  ON portfolio_items FOR SELECT
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can insert own portfolio items"
  ON portfolio_items FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can update own portfolio items"
  ON portfolio_items FOR UPDATE
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Talent users can delete own portfolio items"
  ON portfolio_items FOR DELETE
  USING (
    profile_id IN (
      SELECT id FROM talent_profiles WHERE talent_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all portfolio items"
  ON portfolio_items FOR SELECT
  USING (is_admin());

-- =========================================================================
-- 3. Profile Share Links (time-limited public access)
-- =========================================================================

CREATE TABLE IF NOT EXISTS profile_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES talent_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profile_share_links_token ON profile_share_links (token);
CREATE INDEX idx_profile_share_links_profile ON profile_share_links (profile_id);

ALTER TABLE profile_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage share links"
  ON profile_share_links FOR ALL
  USING (is_admin());
