#!/usr/bin/env bash
# demo/sync.sh — pull the latest "original code" (the SquadHire `main` branch)
# into this demo worktree, apply any NEW DB migrations to the demo Supabase
# project, and (optionally) re-seed.
#
#   ./demo/sync.sh            # merge main + apply new migrations (keeps demo data)
#   ./demo/sync.sh --reseed   # ...and also re-seed the dummy data (wipes + recreates)
#
# Safe to run anytime. Code-only changes are picked up by the dev server's
# hot-reload; new migrations are applied incrementally (tracked in
# demo/.applied-migrations); re-seed is opt-in so it never clobbers a demo
# you're mid-recording.
set -euo pipefail

WT="$(cd "$(dirname "$0")/.." && pwd)"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
RESEED=0
[ "${1:-}" = "--reseed" ] && RESEED=1

cd "$WT"
CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "▶ Syncing demo worktree ($CUR_BRANCH) ← $MAIN_BRANCH"

# 1) Bring in the latest main. Fetch is best-effort (offline is fine if main
#    is already up to date locally).
git fetch origin "$MAIN_BRANCH" --quiet 2>/dev/null || true
INCOMING="$(git log --oneline "HEAD..$MAIN_BRANCH" 2>/dev/null | wc -l | tr -d ' ')"
if [ "$INCOMING" = "0" ]; then
  echo "  • code already up to date with $MAIN_BRANCH"
else
  echo "  • merging $INCOMING new commit(s) from $MAIN_BRANCH…"
  if ! git merge --no-edit "$MAIN_BRANCH"; then
    git merge --abort 2>/dev/null || true
    echo "  ✗ merge conflict — resolve manually in $WT, then re-run. Aborted." >&2
    exit 1
  fi
fi

# 2) Apply any NEW migrations to the demo DB (incremental via the manifest).
DEMO_REF="$(grep -E '^DEMO_REF=' backend/.env | cut -d= -f2- || true)"
DEMO_DB_PASSWORD="$(grep -E '^DEMO_DB_PASSWORD=' backend/.env | cut -d= -f2- || true)"
if [ -z "$DEMO_REF" ] || [ -z "$DEMO_DB_PASSWORD" ]; then
  echo "  ! DEMO_REF / DEMO_DB_PASSWORD missing in backend/.env — skipping migrations." >&2
else
  BEFORE="$(wc -l < demo/.applied-migrations 2>/dev/null | tr -d ' ' || echo 0)"
  ( cd "$WT/backend" && DEMO_REF="$DEMO_REF" DEMO_DB_PASSWORD="$DEMO_DB_PASSWORD" \
      MIGRATIONS_DIR="$WT/supabase/migrations" \
      APPLIED_MANIFEST="$WT/demo/.applied-migrations" \
      npx tsx src/scripts/apply-schema.ts )
  AFTER="$(wc -l < demo/.applied-migrations 2>/dev/null | tr -d ' ' || echo 0)"
  NEW_MIGRATIONS=$((AFTER - BEFORE))
  if [ "$NEW_MIGRATIONS" -gt 0 ] && [ "$RESEED" = "0" ]; then
    echo "  ⚠ $NEW_MIGRATIONS new migration(s) applied — schema changed."
    echo "    If the seed needs to match, run:  cd backend && npm run seed:demo"
  fi
fi

# 3) Optional re-seed (opt-in; wipes + recreates the demo data).
if [ "$RESEED" = "1" ]; then
  echo "  • re-seeding demo data…"
  ( cd backend && npm run seed:demo )
fi

echo "✅ Demo sync complete."
