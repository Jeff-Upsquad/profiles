-- =============================================================
-- 00141: Training restructured onto SquadHub's Resources model
-- =============================================================
-- Training content moves to SquadHub's Resources module as the single place
-- it is authored. For the sync to be lossless — quiz blocks and per-language
-- videos included — SquadHire's model has to be the same shape as SquadHub's,
-- not a two-level course/chapter/lesson approximation of it.
--
--   SquadHub                     SquadHire (this migration)
--   ------------------------     --------------------------------
--   lms_items                →   training_items
--   lms_lessons (nested)     →   training_pages (nested)
--   lms_content_blocks       →   training_blocks      (+ 'quiz')
--   lms_quiz_questions       →   training_quiz_questions
--   lms_quiz_attempts        →   training_quiz_attempts
--   (new on both sides)      →   training_block_videos   per-language video
--
-- IDS ARE PRESERVED on the way across:
--   training_courses.id  → training_items.id
--   training_chapters.id → training_pages.id  (depth 0, container)
--   training_lessons.id  → training_pages.id  (depth 1, leaf)
-- so training_assignments.resource_id, training_course_starts.course_id and
-- all 321 training_lesson_progress rows keep pointing at the same things.
--
-- The old tables are left in place and untouched. Code switches over first;
-- a follow-up migration drops them once this model is serving production.
--
-- SquadHire keeps owning everything about *locking and targeting* — the
-- columns marked "SquadHire-owned" below are never written by the sync from
-- SquadHub, only by SquadHire admin.

BEGIN;

-- ---------------------------------------------------------------------------
-- training_items — mirror of lms_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sync identity. NULL until the item has been pushed from SquadHub;
  -- migrated rows are backfilled by the content migration that follows.
  squadhub_item_id UUID UNIQUE,
  synced_at        TIMESTAMPTZ,

  -- Authored on SquadHub, overwritten on every sync.
  kind             TEXT NOT NULL DEFAULT 'course' CHECK (kind IN ('post', 'course')),
  track            TEXT NOT NULL DEFAULT 'learning' CHECK (track IN ('learning', 'sop')),
  title            TEXT NOT NULL,
  summary          TEXT,
  icon             TEXT,
  cover_image_url  TEXT,

  -- SquadHire-owned: publication + targeting + the onboarding/countdown gates.
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'published', 'archived')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_onboarding    BOOLEAN NOT NULL DEFAULT false,
  available_to_all BOOLEAN NOT NULL DEFAULT false,
  countdown_enabled BOOLEAN NOT NULL DEFAULT false,
  countdown_hours  INTEGER,
  sort_order       INTEGER NOT NULL DEFAULT 0,

  published_at     TIMESTAMPTZ,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT training_items_countdown_needs_hours
    CHECK (countdown_enabled = false OR countdown_hours IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_training_items_live
  ON training_items (track, sort_order)
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_training_items_onboarding
  ON training_items (is_onboarding)
  WHERE deleted_at IS NULL AND is_onboarding = true;

CREATE TRIGGER set_training_items_updated_at
  BEFORE UPDATE ON training_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- training_pages — mirror of lms_lessons (arbitrarily nested)
-- ---------------------------------------------------------------------------
-- A page with no blocks is a CONTAINER (the old "chapter"): it is not itself
-- completable and does not count toward progress or module unlocking. That
-- keeps the migrated data behaving exactly as chapters/lessons did before.
CREATE TABLE IF NOT EXISTS training_pages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          UUID NOT NULL REFERENCES training_items(id) ON DELETE CASCADE,
  parent_page_id   UUID REFERENCES training_pages(id) ON DELETE CASCADE,

  squadhub_page_id UUID UNIQUE,

  -- Authored on SquadHub.
  title            TEXT NOT NULL,
  summary          TEXT,
  icon             TEXT,
  position         INTEGER NOT NULL DEFAULT 0,

  -- SquadHire-owned: the module-unlock / profile-gate config that used to live
  -- on training_chapters. Any page may carry it, not just a top-level one.
  linked_module    TEXT CHECK (linked_module IS NULL OR linked_module IN (
                     'basic-profile', 'profiles', 'subscriptions',
                     'assignments', 'jobs', 'settings', 'notifications'
                   )),
  gates_profile_creation BOOLEAN NOT NULL DEFAULT false,
  language         TEXT NOT NULL DEFAULT 'en',
  is_active        BOOLEAN NOT NULL DEFAULT true,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A page cannot be its own parent. Deeper cycles are prevented in the API.
  CONSTRAINT training_pages_no_self_parent CHECK (parent_page_id IS DISTINCT FROM id)
);

