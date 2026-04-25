-- Migration: 00025_talent_access_grants
-- Description: Email-gated public access to talent profiles by category.
--   Admin issues a grant (email + expires_at + categories). The grantee logs in
--   on a single shared public URL using just their email and browses approved
--   talent profiles in the granted categories.
--
--   Tier (junior/pro/elite/custom) is NOT denormalised — it is resolved via
--   v_talent_profile_tier, which joins to the latest matching lead_submissions
--   row by email. Source of truth stays in the existing Candidates module.

-- ============================================================
-- talent_access_grants
-- ============================================================

CREATE TABLE talent_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL,
    revoked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX talent_access_grants_email_idx
    ON talent_access_grants (lower(email));

CREATE INDEX talent_access_grants_active_idx
    ON talent_access_grants (lower(email))
    WHERE revoked_at IS NULL;

CREATE TRIGGER set_talent_access_grants_updated_at
    BEFORE UPDATE ON talent_access_grants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- talent_access_grant_categories (join table: which categories a grant covers)
-- ============================================================

CREATE TABLE talent_access_grant_categories (
    grant_id    UUID NOT NULL REFERENCES talent_access_grants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (grant_id, category_id)
);

CREATE INDEX talent_access_grant_categories_category_idx
    ON talent_access_grant_categories (category_id);

-- ============================================================
-- RLS — admin-only via is_admin() (defined in 00007)
-- ============================================================

ALTER TABLE talent_access_grants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_access_grant_categories  ENABLE ROW LEVEL SECURITY;

CREATE POLICY talent_access_grants_admin_all
    ON talent_access_grants
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

CREATE POLICY talent_access_grant_categories_admin_all
    ON talent_access_grant_categories
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- ============================================================
-- Tier resolution view
--   Joins talent_profiles -> talent_users -> auth.users.email -> lead_submissions
--   (latest lead per email) so the access service can filter by tier without
--   touching the talent_profiles schema.
-- ============================================================

CREATE INDEX IF NOT EXISTS lead_submissions_email_lower_idx
    ON lead_submissions (lower(email));

CREATE OR REPLACE VIEW v_talent_profile_tier AS
SELECT
    tp.id                    AS talent_profile_id,
    tp.category_id           AS category_id,
    ls.profile_type          AS tier,
    ls.profile_type_custom   AS tier_custom
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
    'Resolves tier (junior/pro/elite/custom) for each talent_profile by joining '
    'to the most recent lead_submissions row matching the talent user''s email. '
    'Tier source of truth lives on lead_submissions.profile_type.';
