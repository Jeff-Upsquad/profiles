#!/bin/bash
# ============================================
# Profiles Platform — Deploy / Update Script
# Run this on the VPS: bash /root/Profiles/deploy/deploy.sh
# ============================================

set -e

REPO_DIR="/root/Profiles"

# ---------------------------------------------------------------------------
# Port configuration (must match nginx sites-enabled/profiles)
# ---------------------------------------------------------------------------
API_PORT=5000
FRONTEND_PORT=3002
ADMIN_PORT=3003
ADMIN_LITE_PORT=3004
STAFF_PORT=3007

echo "=== Pulling latest code ==="
cd "$REPO_DIR"
git pull origin main

echo "=== Installing and building backend ==="
cd "$REPO_DIR/backend"
npm install
npm run build

echo "=== Building frontend ==="
cd "$REPO_DIR/frontend"
npm install
npm run build

echo "=== Building admin ==="
cd "$REPO_DIR/admin"
npm install
npm run build

# Staff portal = the admin codebase rebuilt in staff mode (basePath /staff,
# distDir .next-staff). Same source, restricted runtime. Must run AFTER the
# default admin build so the two outputs don't share a dir.
echo "=== Building staff portal (admin in staff mode) ==="
cd "$REPO_DIR/admin"
NEXT_PUBLIC_APP_MODE=staff npm run build

echo "=== Building admin-lite ==="
cd "$REPO_DIR/admin-lite"
npm install
npm run build

echo "=== Restarting services ==="
# Delete and recreate processes with explicit ports to avoid port drift.
#
# NOTE — also the env-reload guarantee: pm2 caches each process's env at start
# time. A plain `pm2 restart <name>` does NOT re-read .env; only dotenv inside
# the Node process runs fresh on spawn. We use `pm2 delete && pm2 start` so
# every deploy picks up `.env` changes unconditionally. Do not "simplify" this
# to `pm2 restart` (even `pm2 restart all`) — it silently ships stale secrets.
#
# For env-only reloads between deploys (no rebuild), use deploy/reload-env.sh.
pm2 delete profiles-api profiles-frontend profiles-admin profiles-staff profiles-admin-lite 2>/dev/null || true

cd "$REPO_DIR/backend"
pm2 start "npm run start" --name profiles-api

cd "$REPO_DIR/frontend"
pm2 start "npm run start -- -p $FRONTEND_PORT" --name profiles-frontend

cd "$REPO_DIR/admin"
pm2 start "npm run start -- -p $ADMIN_PORT" --name profiles-admin

# Staff portal — same admin dir, started in staff mode so next.config resolves
# basePath /staff + distDir .next-staff. NEXT_PUBLIC_APP_MODE must be in the
# process env at spawn (pm2 caches env at start).
cd "$REPO_DIR/admin"
NEXT_PUBLIC_APP_MODE=staff pm2 start "npm run start -- -p $STAFF_PORT" --name profiles-staff

cd "$REPO_DIR/admin-lite"
pm2 start "npm run start -- -p $ADMIN_LITE_PORT" --name profiles-admin-lite

pm2 save

echo "=== Reloading nginx ==="
nginx -t && nginx -s reload

echo ""
echo "✓ Deploy complete!"
echo "  API:        http://localhost:$API_PORT"
echo "  Frontend:   http://localhost:$FRONTEND_PORT"
echo "  Admin:      http://localhost:$ADMIN_PORT"
echo "  Staff:      http://localhost:$STAFF_PORT"
echo "  Admin-Lite: http://localhost:$ADMIN_LITE_PORT"
pm2 status

# ---------------------------------------------------------------------------
# Cascade to the hosted demo so it tracks main automatically. The demo is a
# SEPARATE checkout (/root/Profiles-demo) with its own Supabase + .env;
# deploy-demo.sh pulls main, rebuilds admin+frontend+backend, applies new
# demo-DB migrations, and restarts ONLY the profiles-demo-* processes.
#
# Guarded and non-fatal: it runs in a subshell whose failure is swallowed by
# `|| echo`, so a demo build/migration problem can never fail the prod deploy
# above (which has already completed at this point).
# ---------------------------------------------------------------------------
DEMO_DEPLOY="/root/Profiles-demo/deploy/deploy-demo.sh"
if [ -f "$DEMO_DEPLOY" ]; then
  echo ""
  echo "=== Cascading to hosted demo (non-fatal) ==="
  ( bash "$DEMO_DEPLOY" ) || echo "⚠ Demo update FAILED — prod is unaffected. Inspect: bash $DEMO_DEPLOY"
else
  echo ""
  echo "ℹ Demo deploy script not found at $DEMO_DEPLOY — skipping demo update."
fi
