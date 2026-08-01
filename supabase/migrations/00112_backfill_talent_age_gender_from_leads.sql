-- Migration: 00112_backfill_talent_age_gender_from_leads
-- Description: The public talent signup form (/signup) never collected age or
-- gender, so signed-up talents have NULL talent_users.age / gender even though
-- their originating /apply lead form captured both. This one-time backfill fills
-- those blanks from the most recent linked lead_submission that carries each
-- value. It only ever fills NULLs (COALESCE) — existing values are never
-- overwritten — and is safe to re-run (idempotent). Going forward the signup
-- service derives these from the linked lead at account-creation time, so new
-- accounts won't need this.

WITH src AS (
  SELECT
    linked_talent_user_id AS tid,
    -- Most-recent non-empty numeric age across the talent's linked leads.
    (ARRAY_AGG((form_data->>'age')::int ORDER BY created_at DESC)
       FILTER (WHERE form_data->>'age' ~ '^[0-9]+$'))[1] AS age,
    -- Most-recent valid-enum gender across the talent's linked leads.
    (ARRAY_AGG((form_data->>'gender')::gender_type ORDER BY created_at DESC)
       FILTER (WHERE form_data->>'gender'
                 IN ('male','female','other','prefer_not_to_say')))[1] AS gender
  FROM lead_submissions
  WHERE linked_talent_user_id IS NOT NULL
  GROUP BY linked_talent_user_id
)
UPDATE talent_users tu
SET
  age    = COALESCE(tu.age, src.age),
  gender = COALESCE(tu.gender, src.gender)
FROM src
WHERE tu.id = src.tid
  AND (tu.age IS NULL OR tu.gender IS NULL)
  AND (src.age IS NOT NULL OR src.gender IS NOT NULL);
