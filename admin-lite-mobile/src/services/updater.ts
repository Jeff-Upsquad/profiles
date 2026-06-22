import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import type { VersionManifest } from './version';

/** Raised when the OS won't let us install until the user allows this source. */
export class InstallPermissionRequired extends Error {
  constructor() {
    super('Allow installs from this app, then tap Update again.');
    this.name = 'InstallPermissionRequired';
  }
}

/** Android versionCode of the running build (0 if unavailable). */
export function currentVersionCode(): number {
  const raw = Application.nativeBuildVersion; // string | null on Android
  return raw ? parseInt(raw, 10) || 0 : 0;
}

/**
 * Download [manifest]'s APK to the cache with progress, verify its sha256, and
 * hand it to the system package installer. Mirrors the partner app's
 * downloadAndInstall. Android-only; a no-op elsewhere.
 */
export async function downloadAndInstall(
  manifest: VersionManifest,
  onProgress: (fraction: number | null) => void,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  const target = `${FileSystem.cacheDirectory}admin-lite-${manifest.version_code}.apk`;
  // Drop any stale partial download first.
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    /* ignore */
  }

  onProgress(0);
  const downloader = FileSystem.createDownloadResumable(
    manifest.apk_url,
    target,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    },
  );

  let uri: string;
  try {
    const result = await downloader.downloadAsync();
    if (!result?.uri) throw new Error('Download failed');
    uri = result.uri;
    await verifyChecksum(uri, manifest.sha256);
  } catch (e) {
    try {
      await FileSystem.deleteAsync(target, { idempotent: true });
    } catch {
      /* ignore */
    }
    onProgress(null);
    throw e;
  }
  onProgress(null);

  await installApk(uri);
}

async function verifyChecksum(uri: string, expected: string): Promise<void> {
  // Skip when no real hash is published (matches the partner placeholder convention).
  if (!expected || expected.startsWith('00000')) return;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToBytes(base64);
  const hashBuf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
  const actual = bufferToHex(hashBuf);
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    throw new Error('APK checksum mismatch');
  }
}

async function installApk(fileUri: string): Promise<void> {
  // Expo's bundled FileProvider hands the cached file out as a content:// URI.
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } catch {
    // No installer activity / blocked — point the user at the unknown-sources toggle.
    await openInstallSettings();
    throw new InstallPermissionRequired();
  }
}

/** Open the system "install unknown apps" settings page for this app. */
export async function openInstallSettings(): Promise<void> {
  const pkg = Application.applicationId ?? '';
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
      { data: `package:${pkg}` },
    );
  } catch {
    /* ignore */
  }
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = (globalThis as { atob?: (s: string) => string }).atob!(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bufferToHex(buf: ArrayBuffer): string {
  const view = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, '0');
  }
  return hex;
}
