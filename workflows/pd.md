# PD — Push and Deploy

## Objective

Push an already-committed local `main` and deploy that exact result to Profiles
production. This is the shipping half of CMPD.

## Preconditions

- The primary checkout is on `main`.
- All intended changes are already committed and merged.
- Any unrelated dirty files are understood and will not be staged or modified.

## Steps

1. Inspect `git status`, `git log --oneline origin/main..main`, and the full
   `origin/main..main` diff. The deploy ships that entire range, not just the
   current task.
2. Check the full range for new `supabase/migrations/*.sql` files. Apply required
   production migrations through an authenticated Supabase path before code
   that depends on them. The deploy script does not apply migrations.
3. Push with `git push origin main`. If rejected because the remote advanced,
   fetch and reconcile without overwriting either side; do not force-push.
4. Deploy from the primary checkout:

   ```bash
   bash /Users/jeffzeena/Profiles/scripts/deploy.sh
   ```

5. Verify the VPS checkout equals local `main`, PM2 reports the five Profiles
   processes online, and Nginx configuration is valid.
6. Verify HTTP 200 responses from:
   - `https://squadhire.upsquadconnect.com`
   - `https://squadhire.upsquadconnect.com/api/health`
7. If the optional hosted-demo cascade fails, report it separately. Production
   can still be healthy because that cascade is deliberately non-fatal.
8. Follow [test-handoff.md](test-handoff.md), covering everything in the shipped
   range.

## Recovery

- Re-run the deploy script after a transient build or SSH failure.
- If production is unhealthy after deployment, use [rollback.md](rollback.md).
