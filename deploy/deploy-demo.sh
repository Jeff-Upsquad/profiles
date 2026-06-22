#!/bin/bash
# ============================================
# SquadHire — HOSTED DEMO deploy / update
# Run on the VPS:  bash /root/Profiles-demo/deploy-demo.sh
#
# Builds & (re)starts the always-on demo stack served at
# https://squadhire-demo.upsquadconnect.com, pointed at the DEMO Supabase
# project. All demo config (incl. secrets) lives in
# /root/Profiles-demo/backend/.env (NOT in git — see deploy/demo/README.md).
#
# This is a SEPARATE checkout from prod (/root/Profiles); it only ever touches
# the profiles-demo-* PM2 processes and never the prod ones.
# ============================================
set -e

DST="${DEMO_DIR:-/root/Profiles-demo}"
API_PORT=5001          # must match PORT in backend/.env and the nginx vhost
FRONTEND_PORT=3005
ADMIN_PORT=3006

echo "=== Pulling latest main ==="
cd "$DST"
git pull origin main

echo "=== Building backend ===";  cd "$DST/backend";  npm install --no-audit --no-fund; npm run build
echo "=== Building frontend ==="; cd "$DST/frontend"; npm install --no-audit --no-fund; npm run build
echo "=== Building admin ===";    cd "$DST/admin";    npm install --no-audit --no-fund; npm run build

echo "=== (Re)starting PM2 demo processes ==="
# delete + start (not restart) so .env / env changes are always picked up.
pm2 delete profiles-demo-api profiles-demo-frontend profiles-demo-admin 2>/dev/null || true
cd "$DST/backend"  && pm2 start "npm run start" --name profiles-demo-api
cd "$DST/frontend" && BACKEND_URL=http://localhost:$API_PORT pm2 start "npm run start -- -p $FRONTEND_PORT" --name profiles-demo-frontend
cd "$DST/admin"    && BACKEND_PORT=$API_PORT pm2 start "npm run start -- -p $ADMIN_PORT" --name profiles-demo-admin
pm2 save

echo ""
echo "✓ Demo deploy complete → https://squadhire-demo.upsquadconnect.com"
echo "  api 127.0.0.1:$API_PORT | frontend :$FRONTEND_PORT | admin :$ADMIN_PORT"
