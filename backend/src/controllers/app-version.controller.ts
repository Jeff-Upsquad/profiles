import { Request, Response, NextFunction } from 'express';
import { createManifestLoader, VersionManifest } from '../lib/version-manifest.js';

// Fallbacks mirror the current shipped builds so that, when no manifest file is
// present, clients compute "installed >= manifest" and see no update (rather
// than an error). Release scripts overwrite the real manifest on the VPS.
const talentFallback: VersionManifest = {
  version_code: 5,
  version_name: '1.0.4',
  apk_url: 'https://squadhire.upsquadconnect.com/talent-app/talent-app-latest.apk',
  sha256: '9c5aa91a032dbb34e518e70064ff0e0cf3780b35cb1528048e319071a6d0afa2',
  release_notes: '',
  force_update: false,
  min_supported_version_code: 1,
};

const adminLiteFallback: VersionManifest = {
  version_code: 4,
  version_name: '2.0.2',
  apk_url: 'https://squadhire.upsquadconnect.com/admin-lite/admin-lite-latest.apk',
  sha256: '1726c712416b7c3d6fab495603567c22a9ea06936ffb12f3c4aa2ecb45557b69',
  release_notes: '',
  force_update: false,
  min_supported_version_code: 1,
};

const loadTalent = createManifestLoader({
  label: 'talent-app/version',
  envVar: 'TALENT_APP_MANIFEST_PATH',
  defaultFile: 'talent-app-release-manifest.json',
  fallback: talentFallback,
});

const loadAdminLite = createManifestLoader({
  label: 'admin-lite/version',
  envVar: 'ADMIN_LITE_MANIFEST_PATH',
  defaultFile: 'admin-lite-release-manifest.json',
  fallback: adminLiteFallback,
});

export function talentApp(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: loadTalent() });
  } catch (err) {
    next(err);
  }
}

export function adminLite(_req: Request, res: Response, next: NextFunction): void {
  try {
    res.json({ success: true, data: loadAdminLite() });
  } catch (err) {
    next(err);
  }
}
