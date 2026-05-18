-- ============================================================
-- 00075_top_talents_tier_phase1.sql
--
-- Top Talents tier rename — Phase 1 (read-tolerant widening)
--
-- Widens both tier-value CHECK constraints to ACCEPT the new value
-- 'Top Talents' alongside the legacy 'elite'. No data is rewritten in
-- this migration — that happens in the Phase 2 backfill once the
-- application has shipped Phase 1 code.
--
-- Note the case asymmetry: legacy Profiles data uses lowercase
-- ('junior','pro','elite','custom'); the new value 'Top Talents' is
-- PascalCase with a space, matching Squad Hub's chosen canonical
-- string. Read paths in the application must tolerate both.
--
-- Affected constraints:
--   1. lead_submissions.profile_type    (junior/pro/elite/custom)
--   2. talent_profiles.tier             (junior/pro/elite/custom)
--
-- The v_talent_profile_tier view doesn't reference the literal value
-- itself (it COALESCEs), so it doesn't need to change in Phase 1.
-- Its comment is updated to reflect the new tier vocabulary.
-- ============================================================

-- 1) lead_submissions.profile_type — adds 'Top Talents'
ALTER TABLE lead_submissions
  DROP CONSTRAINT IF EXISTS lead_submissions_profile_type_check;
ALTER TABLE lead_submissions
  ADD CONSTRAINT lead_submissions_profile_type_check
  CHECK (profile_type IS NULL OR profile_type IN ('junior', 'pro', 'elite', 'Top Talents', 'custom'));

-- 2) talent_profiles.tier — adds 'Top Talents'
ALTER TABLE talent_profiles
  DROP CONSTRAINT IF EXISTS talent_profiles_tier_check;
ALTER TABLE talent_profiles
  ADD CONSTRAINT talent_profiles_tier_check
  CHECK (tier IS NULL OR tier IN ('junior', 'pro', 'elite', 'Top Talents', 'custom'));

-- The talent_profiles.tier_custom CHECK references tier = 'custom' (lowercase).
-- That doesn't change in this rename, so the constraint stays as-is.

-- Update the view's comment to reflect the new tier vocabulary.
COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/elite/Top Talents/custom) for each talent_profile. '
    'Prefers per-profile tier on talent_profiles; falls back to the '
    'latest matching lead_submissions.profile_type by talent user email. '
    'Phase 1 of the Elite -> Top Talents rename accepts both values; '
    'Phase 2 backfills lowercase ''elite'' rows to ''Top Talents''.';
