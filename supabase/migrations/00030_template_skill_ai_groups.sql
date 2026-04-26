-- 00030_template_skill_ai_groups.sql
-- Adds optional `group` column to template_skill_sets and template_ai_tools
-- (template_tools already has it from migration 00023).
--
-- Then sets group + sort_order on the Designer + Editor category rows so the
-- profile-creation form renders Designer skills/tools/AI-tools first and
-- Editor (Video Editor) ones second under their own subheadings.
--
-- No effect on Designer or Video Editor categories — their rows keep
-- group = NULL, which the form treats as a single flat list.
-- Idempotent — safe to re-run.

ALTER TABLE template_skill_sets ADD COLUMN IF NOT EXISTS "group" TEXT;
ALTER TABLE template_ai_tools  ADD COLUMN IF NOT EXISTS "group" TEXT;

-- 1. Skills (8 Designer + 9 Editor)
UPDATE template_skill_sets ts
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Branding',                          'Designer', 0),
  ('Logo Design',                       'Designer', 0),
  ('Motion & Advanced Design',          'Designer', 0),
  ('Product & Print Design',            'Designer', 0),
  ('Social Media Creatives',            'Designer', 0),
  ('UI Designs',                        'Designer', 0),
  ('UX Designs',                        'Designer', 0),
  ('Visual Identity Design',            'Designer', 0),
  ('AI tools for editing',              'Editor',   1),
  ('Audio syncing & balancing',         'Editor',   1),
  ('Color grading & correction',        'Editor',   1),
  ('Continuity awareness',              'Editor',   1),
  ('Motion Graphics',                   'Editor',   1),
  ('Sound Design',                      'Editor',   1),
  ('Storytelling',                      'Editor',   1),
  ('Typography & text animation basics','Editor',   1),
  ('VFX',                               'Editor',   1)
) AS sub(name, grp, so)
WHERE ts.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND ts.name = sub.name;

-- 2. Tools (6 Designer + 6 Editor)
UPDATE template_tools tt
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Adobe Illustrator',  'Designer', 0),
  ('Adobe Photoshop',    'Designer', 0),
  ('Affinity Designer',  'Designer', 0),
  ('After Effects',      'Designer', 0),
  ('Canva',              'Designer', 0),
  ('Procreate',          'Designer', 0),
  ('Adobe Premiere Pro', 'Editor',   1),
  ('CapCut',             'Editor',   1),
  ('DaVinci Resolve',    'Editor',   1),
  ('Final Cut Pro (FCP)','Editor',   1),
  ('InShot',             'Editor',   1),
  ('VN Video Editor',    'Editor',   1)
) AS sub(name, grp, so)
WHERE tt.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND tt.name = sub.name;

-- 3. AI Tools (3 Designer + 13 Editor)
UPDATE template_ai_tools tat
SET "group" = sub.grp,
    sort_order = sub.so
FROM (VALUES
  ('Freepik',             'Designer', 0),
  ('Gemini - nana banana','Designer', 0),
  ('Midjourney',          'Designer', 0),
  ('Descript',            'Editor',   1),
  ('Google Veo',          'Editor',   1),
  ('Grok',                'Editor',   1),
  ('HeyGen',              'Editor',   1),
  ('Higgsfield AI',       'Editor',   1),
  ('Kling AI',            'Editor',   1),
  ('Luma Dream Machine',  'Editor',   1),
  ('OpusClip',            'Editor',   1),
  ('Pika Labs',           'Editor',   1),
  ('Runway',              'Editor',   1),
  ('Seedance',            'Editor',   1),
  ('Synthesia',           'Editor',   1),
  ('Vizard.ai',           'Editor',   1)
) AS sub(name, grp, so)
WHERE tat.category_id = (SELECT id FROM categories WHERE slug = 'designer-editor')
  AND tat.name = sub.name;
