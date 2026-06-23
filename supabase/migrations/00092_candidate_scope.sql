-- =============================================================================
-- 00092_candidate_scope.sql
-- Second access layer for the Candidates module: restrict a staff grant to
-- specific categories (lead form_type) and/or sections, WITHIN their module tier.
--
-- One nullable JSONB column on the existing grants table. For the 'candidates'
-- grant row it holds e.g.
--   { "categories": ["creative"], "sections": ["applications","interviews"] }
-- A NULL scope, or a missing key, means UNRESTRICTED on that dimension (all) —
-- so every existing candidates grant keeps working unchanged. Other modules
-- ignore the column.
-- =============================================================================

ALTER TABLE staff_module_grants ADD COLUMN IF NOT EXISTS scope JSONB;
