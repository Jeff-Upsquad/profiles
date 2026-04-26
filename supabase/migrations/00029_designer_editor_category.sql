-- 00029_designer_editor_category.sql
-- Adds the "Designer + Editor" talent category, plus its template skills,
-- tools, and AI tools (the union of the existing Designer and Video Editor
-- catalogs). Idempotent — safe to re-run.

-- 1. Category row
INSERT INTO categories (name, slug, description, is_active, sort_order)
VALUES (
  'Designer + Editor',
  'designer-editor',
  'Talents skilled in both graphic design and video editing.',
  TRUE,
  0
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Template skills (8 design + 9 editing = 17)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_skill_sets (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Branding'),
  ('Logo Design'),
  ('Motion & Advanced Design'),
  ('Product & Print Design'),
  ('Social Media Creatives'),
  ('UI Designs'),
  ('UX Designs'),
  ('Visual Identity Design'),
  ('AI tools for editing'),
  ('Audio syncing & balancing'),
  ('Color grading & correction'),
  ('Continuity awareness'),
  ('Motion Graphics'),
  ('Sound Design'),
  ('Storytelling'),
  ('Typography & text animation basics'),
  ('VFX')
) AS s(name)
ON CONFLICT (category_id, name) DO NOTHING;

-- 3. Template tools (6 design + 6 editing = 12)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_tools (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Adobe Illustrator'),
  ('Adobe Photoshop'),
  ('Affinity Designer'),
  ('After Effects'),
  ('Canva'),
  ('Procreate'),
  ('Adobe Premiere Pro'),
  ('CapCut'),
  ('DaVinci Resolve'),
  ('Final Cut Pro (FCP)'),
  ('InShot'),
  ('VN Video Editor')
) AS t(name)
ON CONFLICT (category_id, name) DO NOTHING;

-- 4. Template AI tools (3 design + 13 editing = 16)
WITH cat AS (SELECT id FROM categories WHERE slug = 'designer-editor')
INSERT INTO template_ai_tools (category_id, name, sort_order, is_active)
SELECT cat.id, name, 0, TRUE
FROM cat, (VALUES
  ('Freepik'),
  ('Gemini - nana banana'),
  ('Midjourney'),
  ('Descript'),
  ('Google Veo'),
  ('Grok'),
  ('HeyGen'),
  ('Higgsfield AI'),
  ('Kling AI'),
  ('Luma Dream Machine'),
  ('OpusClip'),
  ('Pika Labs'),
  ('Runway'),
  ('Seedance'),
  ('Synthesia'),
  ('Vizard.ai')
) AS a(name)
ON CONFLICT (category_id, name) DO NOTHING;
