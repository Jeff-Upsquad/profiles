-- =============================================================================
-- 00096_chapter_gates_profile_creation.sql
-- Per-category "job profile" training gate.
--
-- When a chapter is linked to a category (training_chapter_categories, or via a
-- course's training_course_categories) AND gates_profile_creation is true, the
-- talent must complete that chapter's lessons before they can build a job
-- profile in that category. Parallel to training_chapters.linked_module, which
-- gates whole sidebar modules; this instead gates the create-profile flow for a
-- single category. Opt-in: a category with no such chapter has no gate.
-- =============================================================================

ALTER TABLE training_chapters
  ADD COLUMN gates_profile_creation BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN training_chapters.gates_profile_creation IS
  'When true and this chapter is linked to a category, the talent must complete '
  'this chapter''s lessons before creating a job profile for that category.';
