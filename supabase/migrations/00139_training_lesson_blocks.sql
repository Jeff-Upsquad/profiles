-- =============================================================
-- Training lesson blocks — rich content on lessons (SOP-style)
-- =============================================================
-- Lessons used to be a single description + video URL. This adds ordered
-- content blocks (text / image / video_upload / video_embed / audio / pdf),
-- mirroring training_sop_blocks, so a lesson can be a full doc like the
-- SquadHub Systems & Procedures pages. When blocks exist, the talent course
-- reader renders them below (or instead of) the legacy video.

BEGIN;

CREATE TABLE IF NOT EXISTS training_lesson_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id       UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN ('text', 'image', 'video_upload', 'video_embed', 'audio', 'pdf')),
  position        INTEGER NOT NULL DEFAULT 0,
  text_content    JSONB,
  file_url        TEXT,
  file_name       TEXT,
  file_size       INTEGER,
  mime_type       TEXT,
  embed_url       TEXT,
  embed_provider  TEXT,
  caption         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_lesson_blocks_lesson
  ON training_lesson_blocks (lesson_id, position);

CREATE TRIGGER set_training_lesson_blocks_updated_at
  BEFORE UPDATE ON training_lesson_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE training_lesson_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_lesson_blocks_select_authenticated ON training_lesson_blocks
  FOR SELECT TO authenticated
  USING (true);

COMMIT;
