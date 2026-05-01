-- Per-lesson language video variants. Each lesson can have one Loom URL per language.
CREATE TABLE training_lesson_videos (
  lesson_id UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  loom_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (lesson_id, language)
);

CREATE INDEX idx_training_lesson_videos_lesson ON training_lesson_videos(lesson_id);

-- Backfill existing lessons' loom_url as the English variant
INSERT INTO training_lesson_videos (lesson_id, language, loom_url)
SELECT id, 'en', loom_url
FROM training_lessons
WHERE loom_url IS NOT NULL AND loom_url != ''
ON CONFLICT (lesson_id, language) DO NOTHING;
