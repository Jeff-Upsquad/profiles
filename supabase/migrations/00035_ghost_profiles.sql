-- 00035_ghost_profiles.sql
-- Ghost Designer+Editor profile mechanism.
--
-- A "ghost" talent_profile is auto-generated for any talent who has both a
-- Designer profile and a Video Editor profile. It points to those two source
-- profiles via foreign keys and acts as a virtual Designer + Editor entry
-- for business discovery and subscription matching. Talents never create or
-- edit a ghost row directly — it's maintained by the backend
-- ghost-profile service.
--
-- Idempotent — safe to re-run.

-- 1. New columns on talent_profiles
ALTER TABLE talent_profiles
  ADD COLUMN IF NOT EXISTS is_ghost BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_designer_profile_id UUID
    REFERENCES talent_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_editor_profile_id UUID
    REFERENCES talent_profiles(id) ON DELETE CASCADE;

-- 2. Constraint: ghost rows must reference both source profiles.
ALTER TABLE talent_profiles
  DROP CONSTRAINT IF EXISTS talent_profiles_ghost_source_check;
ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_ghost_source_check CHECK (
    is_ghost = FALSE OR (
      source_designer_profile_id IS NOT NULL
      AND source_editor_profile_id IS NOT NULL
    )
  );

-- The existing uq_talent_profiles_user_category index already enforces
-- "at most one non-deleted profile per (talent_user_id, category_id)",
-- which naturally caps a talent at one ghost in the designer-editor
-- category — no additional unique index needed.

-- 3. Index for cascade lookups (ghost cleanup when a source profile is
--    hard-deleted is handled by the FK CASCADE; this index speeds up the
--    ghost service's reverse lookups).
CREATE INDEX IF NOT EXISTS idx_talent_profiles_source_designer
  ON talent_profiles (source_designer_profile_id)
  WHERE source_designer_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_talent_profiles_source_editor
  ON talent_profiles (source_editor_profile_id)
  WHERE source_editor_profile_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill existing data.
--
-- Slugs assumed:
--   * 'designer'        — Designer category
--   * 'video-editor'    — Video Editor category
--   * 'designer-editor' — Combined Designer + Editor (now ghost-only)
--
-- Steps:
--   4a. For talents who already have separate Designer + Video Editor
--       profiles AND a legacy combined Designer+Editor row: drop the
--       legacy combined row. The ghost (4c) will replace it.
--   4b. For talents who have ONLY a legacy combined row (no separates):
--       split it into a Designer profile and a Video Editor profile,
--       copying field_data and resume_url to both. Reassign portfolio
--       items to the new Designer profile (admins can re-tag editor
--       items later via the existing portfolio re-categorization UI).
--       Then drop the original combined row.
--   4c. Insert ghost rows for every talent who now has both a Designer
--       and a Video Editor profile but no ghost yet.
-- ---------------------------------------------------------------------------

-- 4a. Drop redundant legacy combined rows
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  redundant_legacy AS (
    SELECT c.id
    FROM talent_profiles c
    WHERE c.category_id = (SELECT id FROM combined_cat)
      AND c.is_ghost = FALSE
      AND c.deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM talent_profiles d
        WHERE d.talent_user_id = c.talent_user_id
          AND d.category_id = (SELECT id FROM designer_cat)
          AND d.deleted_at IS NULL
      )
      AND EXISTS (
        SELECT 1 FROM talent_profiles e
        WHERE e.talent_user_id = c.talent_user_id
          AND e.category_id = (SELECT id FROM editor_cat)
          AND e.deleted_at IS NULL
      )
  )
DELETE FROM talent_profiles
WHERE id IN (SELECT id FROM redundant_legacy);

-- 4b. Split standalone-only legacy combined rows into separate Designer +
--     Video Editor profiles. We use a temp table so we can reassign
--     portfolio items by talent_user_id deterministically before deleting
--     the original combined row.
DROP TABLE IF EXISTS pg_temp.legacy_combined_split;
CREATE TEMP TABLE pg_temp.legacy_combined_split AS
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1)
SELECT p.id AS legacy_id, p.talent_user_id, p.status, p.field_data,
       p.resume_url, p.is_active,
       (SELECT id FROM designer_cat) AS designer_cat_id,
       (SELECT id FROM editor_cat)   AS editor_cat_id
