-- 00080_ai_tools_proficiency.sql
-- Convert legacy `string[]` `_ai_tools` rows to `{name, level}[]` so each AI
-- tool can carry a 1-5 proficiency level (Learning / Beginner / Intermediate
-- / Advanced / Expert). Mirrors 00079 (which did the same for accounting
-- software and tools). Defaults legacy entries to level 3 (Intermediate).
--
-- Idempotent: the WHERE filter only touches rows that are still a plain
-- `text[]`. Rows already converted (objects) are left alone.
--
-- Run AFTER 00079_accounting_tools_proficiency.sql (no schema dependency, but
-- keeps the proficiency migrations together).

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_ai_tools}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', v, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_ai_tools') AS v
    )
  )
)
WHERE jsonb_typeof(field_data -> '_ai_tools') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(field_data -> '_ai_tools') AS el
    WHERE jsonb_typeof(el) <> 'object'
  );
