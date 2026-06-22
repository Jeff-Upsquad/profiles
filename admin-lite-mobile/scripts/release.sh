#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Admin-Lite (Expo) release + in-app-updater publisher.
#
# Mirrors the SquadHub partner app's tools/release.sh (and supersedes the older
# publish.sh, which did not write the updater manifest): bump the version, build
# a signed APK locally via EAS, checksum it, write the version manifest JSON,
# upload both the APK and the manifest to the VPS, refresh the download page,
# and tag the release. The backend serves the manifest at
# GET /api/admin-lite/version (reading the uploaded version.json), and the
# in-app updater polls it on launch.
#
# Usage:
#   ./scripts/release.sh <new-version>           # e.g. 2.0.2
#   ./scripts/release.sh <new-version> --force   # mark as a forced update
#   ./scripts/release.sh <new-version> --min <code>
#   ./scripts/release.sh <new-version> --dry-run
#   ./scripts/release.sh <new-version> --notes "Custom release notes"
# ---------------------------------------------------------------------------

VPS="root@72.61.245.97"
VPS_DOWNLOAD_DIR="/var/www/admin-lite-downloads"
APK_REMOTE_NAME="admin-lite-latest.apk"
VPS_MANIFEST="/var/www/admin-lite-downloads/version.json"
APK_URL="https://squadhire.upsquadconnect.com/admin-lite/admin-lite-latest.apk"
VERSION_ENDPOINT="https://squadhire.upsquadconnect.com/api/admin-lite/version"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/.."

VERSION=""
FORCE="false"
MIN_CODE=""
DRY_RUN="false"
NOTES_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE="true" ;;
    --min) shift; MIN_CODE="$1" ;;
    --dry-run) DRY_RUN="true" ;;
    --notes) shift; NOTES_OVERRIDE="$1" ;;
    *) VERSION="$1" ;;
  esac
  shift
done

CUR_NAME="$(node -p "require('./app.json').expo.version")"
CUR_CODE="$(node -p "require('./app.json').expo.android.versionCode")"

if [ -z "$VERSION" ]; then
  echo "Current version: $CUR_NAME (code $CUR_CODE)"
  echo "Usage: ./scripts/release.sh <new-version> [--force] [--min <code>] [--dry-run] [--notes \"...\"]"
  exit 1
fi

NEW_CODE=$((CUR_CODE + 1))
[ -z "$MIN_CODE" ] && MIN_CODE=1

if [ -n "$NOTES_OVERRIDE" ]; then
  RELEASE_NOTES="$NOTES_OVERRIDE"
else
  PREV_TAG="$(git describe --tags --abbrev=0 --match 'admin-lite-release/*' 2>/dev/null || true)"
  RANGE="HEAD"; [ -n "$PREV_TAG" ] && RANGE="$PREV_TAG..HEAD"
  RELEASE_NOTES="$(git log $RANGE --no-merges --pretty='%s' 2>/dev/null \
    | grep -iE '^(feat|fix)(\(|!|:)' \
    | sed -E 's/^(feat|fix)(\([^)]*\))?!?:[[:space:]]*//I' \
    | head -6 | sed 's/^/• /' || true)"
  [ -z "$RELEASE_NOTES" ] && RELEASE_NOTES="Improvements and bug fixes."
fi

echo "=== Admin-Lite release ==="
echo "  Version:     $CUR_NAME ($CUR_CODE) -> $VERSION ($NEW_CODE)"
echo "  Force:       $FORCE"
echo "  Min code:    $MIN_CODE"
echo "  APK URL:     $APK_URL"
echo "  Notes:"
echo "$RELEASE_NOTES" | sed 's/^/    /'
echo ""

build_manifest() {
  local sha="$1"
  VC="$NEW_CODE" VN="$VERSION" AU="$APK_URL" SH="$sha" \
  RN="$RELEASE_NOTES" FU="$FORCE" MC="$MIN_CODE" python3 - <<'PY'
import json, os
print(json.dumps({
    "version_code": int(os.environ["VC"]),
    "version_name": os.environ["VN"],
    "apk_url": os.environ["AU"],
    "sha256": os.environ["SH"],
    "release_notes": os.environ["RN"],
    "force_update": os.environ["FU"] == "true",
    "min_supported_version_code": int(os.environ["MC"]),
}, indent=2))
PY
}

if [ "$DRY_RUN" = "true" ]; then
  echo "[dry-run] manifest that would be published:"
  build_manifest "<sha256-after-build>"
  exit 0
fi

if [ ! -f "android-keystore" ]; then
  echo "ERROR: android-keystore missing."
  echo "Copy it from your backup: cp ~/Desktop/admin-lite-keystore/android-keystore ./android-keystore"
  exit 1
fi

echo "[1/6] Bumping app.json -> $VERSION (code $NEW_CODE) ..."
node -e "
  const fs = require('fs');
  const p = require('./app.json');
  p.expo.version = '$VERSION';
  p.expo.android.versionCode = $NEW_CODE;
  fs.writeFileSync('./app.json', JSON.stringify(p, null, 2) + '\n');
"

echo "[2/6] Building APK locally (eas build --local) ..."
npx eas-cli build --platform android --profile preview --local --non-interactive
APK_PATH="$(ls -t build-*.apk 2>/dev/null | head -1)"
[ -n "$APK_PATH" ] || { echo "ERROR: no APK produced"; exit 1; }
echo "  Built: $APK_PATH ($(du -h "$APK_PATH" | cut -f1))"

echo "[3/6] Computing sha256 ..."
SHA="$(shasum -a 256 "$APK_PATH" | cut -d' ' -f1)"
echo "  sha256: $SHA"

echo "[4/6] Uploading APK -> $VPS:$VPS_DOWNLOAD_DIR/$APK_REMOTE_NAME ..."
ssh "$VPS" "mkdir -p $VPS_DOWNLOAD_DIR"
rsync -avz --progress -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=5" \
  "$APK_PATH" "$VPS:$VPS_DOWNLOAD_DIR/$APK_REMOTE_NAME"

echo "[5/6] Publishing manifest -> $VPS:$VPS_MANIFEST ..."
build_manifest "$SHA" | ssh "$VPS" "cat > $VPS_MANIFEST"
# The download page (admin-lite/public/download.html) reads this manifest at
# runtime via fetch('/api/admin-lite/version'), so no server-side page edit is
# needed — it always reflects the published version.

echo "[6/6] Committing + tagging + verifying endpoint ..."
git add app.json
git commit -m "admin-lite-mobile: release $VERSION (code $NEW_CODE)" || true
git tag -f "admin-lite-release/${VERSION}" >/dev/null 2>&1 || true
sleep 6   # backend fs.watchFile reloads the manifest within ~5s
echo "  GET $VERSION_ENDPOINT"
curl -s "$VERSION_ENDPOINT" || true
echo ""
echo "=== Published admin-lite $VERSION ($NEW_CODE) ==="
echo "  Download: $APK_URL"
echo "  Push the commit + tag when ready:  git push origin HEAD --tags"
