-- Migration: 00029_add_lead_notes
-- Description: Multi-note timestamped admin notes per lead. Additive to legacy
--              lead_submissions.admin_notes (kept for archive justification).

CREATE TABLE IF NOT EXISTS lead_notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES lead_submissions(id) ON DELETE CASCADE,
    content     TEXT NOT NULL CHECK (length(btrim(content)) > 0),
    created_by  UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id_created_at
    ON lead_notes (lead_id, created_at DESC);

CREATE TRIGGER set_lead_notes_updated_at
    BEFORE UPDATE ON lead_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on lead_notes" ON lead_notes;
CREATE POLICY "Service role full access on lead_notes"
    ON lead_notes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
