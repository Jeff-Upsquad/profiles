BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Training Chapters
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_chapters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    description TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_training_chapters_updated_at
    BEFORE UPDATE ON training_chapters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Chapter ↔ Category (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_chapter_categories (
    chapter_id  UUID NOT NULL REFERENCES training_chapters(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id)        ON DELETE CASCADE,
    PRIMARY KEY (chapter_id, category_id)
);

CREATE INDEX idx_training_chapter_categories_category
    ON training_chapter_categories(category_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Training Lessons (belong to one chapter)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_lessons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id  UUID NOT NULL REFERENCES training_chapters(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    loom_url    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_training_lessons_chapter_sort
    ON training_lessons(chapter_id, sort_order);

CREATE TRIGGER set_training_lessons_updated_at
    BEFORE UPDATE ON training_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- Lesson Progress (per-user completion tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE training_lesson_progress (
    talent_user_id UUID NOT NULL REFERENCES talent_users(id)    ON DELETE CASCADE,
    lesson_id      UUID NOT NULL REFERENCES training_lessons(id) ON DELETE CASCADE,
    completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (talent_user_id, lesson_id)
);

CREATE INDEX idx_training_lesson_progress_user
    ON training_lesson_progress(talent_user_id);

COMMIT;
