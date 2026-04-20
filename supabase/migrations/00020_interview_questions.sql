-- Migration: 00020_interview_questions
-- Description: First-level interview questions per form type + per-lead invitation tokens and responses.
-- Idempotent — safe to re-run.

-- ============================================================
-- Configurable interview questions (per form type)
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    helper_text TEXT,
    field_type TEXT NOT NULL DEFAULT 'textarea'
        CHECK (field_type IN ('textarea', 'text', 'yes_no', 'acknowledge')),
    options JSONB,
    is_required BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_questions_form_type
    ON interview_questions(form_type, display_order)
    WHERE is_active = true;

DROP TRIGGER IF EXISTS set_interview_questions_updated_at ON interview_questions;
CREATE TRIGGER set_interview_questions_updated_at
    BEFORE UPDATE ON interview_questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Per-lead interview invitations (token-gated)
-- ============================================================

CREATE TABLE IF NOT EXISTS interview_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES lead_submissions(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    submitted_at TIMESTAMPTZ,
    responses JSONB,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interview_invitations_lead_id
    ON interview_invitations(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interview_invitations_token
    ON interview_invitations(token);

-- ============================================================
-- RLS — service role only (admin + public token lookups go through supabaseAdmin)
-- ============================================================

ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on interview_questions" ON interview_questions;
CREATE POLICY "Service role full access on interview_questions"
    ON interview_questions
    FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on interview_invitations" ON interview_invitations;
CREATE POLICY "Service role full access on interview_invitations"
    ON interview_invitations
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- Seed the three starter questions per form type
-- Only inserts when no questions exist yet for that form_type, so re-runs are safe.
-- ============================================================

INSERT INTO interview_questions (form_type, question_text, field_type, display_order)
SELECT v.form_type, v.question_text, v.field_type, v.display_order
FROM (VALUES
    ('creative',   'Can you join immediately if selected? Are you currently working? Share your notice period.', 'textarea',    1),
    ('creative',   'Do you have a laptop, smartphone and reliable internet connection to undertake this job?',   'yes_no',      2),
    ('creative',   'Working time will be 9:30 AM to 6:00 PM, Monday to Saturday (Remote — Work from home). Please confirm.', 'acknowledge', 3),
    ('accountant', 'Can you join immediately if selected? Are you currently working? Share your notice period.', 'textarea',    1),
    ('accountant', 'Do you have a laptop, smartphone and reliable internet connection to undertake this job?',   'yes_no',      2),
    ('accountant', 'Working time will be 9:30 AM to 6:00 PM, Monday to Saturday (Remote — Work from home). Please confirm.', 'acknowledge', 3)
) AS v(form_type, question_text, field_type, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM interview_questions iq WHERE iq.form_type = v.form_type
);
