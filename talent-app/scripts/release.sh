#!/bin/bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Talent app (Flutter) release + in-app-updater publisher.
#
# Mirrors the SquadHub partner app's tools/release.sh: bump the version, build
# a signed APK, checksum it, write the version manifest JSON, upload both the
# APK and the manifest to the VPS, and tag the release. The backend serves the
# manifest at GET /api/talent-app/version (reading the uploaded version.json),
# and the in-app updater polls it on launch.
#
# Usage:
#   ./scripts/release.sh                 # auto patch bump, optional update
#   ./scripts/release.sh --minor         # bump minor instead of patch
#   ./scripts/release.sh --major         # bump major
#   ./scripts/release.sh --force         # mark the release as a forced update
#   ./scripts/release.sh --min <code>    # set min_supported_version_code
#   ./scripts/release.sh --dry-run       # print the plan + manifest, build nothing
#   ./scripts/release.sh "Custom notes"  # override auto release notes (positional)
# ---------------------------------------------------------------------------

VPS="root@72.61.245.97"
VPS_DOWNLOAD_DIR="/var/www/talent-app-downloads"
APK_REMOTE_NAME="talent-app-latest.apk"
VPS_MANIFEST="/var/www/talent-app-downloads/version.json"
APK_URL="https://squadhire.upsquadconnect.com/talent-app/talent-app-latest.apk"
VERSION_ENDPOINT="https://squadhire.upsquadconnect.com/api/talent-app/version"

# Toolchain (match scripts/publish.sh in admin-lite-mobile; override via env).
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/.."

BUMP="patch"
FORCE="false"
MIN_CODE=""
DRY_RUN="false"
NOTES_OVERRIDE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --minor) BUMP="minor" ;;
    --major) BUMP="major" ;;
    --force) FORCE="true" ;;
    --min) shift; MIN_CODE="$1" ;;
    --dry-run) DRY_RUN="true" ;;
    *) NOTES_OVERRIDE="$1" ;;
  esac
  shift
done

PUBSPEC="pubspec.yaml"
CUR_LINE="$(grep -E '^version:' "$PUBSPEC" | head -1)"
CUR_NAME="$(echo "$CUR_LINE" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+).*/\1/')"
CUR_CODE="$(echo "$CUR_LINE" | sed -E 's/^version:[[:space:]]*([0-9]+\.[0-9]+\.[0-9]+)\+([0-9]+).*/\2/')"

IFS='.' read -r MAJ MINR PAT <<< "$CUR_NAME"
case "$BUMP" in
  major) MAJ=$((MAJ + 1)); MINR=0; PAT=0 ;;
  minor) MINR=$((MINR + 1)); PAT=0 ;;
  patch) PAT=$((PAT + 1)) ;;
esac
NEW_NAME="${MAJ}.${MINR}.${PAT}"
NEW_CODE=$((CUR_CODE + 1))
[ -z "$MIN_CODE" ] && MIN_CODE=1

# Release notes: feat/fix subjects since the last release/* tag (auto-bulleted).
if [ -n "$NOTES_OVERRIDE" ]; then
  RELEASE_NOTES="$NOTES_OVERRIDE"
else
  PREV_TAG="$(git describe --tags --abbrev=0 --match 'talent-release/*' 2>/dev/null || true)"
  RANGE="HEAD"; [ -n "$PREV_TAG" ] && RANGE="$PREV_TAG..HEAD"
  RELEASE_NOTES="$(git log $RANGE --no-merges --pretty='%s' 2>/dev/null \
    | grep -iE '^(feat|fix)(\(|!|:)' \
    | sed -E 's/^(feat|fix)(\([^)]*\))?!?:[[:space:]]*//I' \
    | head -6 | sed 's/^/• /' || true)"
  [ -z "$RELEASE_NOTES" ] && RELEASE_NOTES="Improvements and bug fixes."
fi

echo "=== Talent app release ==="
echo "  Version:     $CUR_NAME ($CUR_CODE) -> $NEW_NAME ($NEW_CODE)"
echo "  Force:       $FORCE"
echo "  Min code:    $MIN_CODE"
echo "  APK URL:     $APK_URL"
echo "  Notes:"
echo "$RELEASE_NOTES" | sed 's/^/    /'
echo ""

build_manifest() {
  local sha="$1"
  VC="$NEW_CODE" VN="$NEW_NAME" AU="$APK_URL" SH="$sha" \
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

echo "[1/6] Bumping pubspec.yaml version -> $NEW_NAME+$NEW_CODE ..."
# Portable in-place sed (BSD + GNU).
sed -i.bak -E "s/^version:.*/version: ${NEW_NAME}+${NEW_CODE}/" "$PUBSPEC" && rm -f "$PUBSPEC.bak"

echo "[2/6] Building release APK (flutter build apk --release) ..."
flutter build apk --release
APK_PATH="build/app/outputs/flutter-apk/app-release.apk"
[ -f "$APK_PATH" ] || { echo "ERROR: APK not found at $APK_PATH"; exit 1; }
echo "  Built: $APK_PATH ($(du -h "$APK_PATH" | cut -f1))"

echo "[3/6] Computing sha256 ..."
SHA="$(shasum -a 256 "$APK_PATH" | cut -d' ' -f1)"
echo "  sha256: $SHA"

echo "[4/6] Uploading APK -> $VPS:$VPS_DOWNLOAD_DIR/$APK_REMOTE_NAME ..."
ssh "$VPS" "mkdir -p $VPS_DOWNLOAD_DIR"
scp "$APK_PATH" "$VPS:$VPS_DOWNLOAD_DIR/$APK_REMOTE_NAME"

echo "[5/6] Publishing manifest -> $VPS:$VPS_MANIFEST ..."
build_manifest "$SHA" | ssh "$VPS" "cat > $VPS_MANIFEST"

echo "[6/6] Tagging release + verifying endpoint ..."
git add "$PUBSPEC"
git commit -m "talent-app: release $NEW_NAME ($NEW_CODE)" || true
git tag -f "talent-release/${NEW_NAME}" >/dev/null 2>&1 || true
sleep 6   # backend fs.watchFile reloads the manifest within ~5s
echo "  GET $VERSION_ENDPOINT"
curl -s "$VERSION_ENDPOINT" || true
echo ""
echo "=== Published talent-app $NEW_NAME ($NEW_CODE) ==="
echo "  Push the commit + tag when ready:  git push origin HEAD --tags"