CREATE INDEX IF NOT EXISTS idx_training_pages_item_parent
  ON training_pages (item_id, parent_page_id, position);

CREATE INDEX IF NOT EXISTS idx_training_pages_linked_module
  ON training_pages (linked_module)
  WHERE linked_module IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_pages_profile_gate
  ON training_pages (item_id)
  WHERE gates_profile_creation = true;

CREATE TRIGGER set_training_pages_updated_at
  BEFORE UPDATE ON training_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- training_blocks — mirror of lms_content_blocks, quiz included
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id           UUID NOT NULL REFERENCES training_pages(id) ON DELETE CASCADE,
  squadhub_block_id UUID UNIQUE,

  type              TEXT NOT NULL CHECK (type IN (
                      'text', 'image', 'video_upload', 'video_embed',
                      'audio', 'pdf', 'quiz'
                    )),
  position          INTEGER NOT NULL DEFAULT 0,
  text_content      JSONB,            -- Tiptap document JSON (type='text')
  file_url          TEXT,
  file_name         TEXT,
  file_size         BIGINT,           -- BIGINT to match lms_content_blocks
  mime_type         TEXT,
  embed_url         TEXT,             -- default/fallback video variant
  embed_provider    TEXT,
  caption           TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_blocks_page
  ON training_blocks (page_id, position);

CREATE TRIGGER set_training_blocks_updated_at
  BEFORE UPDATE ON training_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- training_block_videos — per-language variants of one video block
-- ---------------------------------------------------------------------------
-- Replaces training_lesson_videos. The variant is now attached to the video
-- BLOCK rather than the lesson, so a page can hold several videos and each can
-- carry its own set of languages. The block's own embed_url/file_url remains
-- the default for viewers whose language has no variant.
CREATE TABLE IF NOT EXISTS training_block_videos (
  block_id       UUID NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
  language       TEXT NOT NULL,
  embed_url      TEXT,
  embed_provider TEXT,
  file_url       TEXT,
  file_name      TEXT,
  file_size      BIGINT,
  mime_type      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (block_id, language),
  CONSTRAINT training_block_videos_needs_source
    CHECK (embed_url IS NOT NULL OR file_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_training_block_videos_block
  ON training_block_videos (block_id);

CREATE TRIGGER set_training_block_videos_updated_at
  BEFORE UPDATE ON training_block_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- training_quiz_questions / training_quiz_attempts — mirror of lms_quiz_*
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_quiz_questions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id             UUID NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
  squadhub_question_id UUID UNIQUE,
  position             INTEGER NOT NULL DEFAULT 0,
  prompt               TEXT NOT NULL,
  options              JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id,text},...]
  correct_option_id    TEXT NOT NULL,
  explanation          TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_quiz_questions_block
  ON training_quiz_questions (block_id, position);

CREATE TRIGGER set_training_quiz_questions_updated_at
  BEFORE UPDATE ON training_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Attempts key on the talent directly. SquadHub keys them on an assignment id;
