-- =============================================================
-- Jobs module — candidate Q&A
-- =============================================================
-- Talents ask questions about a job; the business (or admin) answers.
-- Answered => published on the job profile for ALL viewers (no separate
-- publish flag). Soft-delete by business or admin. Visibility is
-- service-enforced: unanswered questions are visible only to the asker,
-- the business, and admins.
-- =============================================================

CREATE TABLE job_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_profile_id UUID NOT NULL REFERENCES job_profiles(id) ON DELETE CASCADE,
  card_id UUID REFERENCES subscription_cards(id) ON DELETE SET NULL,  -- provenance only
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by TEXT CHECK (answered_by IN ('business','admin')),
  answered_by_id UUID,
  answered_at TIMESTAMPTZ,                -- answered => published to all viewers
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT CHECK (deleted_by IN ('business','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX job_questions_profile_published_idx
  ON job_questions (job_profile_id, answered_at DESC)
  WHERE answered_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX job_questions_unanswered_idx
  ON job_questions (job_profile_id) WHERE answered_at IS NULL AND deleted_at IS NULL;
CREATE INDEX job_questions_talent_idx ON job_questions (talent_user_id, created_at DESC);

CREATE TRIGGER trg_job_questions_updated_at
  BEFORE UPDATE ON job_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE job_questions ENABLE ROW LEVEL SECURITY;
