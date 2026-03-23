#!/bin/bash
# ============================================
# Profiles Platform — Deploy / Update Script
# Run this on the VPS to pull latest changes
# ============================================

set -e

APP_DIR="/var/www/profiles"

echo "=== Pulling latest code ==="
cd "$APP_DIR"
git pull origin main

echo "=== Installing backend dependencies ==="
cd "$APP_DIR/backend"
npm install --omit=dev

echo "=== Building frontend ==="
cd "$APP_DIR/frontend"
npm install
npm run build

echo "=== Building admin ==="
cd "$APP_DIR/admin"
npm install
npm run build

echo "=== Restarting services ==="
pm2 restart profiles-api profiles-frontend profiles-admin

echo "=== Reloading nginx ==="
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✓ Deploy complete!"
pm2 status
