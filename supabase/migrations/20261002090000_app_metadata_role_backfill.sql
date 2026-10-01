-- Copy each user's SquadHire role from user_metadata to app_metadata.
--
-- The backend took req.user.role from user_metadata.role. Users can write
-- their own user_metadata with the access token /api/auth/login returns and
-- the public anon key:
--   PUT /auth/v1/user  {"data":{"role":"admin"}}
-- After that, any talent passed requireAdminOrStaff, and could also take the
-- agency or squad roles. The backend now reads only app_metadata.role, which
-- only the service role can write (backend/src/lib/auth-role.ts). A user
-- without one is treated as a talent.
--
-- This copies the existing roles across. It does NOT trust user_metadata: a
-- role is copied only when the user's own domain row confirms it, so a
-- self-assigned role is never promoted.
--   talent                       talent_users.id = user id
--   agency                       agency_users.id = user id
--   squad_member / squad_manager agency_squad_members.auth_user_id = user id,
--                                with role_type 'member' / 'manager'
--   admin                        never copied. Admin is granted explicitly by
--                                email in 20261001195305_lock_down_public_functions
--                                (admin@squadhire.com, jeff@squadhub.in).
--
-- raw_app_meta_data is merged with ||, never replaced. Its other keys stay:
-- provider/providers (GoTrue) and SquadHire CRM's shcrm_* flags.
-- Users that already have app_metadata.role are left alone.
-- The statement is idempotent, so it can be run again after the backend deploy
-- to pick up agency/squad sign-ups the old code wrote between the two steps.
--
-- Pre-check on production, 2026-10-02 (read-only), 184 auth users:
--   user_metadata.role  domain row             count  result
--   talent              talent_users           174    copied
--   agency              agency_users             1    copied
--   agency              none                     3    left as talent (test
--                                                     accounts agencytest+...@example.com,
--                                                     agency_demo@squadhire.test)
--   squad_member        none                     1    left as talent (test
--                                                     account invited_test_...@example.com)
--   admin               (app_metadata already)   2    unchanged
--   null                none (SquadHire CRM)     3    unchanged
--   No user had a self-assigned admin role.

UPDATE auth.users AS au
SET raw_app_meta_data = COALESCE(au.raw_app_meta_data, '{}'::jsonb)
                        || jsonb_build_object('role', au.raw_user_meta_data ->> 'role')
WHERE au.raw_app_meta_data ->> 'role' IS NULL
  AND (
        (au.raw_user_meta_data ->> 'role' = 'talent'
          AND EXISTS (SELECT 1 FROM public.talent_users t WHERE t.id = au.id))
     OR (au.raw_user_meta_data ->> 'role' = 'agency'
          AND EXISTS (SELECT 1 FROM public.agency_users a WHERE a.id = au.id))
     OR (au.raw_user_meta_data ->> 'role' IN ('squad_member', 'squad_manager')
          AND EXISTS (
            SELECT 1 FROM public.agency_squad_members s
            WHERE s.auth_user_id = au.id
              AND CASE WHEN s.role_type = 'manager' THEN 'squad_manager' ELSE 'squad_member' END
                  = au.raw_user_meta_data ->> 'role'))
      );

-- Verification. Expect 174 talent, 2 admin, 1 agency and no unconfirmed admins.
-- SELECT raw_app_meta_data ->> 'role' AS role, count(*) FROM auth.users GROUP BY 1 ORDER BY 1;
-- SELECT email FROM auth.users
--  WHERE raw_user_meta_data ->> 'role' = 'admin'
--    AND raw_app_meta_data ->> 'role' IS DISTINCT FROM 'admin';
--
-- Rollback: the old backend ignores app_metadata, so the copied keys can stay.
-- To remove them anyway:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data - 'role'
--  WHERE raw_app_meta_data ->> 'role' IN ('talent', 'agency', 'squad_member', 'squad_manager');
