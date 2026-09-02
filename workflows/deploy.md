# Profiles Production Deployment

## Objective

Deploy an already-pushed `origin/main` to the Hostinger VPS running Profiles via
PM2 and Nginx.

## Architecture

| Item | Value |
|---|---|
| VPS | `root@72.61.245.97` |
| Production checkout | `/root/Profiles` |
| Local launcher | `scripts/deploy.sh` |
| VPS deploy script | `/root/Profiles/deploy/deploy.sh` |
| Processes | `profiles-api`, `profiles-frontend`, `profiles-admin`, `profiles-staff`, `profiles-admin-lite` |
| Public web | `https://squadhire.upsquadconnect.com` |
| API health | `https://squadhire.upsquadconnect.com/api/health` |

## Before deployment

1. Confirm local `main` is pushed and `origin/main` contains the intended commit.
2. Review the entire production range for migrations and environment changes.
3. Apply required Supabase migrations first; this deployment does not apply
   production migrations.
4. Ensure relevant builds/tests passed before shipping.

## Run

From the primary checkout:

```bash
bash /Users/jeffzeena/Profiles/scripts/deploy.sh
```

The VPS script pulls `origin/main`, installs dependencies, builds backend,
frontend, admin, staff, and admin-lite, recreates all five PM2 processes so new
environment values are loaded, saves PM2 state, validates/reloads Nginx, and
then optionally cascades to the separate hosted demo.

The demo cascade is guarded and non-fatal. A demo database/build problem must be
reported, but it does not undo a completed healthy production deploy.

## Verification

1. Confirm the VPS checkout SHA matches `origin/main`.
2. Confirm all five Profiles PM2 processes are online.
3. Confirm `nginx -t` passes.
4. Confirm the public web and API health endpoints return HTTP 200.
5. Runtime-test the changed user path when credentials and permissions allow.
6. Follow [test-handoff.md](test-handoff.md).

## Failure handling

- Build failure before process restart: fix and redeploy; production should
  continue serving the previous running processes.
- Failure after process replacement or failed health checks: inspect PM2/Nginx
  logs and follow [rollback.md](rollback.md) when a quick fix is not safer.
- Never describe the deploy as successful based only on script exit status.
