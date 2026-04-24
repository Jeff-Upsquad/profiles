#!/bin/bash
# ============================================
# Profiles — Env-Only Reload
# Run on the VPS after editing backend/.env (or any service's env) without a
# full redeploy: bash /root/Profiles/deploy/reload-env.sh
#
# Why this exists: pm2 caches each process's env at start time, so a plain
# `pm2 restart <name>` will NOT pick up new .env values. `--update-env`
# forces pm2 to refresh from the calling shell, and we always target each
# service by name so `pm2 restart all`'s occasional silent skip never bites.
# ============================================

set -e

for svc in profiles-api profiles-frontend profiles-admin profiles-admin-lite; do
  if pm2 id "$svc" >/dev/null 2>&1; then
    echo "=== Restarting $svc with env reload ==="
    pm2 restart "$svc" --update-env
  else
    echo "[skip] $svc not registered with pm2"
  fi
done

pm2 save
pm2 status
