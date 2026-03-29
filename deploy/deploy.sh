#!/bin/bash
# ============================================
# Profiles Platform — Deploy / Update Script
# Run this on the VPS: bash /root/Profiles/deploy/deploy.sh
# ============================================

set -e

REPO_DIR="/root/Profiles"

echo "=== Pulling latest code ==="
cd "$REPO_DIR"
git pull origin main

echo "=== Installing backend dependencies ==="
cd "$REPO_DIR/backend"
npm install --omit=dev

echo "=== Building frontend ==="
cd "$REPO_DIR/frontend"
npm install
npm run build

echo "=== Building admin ==="
cd "$REPO_DIR/admin"
npm install
npm run build

echo "=== Restarting services ==="
pm2 restart profiles-api profiles-frontend profiles-admin

echo "=== Reloading nginx ==="
nginx -t && nginx -s reload

echo ""
echo "✓ Deploy complete!"
pm2 status
