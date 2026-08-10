-- =============================================================
-- Training assignments — enrollment + notify/clear-on-complete
-- =============================================================
-- Materializes "this talent must complete this course/SOP".
-- Sidebar Training badge counts incomplete rows.
-- Share-by-job-profile creates rows + system notifications;
-- completing the resource marks the assignment done and the
-- linked notification read.

BEGIN;

-- ---------------------------------------------------------------------------
-- training_assignments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id   UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  resource_type    TEXT NOT NULL CHECK (resource_type IN ('course', 'sop')),
  resource_id      UUID NOT NULL,
  status           TEXT NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER NOT NULL DEFAULT 0
                     CHECK (progress_percent >= 0 AND progress_percent <= 100),
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  source           TEXT NOT NULL DEFAULT 'manual_share'
                     CHECK (source IN (
                       'auto_category',
                       'available_to_all',
                       'manual_share',
                       'onboarding',
                       'backfill'
                     )),
  -- Most recent system notification created for this assignment (clear-on-complete)
  notification_id  UUID REFERENCES notifications(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (talent_user_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_training_assignments_talent_status
  ON training_assignments (talent_user_id, status);

CREATE INDEX IF NOT EXISTS idx_training_assignments_resource
  ON training_assignments (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_training_assignments_incomplete
  ON training_assignments (talent_user_id)
  WHERE status <> 'completed';

CREATE TRIGGER set_training_assignments_updated_at
  BEFORE UPDATE ON training_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; defense-in-depth for authenticated clients.
CREATE POLICY training_assignments_select_own ON training_assignments
  FOR SELECT
  TO authenticated
  USING (talent_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Course publish status (draft | published). Existing courses are published.
-- Soft-archive remains on training_courses.deleted_at / is_active.
-- ---------------------------------------------------------------------------
ALTER TABLE training_courses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Tighten allowed values if unconstrained was just added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'training_courses_status_check'
  ) THEN
    ALTER TABLE training_courses
      ADD CONSTRAINT training_courses_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

UPDATE training_courses
SET status = 'published'
WHERE status IS NULL OR status = '';

-- ---------------------------------------------------------------------------
-- Backfill: enroll talents in courses they can already see.
-- Visibility mirrors getMyCourses:
--   available_to_all → all active talents
--   onboarding → talents with a profile in a linked category
--   other courses → no categories → all active; else category match
-- ---------------------------------------------------------------------------

-- Active talents
WITH active_talents AS (
  SELECT id AS talent_user_id
  FROM talent_users
  WHERE COALESCE(is_active, true) = true
),
-- Talent → categories (non-deleted profiles)
talent_cats AS (
  SELECT DISTINCT talent_user_id, category_id
  FROM talent_profiles
  WHERE deleted_at IS NULL
),
visible AS (
  -- available_to_all
  SELECT at.talent_user_id, c.id AS course_id,
         CASE WHEN c.is_onboarding THEN 'onboarding' ELSE 'available_to_all' END AS source
  FROM training_courses c
  CROSS JOIN active_talents at
  WHERE c.deleted_at IS NULL
    AND c.is_active = true
    AND c.available_to_all = true

  UNION

  -- category-targeted (onboarding or not)
  SELECT tc.talent_user_id, c.id AS course_id,
         CASE WHEN c.is_onboarding THEN 'onboarding' ELSE 'auto_category' END AS source
  FROM training_courses c
  JOIN training_course_categories tcc ON tcc.course_id = c.id
  JOIN talent_cats tc ON tc.category_id = tcc.category_id
  WHERE c.deleted_at IS NULL
    AND c.is_active = true
    AND COALESCE(c.available_to_all, false) = false

  UNION

  -- non-onboarding with zero categories → everyone (legacy "open" courses)
  SELECT at.talent_user_id, c.id AS course_id, 'backfill' AS source
  FROM training_courses c
  CROSS JOIN active_talents at
  WHERE c.deleted_at IS NULL
    AND c.is_active = true
    AND COALESCE(c.available_to_all, false) = false
    AND c.is_onboarding = false
    AND NOT EXISTS (
      SELECT 1 FROM training_course_categories tcc WHERE tcc.course_id = c.id
    )
)
INSERT INTO training_assignments (
  talent_user_id, resource_type, resource_id, source, status, progress_percent
)
SELECT DISTINCT
  v.talent_user_id,
  'course',
  v.course_id,
  v.source,
  'not_started',
  0
FROM visible v
ON CONFLICT (talent_user_id, resource_type, resource_id) DO NOTHING;

-- Seed progress from existing lesson completion
UPDATE training_assignments a
SET
  progress_percent = sub.pct,
  status = sub.status,
  started_at = CASE WHEN sub.pct > 0 AND a.started_at IS NULL THEN now() ELSE a.started_at END,
  completed_at = CASE WHEN sub.status = 'completed' THEN COALESCE(a.completed_at, now()) ELSE a.completed_at END,
  updated_at = now()
FROM (
  SELECT
    a2.id AS assignment_id,
    CASE
      WHEN totals.total = 0 THEN 0
      ELSE LEAST(100, ROUND(100.0 * COALESCE(done.cnt, 0) / totals.total)::int)
    END AS pct,
    CASE
      WHEN totals.total > 0 AND COALESCE(done.cnt, 0) >= totals.total THEN 'completed'
      WHEN COALESCE(done.cnt, 0) > 0 THEN 'in_progress'
      ELSE 'not_started'
    END AS status
  FROM training_assignments a2
  JOIN (
    SELECT ch.course_id, COUNT(l.id)::int AS total
    FROM training_chapters ch
    JOIN training_lessons l ON l.chapter_id = ch.id AND l.is_active = true
    WHERE ch.course_id IS NOT NULL AND ch.is_active = true
    GROUP BY ch.course_id
  ) totals ON totals.course_id = a2.resource_id
  LEFT JOIN (
    SELECT ch.course_id, p.talent_user_id, COUNT(*)::int AS cnt
    FROM training_lesson_progress p
    JOIN training_lessons l ON l.id = p.lesson_id AND l.is_active = true
    JOIN training_chapters ch ON ch.id = l.chapter_id AND ch.is_active = true
    WHERE ch.course_id IS NOT NULL
    GROUP BY ch.course_id, p.talent_user_id
  ) done ON done.course_id = a2.resource_id AND done.talent_user_id = a2.talent_user_id
  WHERE a2.resource_type = 'course'
) sub
WHERE a.id = sub.assignment_id;

COMMIT;