FROM talent_profiles p
WHERE p.category_id = (SELECT id FROM combined_cat)
  AND p.is_ghost = FALSE
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM talent_profiles d
    WHERE d.talent_user_id = p.talent_user_id
      AND d.category_id = (SELECT id FROM designer_cat)
      AND d.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM talent_profiles e
    WHERE e.talent_user_id = p.talent_user_id
      AND e.category_id = (SELECT id FROM editor_cat)
      AND e.deleted_at IS NULL
  );

-- Insert separate Designer profiles, capturing the new IDs alongside legacy_id
DROP TABLE IF EXISTS pg_temp.split_designer_ids;
CREATE TEMP TABLE pg_temp.split_designer_ids (legacy_id UUID, new_id UUID);

WITH inserted AS (
  INSERT INTO talent_profiles (
    talent_user_id, category_id, status, field_data, resume_url, is_active
  )
  SELECT talent_user_id, designer_cat_id, status, field_data, resume_url, is_active
  FROM pg_temp.legacy_combined_split
  RETURNING id, talent_user_id
)
INSERT INTO pg_temp.split_designer_ids (legacy_id, new_id)
SELECT s.legacy_id, i.id
FROM pg_temp.legacy_combined_split s
JOIN inserted i ON i.talent_user_id = s.talent_user_id;

-- Insert separate Video Editor profiles
INSERT INTO talent_profiles (
  talent_user_id, category_id, status, field_data, resume_url, is_active
)
SELECT talent_user_id, editor_cat_id, status, field_data, resume_url, is_active
FROM pg_temp.legacy_combined_split;

-- Reassign portfolio items from legacy combined → new Designer profile
UPDATE portfolio_items pi
SET profile_id = sd.new_id
FROM pg_temp.split_designer_ids sd
WHERE pi.profile_id = sd.legacy_id;

-- Drop the legacy combined rows
DELETE FROM talent_profiles
WHERE id IN (SELECT legacy_id FROM pg_temp.legacy_combined_split);

DROP TABLE IF EXISTS pg_temp.legacy_combined_split;
DROP TABLE IF EXISTS pg_temp.split_designer_ids;

-- 4c. Insert ghost rows for talents with both Designer + Video Editor.
-- The ghost.status is 'approved' iff both source profiles are 'approved',
-- otherwise 'draft'. Business discovery / subscription matching only
-- considers 'approved' rows, so this preserves the existing gating.
WITH
  designer_cat AS (SELECT id FROM categories WHERE slug = 'designer' LIMIT 1),
  editor_cat   AS (SELECT id FROM categories WHERE slug = 'video-editor' LIMIT 1),
  combined_cat AS (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  pairs AS (
    SELECT
      d.talent_user_id,
      d.id AS designer_id,
      e.id AS editor_id,
      CASE
        WHEN d.status = 'approved' AND e.status = 'approved' THEN 'approved'
        ELSE 'draft'
      END AS computed_status
    FROM talent_profiles d
    JOIN talent_profiles e ON e.talent_user_id = d.talent_user_id
    WHERE d.category_id = (SELECT id FROM designer_cat)
      AND e.category_id = (SELECT id FROM editor_cat)
      AND d.deleted_at IS NULL
      AND e.deleted_at IS NULL
      AND d.is_ghost = FALSE
      AND e.is_ghost = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM talent_profiles g
        WHERE g.talent_user_id = d.talent_user_id
          AND g.category_id = (SELECT id FROM combined_cat)
          AND g.is_ghost = TRUE
          AND g.deleted_at IS NULL
      )
  )
INSERT INTO talent_profiles (
  talent_user_id, category_id, status, field_data, is_active, is_ghost,
  source_designer_profile_id, source_editor_profile_id
)
SELECT
  p.talent_user_id,
  (SELECT id FROM categories WHERE slug = 'designer-editor' LIMIT 1),
  p.computed_status::profile_status_enum,
  '{}'::jsonb,
  TRUE,
  TRUE,
  p.designer_id,
  p.editor_id
FROM pairs p;
