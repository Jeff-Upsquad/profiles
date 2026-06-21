-- Migration: 00089_lead_notes_author_name
-- Description: Display name of the human who wrote a note, alongside
--              author_email (00088). Arrives from SquadHub in the
--              X-SquadHub-Actor-Name header; preferred over the email in the UI.
--              Nullable: NULL when the acting user has no profile display name
--              (UI falls back to author_email), and for legacy notes.

ALTER TABLE lead_notes
    ADD COLUMN IF NOT EXISTS author_name TEXT;
