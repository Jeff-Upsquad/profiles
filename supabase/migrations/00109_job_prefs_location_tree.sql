-- =============================================================
-- Nested preferred-locations tree for job openings. The flat
-- preferred_{countries,states,districts,cities} arrays (00108) are now
-- DERIVED (backend) from this tree so the matcher keeps filtering on
-- preferred_districts unchanged. Shape:
--   [{ country, states: [{ state, districts: [], cities: [] }] }]
-- India uses curated dropdowns; other countries are free-text.
-- =============================================================

ALTER TABLE talent_job_preferences
  ADD COLUMN IF NOT EXISTS preferred_locations JSONB NOT NULL DEFAULT '[]'::jsonb;
