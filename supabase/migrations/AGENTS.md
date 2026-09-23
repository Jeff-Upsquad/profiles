# Migration instructions

- Every migration that creates a table in `public` must include explicit Data API grants in the same migration.
- Inspect the table's callers and grant only the required operations to `anon`, `authenticated`, and/or `service_role`.
- Keep RLS enabled and define policies for every table exposed to `anon` or `authenticated`.
- Grant sequence permissions when a table uses serial or identity values.
- Do not restore automatic/default privileges for future objects.
