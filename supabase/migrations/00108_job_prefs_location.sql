-- =============================================================
-- Expand talent_job_preferences location prefs from a single
-- preferred_districts array to a structured set: countries, states,
-- districts (multi-select) plus free-text cities. Districts remains
-- the only field the matcher filters on (subscription-matcher step 7);
-- the others are stored + displayed like preferred_job_types.
-- =============================================================

ALTER TABLE talent_job_preferences
  ADD COLUMN IF NOT EXISTS preferred_countries TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_states TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_cities TEXT[] NOT NULL DEFAULT '{}';
