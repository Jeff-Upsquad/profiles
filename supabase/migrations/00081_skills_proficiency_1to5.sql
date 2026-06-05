-- 00081_skills_proficiency_1to5.sql
-- Convert legacy 1-10 `_skills` levels to 1-5 so the level-selector UI
-- (Learning / Beginner / Intermediate / Advanced / Expert) is consistent
-- across skills, tools, and AI tools.
--
-- Mapping: ceiling(level / 2) so the relative position is preserved.
--   1-2 -> 1 (Learning)
--   3-4 -> 2 (Beginner)
--   5-6 -> 3 (Intermediate)
--   7-8 -> 4 (Advanced)
--   9-10 -> 5 (Expert)
--
-- Idempotent: the WHERE filter only touches rows whose level is still > 5
-- (i.e. legacy 1-10 values). Rows already in 1-5 are untouched.
--
-- Run AFTER 00079_accounting_tools_proficiency.sql and
-- 00080_ai_tools_proficiency.sql.

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_skills}',
  (
    SELECT to_jsonb(
      ARRAY(
        SELECT
          jsonb_build_object(
            'skill',
            s ->> 'skill',
            'level',
            LEAST(5, GREATEST(1, CEIL((s ->> 'level')::numeric / 2)::int))
          )
        FROM jsonb_array_elements(field_data -> '_skills') AS s
        WHERE jsonb_typeof(s) = 'object'
      )
    )
  )
)
WHERE jsonb_typeof(field_data -> '_skills') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(field_data -> '_skills') AS s
    WHERE jsonb_typeof(s) = 'object'
      AND (s ->> 'level')::numeric > 5
  );
