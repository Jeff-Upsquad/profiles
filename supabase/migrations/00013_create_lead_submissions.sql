-- Migration: 00013_create_lead_submissions
-- Description: Lead submission system for Meta ad capture forms

CREATE TYPE lead_status_enum AS ENUM ('new', 'contacted', 'converted', 'rejected');
CREATE TYPE lead_form_type_enum AS ENUM ('creative', 'accountant');

CREATE TABLE lead_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_type lead_form_type_enum NOT NULL,
    status lead_status_enum NOT NULL DEFAULT 'new',

    -- Common fields (first-class for querying/filtering)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,

    -- Form-specific fields
    form_data JSONB NOT NULL DEFAULT '{}',

    -- Resume URL (accountant form)
    resume_url TEXT,

    -- Meta ad attribution tracking
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,

    -- Admin management
    admin_notes TEXT,
    status_changed_by UUID,
    status_changed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_submissions_form_type ON lead_submissions(form_type);
CREATE INDEX idx_lead_submissions_status ON lead_submissions(status);
CREATE INDEX idx_lead_submissions_created_at ON lead_submissions(created_at DESC);
CREATE INDEX idx_lead_submissions_phone ON lead_submissions(phone);
CREATE INDEX idx_lead_submissions_email ON lead_submissions(email);

CREATE TRIGGER set_lead_submissions_updated_at
    BEFORE UPDATE ON lead_submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE lead_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_submissions"
    ON lead_submissions
    FOR ALL
    USING (true)
    WITH CHECK (true);
