-- Migration: 00088_lead_notes_author_email
-- Description: Record WHO actually wrote a note. lead_notes.created_by is the
--              SQUADHUB_SERVICE_USER_ID for notes added via the SquadHub
--              Candidates app, so it can't identify the human. The acting user's
--              email already arrives in the X-SquadHub-Actor header; persist it
--              here so SquadHub can attribute each note. Nullable: legacy notes
--              (and notes authored directly in the SquadHire CRM) leave it NULL.

ALTER TABLE lead_notes
    ADD COLUMN IF NOT EXISTS author_email TEXT;
