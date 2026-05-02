-- Per-course completion deadlines.
--
-- Admins can opt-in a course by setting countdown_enabled=true and a positive
-- countdown_hours. The first time a talent opens such a course they see a
-- start popup; clicking Start writes a row into training_course_starts.
-- The deadline is started_at + countdown_hours hours. Once exceeded the
-- course locks (chapters become unlocked=false and lesson completion is
-- rejected server-side). Approved talents bypass the lock.

ALTER TABLE training_courses
  ADD COLUMN countdown_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN countdown_hours INT;

ALTER TABLE training_courses
  ADD CONSTRAINT countdown_hours_positive
    CHECK (countdown_hours IS NULL OR countdown_hours > 0);

CREATE TABLE training_course_starts (
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (talent_user_id, course_id)
);

CREATE INDEX idx_training_course_starts_user
  ON training_course_starts(talent_user_id);

ALTER TABLE training_course_starts ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_course_starts_select_self ON training_course_starts
  FOR SELECT TO authenticated
  USING (talent_user_id = auth.uid());

CREATE POLICY training_course_starts_insert_self ON training_course_starts
  FOR INSERT TO authenticated
  WITH CHECK (talent_user_id = auth.uid());
