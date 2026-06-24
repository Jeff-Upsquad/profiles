-- ============================================================
-- 00094_top_talents_tier_phase3_drop_legacy.sql
--
-- Top Talents tier rename — Phase 3 (drop legacy 'elite')
--
-- Re-creates the two tier-value CHECK constraints WITHOUT 'elite',
-- now that Phase 2 has backfilled all data and the application no
-- longer writes or accepts 'elite'. Apply LAST — only after the
-- Phase-3 application code is live in prod.
--
-- Applied to production via the Supabase MCP (deploy.sh does not run
-- migrations). Idempotent.
--
-- Note: talent_profiles_tier_custom_check references tier = 'custom'
-- (lowercase) and is unaffected by this rename.
-- ============================================================

ALTER TABLE lead_submissions DROP CONSTRAINT IF EXISTS lead_submissions_profile_type_check;
ALTER TABLE lead_submissions
  ADD CONSTRAINT lead_submissions_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN ('junior', 'pro', 'Top Talents', 'custom'));

ALTER TABLE talent_profiles DROP CONSTRAINT IF EXISTS talent_profiles_tier_check;
ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_tier_check
  CHECK (tier IS NULL OR tier IN ('junior', 'pro', 'Top Talents', 'custom'));

COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/Top Talents/custom) for each talent_profile. '
    'Prefers per-profile tier on talent_profiles; falls back to the '
    'latest matching lead_submissions.profile_type by talent user email. '
    'The Elite -> Top Talents rename is complete (no legacy value remains).';
