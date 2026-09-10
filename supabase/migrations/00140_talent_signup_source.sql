-- 00140_talent_signup_source.sql
--
-- Record where a talent signed up from.
--
-- Until now nothing on `talent_users` captured provenance. A talent's category
-- was only inferable from (a) a linked `lead_submissions.form_type` or (b) a
-- `talent_profiles.category_id`. Landing-page signups have neither at the
-- moment they sign up, so 30 accounts ended up unclassifiable and invisible to
-- every Sign-ups category tab except "All" — and `notifyCrmTalentSignedUp` had
-- to guess their CRM pipeline.
--
-- `signup_form_type` is the resolved bucket ('creative' | 'accountant' |
-- 'sales'); it deliberately mirrors `lead_submissions.form_type` values so the
-- same category helpers can consume it. `signup_source` is the raw provenance
-- kept for auditing ('landing:designer-and-video-editor', 'referrer:...',
-- 'backfill:whatsapp_cta', …) — never parsed for behaviour, only read by humans.
--
-- Both are nullable: existing rows stay NULL, and the category helpers keep
-- falling back to leads and profile categories exactly as before.

ALTER TABLE talent_users
  ADD COLUMN IF NOT EXISTS signup_form_type text,
  ADD COLUMN IF NOT EXISTS signup_source    text;

-- Guard the vocabulary. Kept as a CHECK rather than an enum so adding a
-- programme later is a one-line migration and never rewrites the table.
ALTER TABLE talent_users
  DROP CONSTRAINT IF EXISTS talent_users_signup_form_type_check;
ALTER TABLE talent_users
  ADD CONSTRAINT talent_users_signup_form_type_check
  CHECK (signup_form_type IS NULL OR signup_form_type IN ('creative', 'accountant', 'sales'));

-- The Sign-ups category filter selects talent ids by this column, so index it.
CREATE INDEX IF NOT EXISTS idx_talent_users_signup_form_type
  ON talent_users (signup_form_type)
  WHERE signup_form_type IS NOT NULL;

COMMENT ON COLUMN talent_users.signup_form_type IS
  'Role bucket captured at signup (creative|accountant|sales). Mirrors lead_submissions.form_type. NULL for pre-2026-09 signups and for anyone who arrived with no usable hint.';
COMMENT ON COLUMN talent_users.signup_source IS
  'Raw provenance of signup_form_type, for auditing only. e.g. landing:designer-and-video-editor, referrer:upsquadconnect.com/partner-program/sales, backfill:whatsapp_cta.';

-- ---------------------------------------------------------------------------
-- Backfill: recover the programme for signups that predate this column.
--
-- The partner-program landing pages open WhatsApp with a pre-filled message
-- ("Hello! Can I get more info on Partner Program ( Designer / Editor )"), so
-- a talent's FIRST inbound CRM message names the page they came from. That is
-- the only surviving record of provenance for landing-page signups.
--
-- Scoped to talents who are otherwise unclassifiable (no linked lead, no
-- profile category) and left NULL whenever the message is generic — a blank is
-- honest, a guess is not. Guarded on `signup_form_type IS NULL`, so re-running
-- is a no-op and this never overwrites a value captured at signup.
-- ---------------------------------------------------------------------------
WITH uncl AS (
  SELECT t.id, right(regexp_replace(t.phone, '\D', '', 'g'), 10) AS k
  FROM talent_users t
  WHERE t.signup_form_type IS NULL
    AND NOT EXISTS (SELECT 1 FROM lead_submissions l
                     WHERE l.linked_talent_user_id = t.id AND l.deleted_at IS NULL)
    AND NOT EXISTS (SELECT 1 FROM talent_profiles p
                     WHERE p.talent_user_id = t.id AND p.deleted_at IS NULL
                       AND p.category_id IS NOT NULL)
    AND length(regexp_replace(t.phone, '\D', '', 'g')) >= 10
),
fm AS (
  SELECT u.id,
    (SELECT regexp_replace(m.text, '\s+', ' ', 'g')
       FROM crm_messages m
       JOIN crm_leads c ON c.id = m.lead_id
      WHERE right(regexp_replace(c.phone_e164, '\D', '', 'g'), 10) = u.k
        AND m.direction = 'inbound' AND m.text IS NOT NULL
      ORDER BY m.created_at ASC LIMIT 1) AS msg
  FROM uncl u
),
resolved AS (
  SELECT id,
    CASE WHEN msg ~* 'accountant'              THEN 'accountant'
         WHEN msg ~* 'sales'                   THEN 'sales'
         WHEN msg ~* 'designer|editor|creative' THEN 'creative'
    END AS ft
  FROM fm WHERE msg IS NOT NULL
)
UPDATE talent_users t
   SET signup_form_type = r.ft,
       signup_source    = 'backfill:whatsapp_cta',
       updated_at       = now()
  FROM resolved r
 WHERE r.id = t.id AND r.ft IS NOT NULL;
