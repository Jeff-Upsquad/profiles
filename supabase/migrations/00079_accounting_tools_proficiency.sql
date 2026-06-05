-- Migration: 00079_accounting_tools_proficiency
-- Description: Convert legacy `string[]` entries in `field_data._accounting_software`
-- and `field_data._tools` to `{name, level}[]` so each selected item can carry
-- a per-item proficiency (1-5: Learning / Beginner / Intermediate / Advanced
-- / Expert — same labels as `_skills`). Default level = 3 (Intermediate) for
-- migrated entries; users can re-rate on next profile edit.
--
-- Safe to re-run: the WHERE filter only touches rows whose array is still
-- plain strings (not yet object-shaped). The frontend form also defensively
-- `coerceLeveledList()`s on read, so any rows that slip through still render.

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_accounting_software}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', elem, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_accounting_software') AS elem
    )
  ),
  true
)
WHERE field_data ? '_accounting_software'
  AND jsonb_typeof(field_data -> '_accounting_software') = 'array'
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(field_data -> '_accounting_software') AS e
    WHERE jsonb_typeof(e) <> 'object'
  ) = jsonb_array_length(field_data -> '_accounting_software');

UPDATE talent_profiles
SET field_data = jsonb_set(
  field_data,
  '{_tools}',
  to_jsonb(
    ARRAY(
      SELECT jsonb_build_object('name', elem, 'level', 3)
      FROM jsonb_array_elements_text(field_data -> '_tools') AS elem
    )
  ),
  true
)
WHERE field_data ? '_tools'
  AND jsonb_typeof(field_data -> '_tools') = 'array'
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(field_data -> '_tools') AS e
    WHERE jsonb_typeof(e) <> 'object'
  ) = jsonb_array_length(field_data -> '_tools');
