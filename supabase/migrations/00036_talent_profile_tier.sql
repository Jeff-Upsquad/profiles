-- ============================================================
-- 00036_talent_profile_tier.sql
--
-- Per-profile tier override on talent_profiles.
--
-- Until now, tier was resolved exclusively from the latest
-- lead_submissions.profile_type matched by talent user email
-- (see 00025_talent_access_grants.sql, view v_talent_profile_tier).
--
-- This migration:
--   1. Adds tier / tier_custom columns to talent_profiles so admins
--      can set tier directly from the Talents page.
--   2. Updates v_talent_profile_tier to prefer the profile-level
--      tier when set, falling back to the lead-level tier otherwise.
--
-- Interim behavior (enforced in service layer, not in SQL): when
-- admin sets tier from a profile, the same value is written to ALL
-- of that talent's non-deleted profiles. Future direction is per-
-- profile tier — the column already supports that; the service just
-- needs to stop writing-to-all.
-- ============================================================

ALTER TABLE talent_profiles
    ADD COLUMN IF NOT EXISTS tier        TEXT,
    ADD COLUMN IF NOT EXISTS tier_custom TEXT;

ALTER TABLE talent_profiles
    DROP CONSTRAINT IF EXISTS talent_profiles_tier_check,
    ADD  CONSTRAINT talent_profiles_tier_check
        CHECK (tier IS NULL OR tier IN ('junior', 'pro', 'elite', 'custom'));

ALTER TABLE talent_profiles
    DROP CONSTRAINT IF EXISTS talent_profiles_tier_custom_check,
    ADD  CONSTRAINT talent_profiles_tier_custom_check
        CHECK (tier_custom IS NULL OR tier = 'custom');

COMMENT ON COLUMN talent_profiles.tier IS
    'Per-profile tier override. When null, tier resolves from latest matching lead_submission.';
COMMENT ON COLUMN talent_profiles.tier_custom IS
    'Custom tier label, only meaningful when tier = ''custom''.';

-- ----------------------------------------------------------------
-- Update v_talent_profile_tier to prefer profile-level tier.
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW v_talent_profile_tier AS
SELECT
    tp.id                                              AS talent_profile_id,
    tp.category_id                                     AS category_id,
    COALESCE(tp.tier, ls.profile_type)                 AS tier,
    COALESCE(tp.tier_custom, ls.profile_type_custom)   AS tier_custom
FROM talent_profiles tp
JOIN talent_users tu ON tu.id = tp.talent_user_id
JOIN auth.users   au ON au.id = tu.id
LEFT JOIN LATERAL (
    SELECT profile_type, profile_type_custom
    FROM lead_submissions ls2
    WHERE ls2.email IS NOT NULL
      AND lower(ls2.email) = lower(au.email)
    ORDER BY ls2.created_at DESC
    LIMIT 1
) ls ON true;

COMMENT ON VIEW v_talent_profile_tier IS
    'Resolves tier (junior/pro/elite/custom) for each talent_profile. '
    'Prefers per-profile tier on talent_profiles; falls back to the '
    'latest matching lead_submissions.profile_type by talent user email.';
