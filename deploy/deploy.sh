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
pm2 delete profiles-api profiles-frontend profiles-admin profiles-admin-lite 2>/dev/null || true

cd "$REPO_DIR/backend"
pm2 start "npm run start" --name profiles-api

cd "$REPO_DIR/frontend"
pm2 start "npm run start -- -p $FRONTEND_PORT" --name profiles-frontend

cd "$REPO_DIR/admin"
pm2 start "npm run start -- -p $ADMIN_PORT" --name profiles-admin

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
echo "  Admin-Lite: http://localhost:$ADMIN_LITE_PORT"
pm2 status