-- SquadHire's assignment row can be recreated by re-share, and losing quiz
-- history to that would be wrong, so the talent is the stable anchor.
CREATE TABLE IF NOT EXISTS training_quiz_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  block_id       UUID NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
  answers        JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { question_id: option_id }
  score_percent  INTEGER NOT NULL DEFAULT 0
                   CHECK (score_percent BETWEEN 0 AND 100),
  passed         BOOLEAN NOT NULL DEFAULT false,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_quiz_attempts_talent
  ON training_quiz_attempts (talent_user_id, block_id, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- training_item_categories — job-profile targeting (SquadHire-owned)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_item_categories (
  item_id     UUID NOT NULL REFERENCES training_items(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_training_item_categories_category
  ON training_item_categories (category_id);

-- Carry over 00050's rule: a category may sit in at most one live onboarding
-- item, so a talent can never be handed two competing onboarding courses.
CREATE OR REPLACE FUNCTION enforce_onboarding_item_category_uniqueness()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM training_items
    WHERE id = NEW.item_id
      AND is_onboarding = true
      AND deleted_at IS NULL
  ) AND EXISTS (
    SELECT 1
    FROM training_item_categories tic
    JOIN training_items i ON i.id = tic.item_id
    WHERE tic.category_id = NEW.category_id
      AND tic.item_id <> NEW.item_id
      AND i.is_onboarding = true
      AND i.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Category % is already linked to another active onboarding item', NEW.category_id
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER training_item_categories_onboarding_uniqueness
  BEFORE INSERT OR UPDATE ON training_item_categories
  FOR EACH ROW EXECUTE FUNCTION enforce_onboarding_item_category_uniqueness();

-- ---------------------------------------------------------------------------
-- training_page_progress — replaces training_lesson_progress
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_page_progress (
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  page_id        UUID NOT NULL REFERENCES training_pages(id) ON DELETE CASCADE,
  completed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (talent_user_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_training_page_progress_talent
  ON training_page_progress (talent_user_id);

CREATE INDEX IF NOT EXISTS idx_training_page_progress_page
  ON training_page_progress (page_id);

COMMIT;


-- ===========================================================================
-- Data migration — courses/chapters/lessons → items/pages/blocks
-- ===========================================================================
-- Runs in its own transaction so the schema above is durable even if the
-- content copy needs a retry. Every step is idempotent (ON CONFLICT DO
-- NOTHING), so re-running is safe.

BEGIN;

-- 1. Courses → items. Same id, so training_assignments.resource_id and
--    training_course_starts.course_id keep resolving.
INSERT INTO training_items (
  id, kind, track, title, summary, status, is_active, is_onboarding,
  available_to_all, countdown_enabled, countdown_hours, sort_order,
  published_at, deleted_at, created_at, updated_at
)
SELECT
  c.id,
  'course',
  'learning',
  c.title,
  c.description,
  c.status,
  c.is_active,
  c.is_onboarding,
  c.available_to_all,
  c.countdown_enabled,
  c.countdown_hours,
  c.sort_order,
  CASE WHEN c.status = 'published' THEN c.created_at END,
  c.deleted_at,
  c.created_at,
  c.updated_at
FROM training_courses c
ON CONFLICT (id) DO NOTHING;

-- 2. Any SOPs (none in production today, but keep the path honest).
INSERT INTO training_items (
  id, kind, track, title, summary, icon, cover_image_url, status, is_active,
  available_to_all, sort_order, published_at, deleted_at, created_at, updated_at
)
SELECT
  s.id, 'post', 'sop', s.title, s.summary, s.icon, s.cover_image_url,
  s.status, true, s.available_to_all, s.sort_order, s.published_at,
  s.deleted_at, s.created_at, s.updated_at
FROM training_sops s
ON CONFLICT (id) DO NOTHING;

-- 3. Chapters → top-level container pages. Same id.
--    Chapters orphaned by a deleted course are skipped: with no item to hang
--    from they were already invisible to talents.
INSERT INTO training_pages (
  id, item_id, parent_page_id, title, summary, position,
  linked_module, gates_profile_creation, language, is_active,
  created_at, updated_at
)
SELECT
  ch.id,
  ch.course_id,
  NULL,
  ch.title,
  ch.description,
  ch.sort_order,
  ch.linked_module,
  ch.gates_profile_creation,
  ch.language,
  ch.is_active,
  ch.created_at,
  ch.updated_at
FROM training_chapters ch
JOIN training_items i ON i.id = ch.course_id
ON CONFLICT (id) DO NOTHING;

-- 4. Lessons → leaf pages under their chapter. Same id — this is what keeps
--    training_lesson_progress meaningful.
INSERT INTO training_pages (
  id, item_id, parent_page_id, title, summary, position, is_active,
  created_at, updated_at
)
SELECT
  l.id,
  p.item_id,
  l.chapter_id,
  l.title,
  l.description,
  l.sort_order,
  l.is_active,
  l.created_at,
  l.updated_at
FROM training_lessons l
JOIN training_pages p ON p.id = l.chapter_id
ON CONFLICT (id) DO NOTHING;

-- 5. SOP pages → pages (structure preserved, parents included).
INSERT INTO training_pages (
  id, item_id, parent_page_id, title, icon, position, is_active,
  created_at, updated_at
)
SELECT sp.id, sp.sop_id, sp.parent_page_id, sp.title, sp.icon, sp.position,
       sp.is_active, sp.created_at, sp.updated_at
FROM training_sop_pages sp
JOIN training_items i ON i.id = sp.sop_id
ON CONFLICT (id) DO NOTHING;

-- 6. Existing lesson blocks → blocks. Same id.
INSERT INTO training_blocks (
  id, page_id, type, position, text_content, file_url, file_name, file_size,
  mime_type, embed_url, embed_provider, caption, metadata, created_at, updated_at
)
SELECT b.id, b.lesson_id, b.type, b.position, b.text_content, b.file_url,
       b.file_name, b.file_size, b.mime_type, b.embed_url, b.embed_provider,
       b.caption, b.metadata, b.created_at, b.updated_at
FROM training_lesson_blocks b
JOIN training_pages p ON p.id = b.lesson_id
ON CONFLICT (id) DO NOTHING;

-- 7. SOP blocks → blocks.
INSERT INTO training_blocks (
  id, page_id, type, position, text_content, file_url, file_name, file_size,
  mime_type, embed_url, embed_provider, caption, metadata, created_at, updated_at
)
SELECT b.id, b.page_id, b.type, b.position, b.text_content, b.file_url,
       b.file_name, b.file_size, b.mime_type, b.embed_url, b.embed_provider,
       b.caption, b.metadata, b.created_at, b.updated_at
FROM training_sop_blocks b
JOIN training_pages p ON p.id = b.page_id
ON CONFLICT (id) DO NOTHING;

-- 8. Lesson videos → one video_embed block per lesson, with every language
--    kept as a variant. The 'en' variant (or, failing that, the lesson's own
--    loom_url) becomes the block default.
--
--    The block id is derived from the lesson id with uuid_generate_v5 so a
--    re-run lands on the same block instead of creating a second one.
WITH lessons_with_video AS (
  SELECT
    l.id AS lesson_id,
    COALESCE(
      (SELECT v.loom_url FROM training_lesson_videos v
        WHERE v.lesson_id = l.id AND v.language = 'en' LIMIT 1),
      (SELECT v.loom_url FROM training_lesson_videos v
        WHERE v.lesson_id = l.id ORDER BY v.created_at LIMIT 1),
      NULLIF(l.loom_url, '')
    ) AS default_url,
    l.created_at,
    l.updated_at
  FROM training_lessons l
  JOIN training_pages p ON p.id = l.id
)
INSERT INTO training_blocks (
  id, page_id, type, position, embed_url, embed_provider, created_at, updated_at
)
SELECT
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, lesson_id::text),
  lesson_id,
  'video_embed',
  0,
  default_url,
  CASE
    WHEN default_url ILIKE '%loom.com%'         THEN 'loom'
    WHEN default_url ILIKE '%clips.squadhub.in%' THEN 'squadclips'
    WHEN default_url ILIKE '%youtube%'          THEN 'youtube'
    WHEN default_url ILIKE '%vimeo%'            THEN 'vimeo'
    ELSE 'other'
  END,
  created_at,
  updated_at
FROM lessons_with_video
WHERE default_url IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 9. Language variants onto those blocks.
INSERT INTO training_block_videos (
  block_id, language, embed_url, embed_provider, created_at, updated_at
)
SELECT
  uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, v.lesson_id::text),
  v.language,
  v.loom_url,
  CASE
    WHEN v.loom_url ILIKE '%loom.com%'          THEN 'loom'
    WHEN v.loom_url ILIKE '%clips.squadhub.in%' THEN 'squadclips'
    WHEN v.loom_url ILIKE '%youtube%'           THEN 'youtube'
    WHEN v.loom_url ILIKE '%vimeo%'             THEN 'vimeo'
    ELSE 'other'
  END,
  v.created_at,
  v.updated_at
FROM training_lesson_videos v
JOIN training_blocks b
  ON b.id = uuid_generate_v5('6ba7b810-9dad-11d1-80b4-00c04fd430c8'::uuid, v.lesson_id::text)
ON CONFLICT (block_id, language) DO NOTHING;

-- 10. Category targeting: course-level links carry over as-is. Chapter-level
--     links from the pre-course era are lifted onto the chapter's item.
INSERT INTO training_item_categories (item_id, category_id)
SELECT cc.course_id, cc.category_id
FROM training_course_categories cc
JOIN training_items i ON i.id = cc.course_id
ON CONFLICT DO NOTHING;

INSERT INTO training_item_categories (item_id, category_id)
SELECT DISTINCT p.item_id, chc.category_id
FROM training_chapter_categories chc
JOIN training_pages p ON p.id = chc.chapter_id
ON CONFLICT DO NOTHING;

INSERT INTO training_item_categories (item_id, category_id)
SELECT sc.sop_id, sc.category_id
FROM training_sop_categories sc
JOIN training_items i ON i.id = sc.sop_id
ON CONFLICT DO NOTHING;

-- 11. Progress. lesson_id is now a page id, so this is a straight copy —
--     which is the whole point of preserving ids.
INSERT INTO training_page_progress (talent_user_id, page_id, completed_at)
SELECT lp.talent_user_id, lp.lesson_id, lp.completed_at
FROM training_lesson_progress lp
JOIN training_pages p ON p.id = lp.lesson_id
ON CONFLICT (talent_user_id, page_id) DO NOTHING;

COMMIT;

-- ---------------------------------------------------------------------------
-- RLS — service role bypasses; authenticated reads mirror the old tables.
-- ---------------------------------------------------------------------------
ALTER TABLE training_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_blocks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_block_videos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_quiz_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_quiz_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_page_progress   ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_items_select_authenticated ON training_items
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND status = 'published');

CREATE POLICY training_pages_select_authenticated ON training_pages
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY training_blocks_select_authenticated ON training_blocks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY training_block_videos_select_authenticated ON training_block_videos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY training_item_categories_select_authenticated ON training_item_categories
  FOR SELECT TO authenticated USING (true);

-- Quiz answers must not be readable by the person being tested, so there is
-- deliberately no authenticated SELECT policy on training_quiz_questions —
-- the API strips correct_option_id before it reaches a talent.

CREATE POLICY training_quiz_attempts_select_own ON training_quiz_attempts
  FOR SELECT TO authenticated USING (talent_user_id = auth.uid());

CREATE POLICY training_page_progress_select_own ON training_page_progress
  FOR SELECT TO authenticated USING (talent_user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
