-- Preserve the Data API permissions that existing projects received
-- automatically before Supabase changed its public-schema defaults.
-- This is a one-time compatibility grant for earlier migrations only.
-- Future CREATE TABLE migrations must grant only the access they need.
--
-- Grant base tables only so intentionally restricted views stay restricted.
DO $$
DECLARE
  target_table RECORD;
BEGIN
  FOR target_table IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO anon, authenticated, service_role',
      target_table.schemaname,
      target_table.tablename
    );
  END LOOP;
END
$$;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO anon, authenticated, service_role;
