-- 00034_portfolio_categories.sql
-- Adds a fourth template axis ("Categories" — portfolio genres) per parent
-- category, plus per-portfolio-item category assignment and a many-to-many
-- skill tagging table. Backfills existing portfolio_items.skill_name into
-- the new junction so legacy rows render their old skill as a single chip.
-- Idempotent — safe to re-run.

-- =========================================================================
-- 1. template_categories — admin-managed list of portfolio genres per
--    parent category. Mirrors template_skill_sets shape.
-- =========================================================================

CREATE TABLE IF NOT EXISTS template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_template_categories_category
  ON template_categories(category_id);

DROP TRIGGER IF EXISTS set_template_categories_updated_at ON template_categories;
CREATE TRIGGER set_template_categories_updated_at
  BEFORE UPDATE ON template_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active template categories"
  ON template_categories;
CREATE POLICY "Public can read active template categories"
  ON template_categories FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can manage template categories"
  ON template_categories;
CREATE POLICY "Admins can manage template categories"
  ON template_categories FOR ALL USING (is_admin());

-- =========================================================================
-- 2. portfolio_items.category_name — which genre a video was uploaded
--    under. Nullable so legacy rows stay untouched and surface as
--    "Uncategorized" until the editor reassigns them.
-- =========================================================================

ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS category_name TEXT;

CREATE INDEX IF NOT EXISTS idx_portfolio_items_category_name
  ON portfolio_items(category_name);

-- =========================================================================
-- 3. portfolio_item_skills — many-to-many tagging for "skills demonstrated
--    in this video". The single skill_name column on portfolio_items
--    stays for legacy reads; the junction is the source of truth going
--    forward (see talent.service.ts).
-- =========================================================================

CREATE TABLE IF NOT EXISTS portfolio_item_skills (
  portfolio_item_id UUID NOT NULL REFERENCES portfolio_items(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  PRIMARY KEY (portfolio_item_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_item_skills_item
  ON portfolio_item_skills(portfolio_item_id);

ALTER TABLE portfolio_item_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Talent can manage own portfolio item skills"
  ON portfolio_item_skills;
CREATE POLICY "Talent can manage own portfolio item skills"
  ON portfolio_item_skills FOR ALL
  USING (
    portfolio_item_id IN (
      SELECT pi.id FROM portfolio_items pi
      JOIN talent_profiles tp ON tp.id = pi.profile_id
      WHERE tp.talent_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read portfolio item skills"
  ON portfolio_item_skills;
CREATE POLICY "Admins can read portfolio item skills"
  ON portfolio_item_skills FOR SELECT USING (is_admin());

-- =========================================================================
-- 4. Backfill existing portfolio_items so each legacy row contributes
--    its single skill_name to the junction. category_name stays NULL.
-- =========================================================================

INSERT INTO portfolio_item_skills (portfolio_item_id, skill_name)
SELECT id, skill_name
FROM portfolio_items
WHERE skill_name IS NOT NULL AND skill_name <> ''
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 5. Seed the genre list for the Designer + Editor parent category.
-- =========================================================================

WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_categories (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Shorts Edits'),
  ('Youtube Video'),
  ('Events'),
  ('Wedding'),
  ('Automobile'),
  ('Architecture'),
  ('Landscape'),
  ('Short Films'),
  ('Movies'),
  ('Music and Albums'),
  ('AI Video'),
  ('Motion Graphics')
) AS c(name)
ON CONFLICT (category_id, name) DO NOTHING;
