#!/bin/bash
set -euo pipefail

# Admin-Lite Android publish pipeline
# Usage: ./scripts/publish.sh [version]
# Example: ./scripts/publish.sh 2.0.1

VPS="root@72.61.245.97"
VPS_APK_PATH="/var/www/admin-lite-downloads/admin-lite-latest.apk"
VPS_HTML_PATH="/var/www/admin-lite-downloads/download.html"

export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=~/Library/Android/sdk
export ANDROID_SDK_ROOT=~/Library/Android/sdk
export PATH="$JAVA_HOME/bin:$PATH"

cd "$(dirname "$0")/.."

CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
CURRENT_CODE=$(node -p "require('./app.json').expo.android.versionCode")
VERSION="${1:-}"

if [ -z "$VERSION" ]; then
  echo "Current version: $CURRENT_VERSION (code $CURRENT_CODE)"
  echo "Usage: ./scripts/publish.sh <new-version>"
  echo "Example: ./scripts/publish.sh 2.0.1"
  exit 1
fi

if [ ! -f "android-keystore" ]; then
  echo "ERROR: android-keystore missing."
  echo "Copy it from your backup: cp ~/Desktop/admin-lite-keystore/android-keystore ./android-keystore"
  exit 1
fi

NEXT_CODE=$((CURRENT_CODE + 1))

echo "=== Admin-Lite Publish Pipeline ==="
echo "  Version:    $CURRENT_VERSION -> $VERSION"
echo "  VersionCode: $CURRENT_CODE -> $NEXT_CODE"
echo ""

echo "[1/5] Bumping version in app.json..."
node -e "
  const fs = require('fs');
  const p = require('./app.json');
  p.expo.version = '$VERSION';
  p.expo.android.versionCode = $NEXT_CODE;
  fs.writeFileSync('./app.json', JSON.stringify(p, null, 2) + '\n');
"

echo "[2/5] Committing and pushing..."
git add app.json
git commit -m "admin-lite-mobile: bump to $VERSION (code $NEXT_CODE)"
git push origin main

echo "[3/5] Building APK locally (this takes several minutes)..."
npx eas-cli build --platform android --profile preview --local --non-interactive
APK_FILE=$(ls -t build-*.apk 2>/dev/null | head -1)
if [ -z "$APK_FILE" ]; then
  echo "ERROR: No APK file found after build"
  exit 1
fi
echo "  Built: $APK_FILE ($(du -h "$APK_FILE" | cut -f1))"

echo "[4/5] Uploading APK to VPS..."
rsync -avz --progress -e "ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=5" \
  "$APK_FILE" "$VPS:$VPS_APK_PATH"

echo "[5/5] Updating download page..."
TIMESTAMP=$(TZ="Asia/Kolkata" date +'%-d %b %Y, %-I:%M %p IST')
ssh "$VPS" "sed -i 's/Version [0-9]\+\.[0-9]\+\.[0-9]\+/Version $VERSION/g' $VPS_HTML_PATH || true"
ssh "$VPS" "sed -i 's/Updated on .*/Updated on $TIMESTAMP<\/p>/' $VPS_HTML_PATH || true"

echo ""
echo "=== Published $VERSION ==="
echo "  Download: https://squadhire.upsquadconnect.com/admin-lite/admin-lite-latest.apk"
echo "  Landing:  https://squadhire.upsquadconnect.com/admin-lite/download.html"
