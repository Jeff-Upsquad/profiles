-- Migration: 00034_link_leads_to_talent_users
-- Description: Persist the connection between lead_submissions (Candidates) and
-- talent_users so admins can see "this signup originated from lead X" on the
-- Reviews and Talents pages, and "this lead has signed up as a talent" on the
-- Candidates page. Match by email (case-insensitive) OR last 10 digits of phone.

-- 1. Link column on lead_submissions (one talent → many leads)
ALTER TABLE lead_submissions
  ADD COLUMN linked_talent_user_id UUID REFERENCES talent_users(id) ON DELETE SET NULL;

CREATE INDEX lead_submissions_linked_talent_user_idx
  ON lead_submissions(linked_talent_user_id)
  WHERE linked_talent_user_id IS NOT NULL;

-- 2. Backfill existing leads against existing talent_users
UPDATE lead_submissions ls
SET linked_talent_user_id = tu.id
FROM talent_users tu
JOIN auth.users au ON au.id = tu.id
WHERE ls.linked_talent_user_id IS NULL
  AND (
    (ls.email IS NOT NULL AND lower(ls.email) = lower(au.email))
    OR (ls.phone IS NOT NULL AND tu.phone IS NOT NULL
        AND right(regexp_replace(ls.phone, '\D', '', 'g'), 10)
          = right(regexp_replace(tu.phone, '\D', '', 'g'), 10))
  );

-- 3. RPC called from the signup flow. SECURITY DEFINER so the service role's
-- session_role doesn't matter when invoked via supabase-js .rpc().
CREATE OR REPLACE FUNCTION link_leads_for_talent_user(
  p_user_id UUID,
  p_email TEXT,
  p_phone_last10 TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE lead_submissions
  SET linked_talent_user_id = p_user_id
  WHERE linked_talent_user_id IS NULL
    AND (
      (p_email IS NOT NULL AND email IS NOT NULL AND lower(email) = lower(p_email))
      OR (p_phone_last10 IS NOT NULL
          AND right(regexp_replace(phone, '\D', '', 'g'), 10) = p_phone_last10)
    );
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;
