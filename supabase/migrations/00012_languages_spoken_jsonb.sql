-- Change languages_spoken from TEXT[] to JSONB to support proficiency levels
-- Each entry: {"language": "Hindi", "proficiency": "native"}

-- 1. Add new JSONB column
ALTER TABLE talent_users ADD COLUMN languages_spoken_new JSONB DEFAULT '[]'::jsonb;

-- 2. Migrate any existing data
UPDATE talent_users
SET languages_spoken_new = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('language', elem, 'proficiency', 'fluent')), '[]'::jsonb)
  FROM unnest(languages_spoken) AS elem
)
WHERE languages_spoken IS NOT NULL AND array_length(languages_spoken, 1) IS NOT NULL;

-- 3. Swap columns
ALTER TABLE talent_users DROP COLUMN languages_spoken;
ALTER TABLE talent_users RENAME COLUMN languages_spoken_new TO languages_spoken;
