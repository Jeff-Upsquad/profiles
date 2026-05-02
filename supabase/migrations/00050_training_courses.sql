-- Add a courses layer above training_chapters.
-- Migration is intentionally backward-compatible: course_id on chapters is
-- nullable so existing chapters survive without immediate triage. A follow-up
-- cleanup migration will tighten the schema (drop is_onboarding/language on
-- chapters, drop training_chapter_categories, set course_id NOT NULL) once
-- admins have moved every chapter into a course.

CREATE TABLE training_courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_training_courses_updated_at
  BEFORE UPDATE ON training_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE training_course_categories (
  course_id   UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, category_id)
);

CREATE INDEX idx_training_course_categories_category
  ON training_course_categories(category_id);

-- Enforce: a category can appear in at most one ACTIVE onboarding course.
-- Postgres partial indexes can't reference other tables (IMMUTABLE-only)
-- so we use a BEFORE INSERT/UPDATE trigger on training_course_categories.
CREATE OR REPLACE FUNCTION enforce_onboarding_category_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM training_courses
    WHERE id = NEW.course_id
      AND is_onboarding = true
      AND deleted_at IS NULL
  ) AND EXISTS (
    SELECT 1
    FROM training_course_categories tcc
    JOIN training_courses c ON c.id = tcc.course_id
    WHERE tcc.category_id = NEW.category_id
      AND tcc.course_id <> NEW.course_id
      AND c.is_onboarding = true
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Category % is already linked to another active onboarding course', NEW.category_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_course_categories_onboarding_uniqueness
  BEFORE INSERT OR UPDATE ON training_course_categories
  FOR EACH ROW EXECUTE FUNCTION enforce_onboarding_category_uniqueness();

-- Add course_id to chapters (nullable for backward compatibility during rollout)
ALTER TABLE training_chapters
  ADD COLUMN course_id UUID REFERENCES training_courses(id) ON DELETE SET NULL;

CREATE INDEX idx_training_chapters_course_sort
  ON training_chapters(course_id, sort_order);

-- Lift the existing onboarding chapter into a new onboarding course (idempotent).
WITH src AS (
  SELECT id, title, description
  FROM training_chapters
  WHERE is_onboarding = true
  LIMIT 1
), new_course AS (
  INSERT INTO training_courses (title, description, is_onboarding, sort_order)
  SELECT title, description, true, 0 FROM src
  WHERE NOT EXISTS (SELECT 1 FROM training_courses WHERE is_onboarding = true)
  RETURNING id
), existing_course AS (
  SELECT id FROM training_courses WHERE is_onboarding = true LIMIT 1
), target_course AS (
  SELECT id FROM new_course
  UNION ALL
  SELECT id FROM existing_course
  LIMIT 1
)
UPDATE training_chapters
SET course_id = (SELECT id FROM target_course)
WHERE is_onboarding = true
  AND course_id IS NULL;

-- Copy categories from the onboarding chapter to its new course
INSERT INTO training_course_categories (course_id, category_id)
SELECT DISTINCT c.course_id, tcc.category_id
FROM training_chapters c
JOIN training_chapter_categories tcc ON tcc.chapter_id = c.id
WHERE c.is_onboarding = true
  AND c.course_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- RLS: allow admin (already covered by service role) and authenticated reads
ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_course_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_courses_select_authenticated ON training_courses
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY training_course_categories_select_authenticated ON training_course_categories
  FOR SELECT
  TO authenticated
  USING (true);
