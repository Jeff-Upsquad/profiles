-- Migration: 00021_interview_invitations_reviewed
-- Description: Track when an admin has marked an interview response as reviewed.
-- Idempotent — safe to re-run.

ALTER TABLE interview_invitations
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;

CREATE INDEX IF NOT EXISTS idx_interview_invitations_reviewed_at
    ON interview_invitations(reviewed_at);
