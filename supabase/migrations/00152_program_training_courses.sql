-- Two optional, independently tracked courses for the Jobs and Partner Program
-- cohorts. Their content remains owned by the matching SquadHub Resources item.
ALTER TABLE training_items
  ADD COLUMN IF NOT EXISTS program_track TEXT
    CHECK (program_track IN ('jobs', 'partner'));

ALTER TABLE training_items
  ADD COLUMN IF NOT EXISTS squadhub_visible BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS training_items_one_live_program_course
  ON training_items (program_track)
  WHERE program_track IS NOT NULL AND deleted_at IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'training_items_program_courses_are_optional'
  ) THEN
    ALTER TABLE training_items
      ADD CONSTRAINT training_items_program_courses_are_optional
      CHECK (program_track IS NULL OR (is_onboarding = false AND countdown_enabled = false));
  END IF;
END $$;

INSERT INTO training_items
  (squadhub_item_id, kind, track, title, summary, status, is_active,
   is_onboarding, available_to_all, countdown_enabled, program_track, sort_order)
VALUES
  ('7f1e32db-469e-4bfc-88d9-97162358d1ee', 'course', 'learning',
   'SquadHire Jobs Module Training', 'Training for talents looking for jobs.',
   'draft', true, false, true, false, 'jobs', 20),
  ('ba493993-771d-4969-8e16-18489be875c0', 'course', 'learning',
   'SquadHire Partner Program Module Training', 'Training for Partner Program talents.',
   'draft', true, false, true, false, 'partner', 21)
ON CONFLICT (squadhub_item_id) DO UPDATE SET
  program_track = EXCLUDED.program_track,
  available_to_all = true,
  is_onboarding = false,
  countdown_enabled = false,
  countdown_hours = NULL;
