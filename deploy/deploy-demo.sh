#!/bin/bash
# ============================================
# SquadHire — HOSTED DEMO deploy / update
# Run on the VPS:  bash /root/Profiles-demo/deploy/deploy-demo.sh
#
# Builds, migrates & (re)starts the always-on demo stack served at
# https://squadhire-demo.upsquadconnect.com, pointed at the DEMO Supabase
# project. All demo config (incl. secrets) lives in
# /root/Profiles-demo/backend/.env (NOT in git — see deploy/demo/README.md).
#
# Runs automatically at the tail of the prod deploy (deploy/deploy.sh) so the
# demo tracks main, but is also safe to run by hand.
#
# This is a SEPARATE checkout from prod (/root/Profiles); it only ever touches
# the profiles-demo-* PM2 processes and the DEMO Supabase project, never prod.
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

# ---------------------------------------------------------------------------
# Apply any NEW migrations to the DEMO Supabase project (incremental).
# apply-schema.ts applies only files not yet in demo/.applied-migrations and
# appends the ones it runs, so this is safe to run on every deploy. Migrations
# run BEFORE the restart so new code never comes up against an old schema; a
# failure here aborts the demo deploy (set -e) while the old demo keeps serving
# on its still-running PM2 processes. Never reseeds — demo data is preserved.
# DEMO_REF / DEMO_DB_PASSWORD live in the demo backend/.env (gitignored).
# ---------------------------------------------------------------------------
echo "=== Applying new demo DB migrations ==="
cd "$DST/backend"
DEMO_REF="$(grep -E '^DEMO_REF=' .env | cut -d= -f2- || true)"
DEMO_DB_PASSWORD="$(grep -E '^DEMO_DB_PASSWORD=' .env | cut -d= -f2- || true)"
if [ -n "$DEMO_REF" ] && [ -n "$DEMO_DB_PASSWORD" ]; then
  DEMO_REF="$DEMO_REF" DEMO_DB_PASSWORD="$DEMO_DB_PASSWORD" \
    MIGRATIONS_DIR="$DST/supabase/migrations" \
    APPLIED_MANIFEST="$DST/demo/.applied-migrations" \
    npx tsx src/scripts/apply-schema.ts
else
  echo "  ! DEMO_REF / DEMO_DB_PASSWORD missing in backend/.env — skipping migrations."
fi

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
