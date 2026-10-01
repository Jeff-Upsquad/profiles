-- Stop new functions from being callable by anon/authenticated by default.
--
-- The 19 functions locked down in 20261001195305 were exposed because
-- Postgres grants EXECUTE to PUBLIC on every new function, and this project's
-- default privileges also grant it to anon and authenticated in public. If one
-- of those functions is dropped and recreated, or a new SECURITY DEFINER
-- function is added without a REVOKE, it is exposed again.
--
-- After this, functions created by postgres (migrations, the SQL editor) are
-- executable only by their owner and service_role (public schema). A future
-- migration that wants a function callable by signed-in users must GRANT it
-- explicitly, the same as tables (see supabase/migrations/AGENTS.md).
-- Existing functions keep their current grants. Trigger functions are
-- unaffected: EXECUTE is not checked when a trigger fires.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
