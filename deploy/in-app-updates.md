# In-app updaters (talent-app + admin-lite-mobile)

Both sideloaded Android apps now self-update, using the **same mechanism** as the
SquadHub partner app: poll a version manifest on launch → if a newer build
exists, show an inline "Update available" card (optional) or a blocking
"Update required" dialog (forced) → download the APK with a progress bar →
verify its sha256 → hand it to the system package installer.

```
app launch ──► GET /api/<app>/version ──► compare version_code vs installed
                     │                              │
              backend reads version.json      newer? show card / gate
              (hot-reloads on change)               │
                                          tap Update ─► download .apk ─► sha256 ─► installer
```

## Pieces

| Layer | talent-app (Flutter) | admin-lite-mobile (Expo) |
|-------|----------------------|--------------------------|
| Manifest endpoint | `GET /api/talent-app/version` | `GET /api/admin-lite/version` |
| Manifest file (server) | `$TALENT_APP_MANIFEST_PATH` | `$ADMIN_LITE_MANIFEST_PATH` |
| Committed fallback | `backend/talent-app-release-manifest.json` | `backend/admin-lite-release-manifest.json` |
| APK (served) | `/talent-app/talent-app-latest.apk` | `/admin-lite/admin-lite-latest.apk` |
| APK dir (server) | `/var/www/talent-app-downloads/` | `/var/www/admin-lite-downloads/` |
| Release script | `talent-app/scripts/release.sh` | `admin-lite-mobile/scripts/release.sh` |

The manifest is the **single source of truth**:

```json
{
  "version_code": 5,
  "version_name": "1.0.4",
  "apk_url": "https://squadhire.upsquadconnect.com/talent-app/talent-app-latest.apk",
  "sha256": "<hex or empty to skip>",
  "release_notes": "• Fixed X\n• Added Y",
  "force_update": false,
  "min_supported_version_code": 1
}
```

- `version_code` ≤ installed → no prompt.
- `force_update: true` **or** installed `< min_supported_version_code` → the
  blocking gate (cannot be dismissed) instead of the optional card.
- `sha256` empty (or starting `00000`) → checksum check is skipped (matches the
  partner convention; HTTPS still protects the transfer).

The backend reads the file once, caches it, and re-reads on change
(`fs.watchFile`, ~5s) — so a release flips the manifest **without an API
restart**. If the file is missing/unreadable it falls back to the committed
default (which equals the current shipped build → "no update").

## One-time server setup (action items)

1. **Create the download dirs** (idempotent; the release scripts also `mkdir -p`):
   ```sh
   ssh root@72.61.245.97 'mkdir -p /var/www/talent-app-downloads /var/www/admin-lite-downloads'
   ```
2. **Point the backend at the manifest files** — add to the server's
   `backend/.env`:
   ```
   TALENT_APP_MANIFEST_PATH=/var/www/talent-app-downloads/version.json
   ADMIN_LITE_MANIFEST_PATH=/var/www/admin-lite-downloads/version.json
   ```
   Then reload env (no rebuild needed):
   ```sh
   ssh root@72.61.245.97 'bash /root/Profiles/deploy/reload-env.sh'
   ```
   Until a `version.json` exists, the endpoints serve the committed fallback
   (no update prompt) — safe.
3. **No nginx change required.** The manifest rides the existing `/api` → backend
   proxy, and the `*-latest.apk` files are already served by the existing
   `/talent-app/...` and `/admin-lite/...` location blocks.

## Publishing a new version

Each release script bumps the version, builds + signs the APK, checksums it,
writes `version.json`, uploads the APK + manifest, refreshes the download page
(admin-lite), tags the release, and verifies the endpoint.

```sh
# talent-app: auto patch bump
cd talent-app && ./scripts/release.sh
#   --minor / --major   bump size
#   --force             forced (blocking) update
#   --min <code>        set min_supported_version_code
#   --dry-run           print the plan + manifest, build nothing

# admin-lite: explicit version (requires ./android-keystore)
cd admin-lite-mobile && ./scripts/release.sh 2.0.2
#   same flags, plus --notes "..." to override the auto feat/fix notes
# (npm run release / npm run publish both call this)
```

Release notes are auto-written from `feat:` / `fix:` commit subjects since the
last `*-release/*` tag. The scripts **commit + tag locally** but do not push —
run `git push origin HEAD --tags` when ready.

## On-device permission

The first in-app install asks the user to allow "install unknown apps" for this
app (Android 8+). talent-app pre-checks this and opens the settings page;
admin-lite relies on the OS prompt, and exposes the settings shortcut if the
install intent is blocked. The required `REQUEST_INSTALL_PACKAGES` permission is
declared in each app's manifest.
