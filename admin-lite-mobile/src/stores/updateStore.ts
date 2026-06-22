import { create } from 'zustand';
import { Platform } from 'react-native';
import { fetchVersionManifest } from '../services/updateService';
import {
  currentVersionCode,
  downloadAndInstall,
  InstallPermissionRequired,
} from '../services/updater';
import type { VersionManifest } from '../services/version';

/**
 * Drives the in-app update prompt (mirrors the partner app's UpdateManager +
 * UpdateViewModel). `progress` is null while idle, 0..1 while downloading.
 */
interface UpdateState {
  manifest: VersionManifest | null;
  isForce: boolean;
  progress: number | null;
  downloading: boolean;
  error: string | null;
  dismissedVersion: number | null;
  check: () => Promise<void>;
  onUpdate: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  manifest: null,
  isForce: false,
  progress: null,
  downloading: false,
  error: null,
  dismissedVersion: null,

  async check() {
    if (Platform.OS !== 'android') return; // APK sideload updater is Android-only.
    let manifest: VersionManifest | null = null;
    try {
      manifest = await fetchVersionManifest();
    } catch {
      return;
    }
    if (!manifest) return;

    const current = currentVersionCode();
    if (manifest.version_code <= current || !manifest.apk_url) {
      set({ manifest: null, isForce: false });
      return;
    }
    const isForce =
      manifest.force_update || current < manifest.min_supported_version_code;
    // A dismissed optional update stays hidden until it's superseded or forced.
    if (!isForce && manifest.version_code === get().dismissedVersion) return;
    set({ manifest, isForce });
  },

  dismiss() {
    const { manifest, isForce, downloading } = get();
    if (!manifest || isForce || downloading) return;
    set({ dismissedVersion: manifest.version_code, manifest: null });
  },

  async onUpdate() {
    const { manifest, downloading } = get();
    if (!manifest || downloading) return;
    set({ downloading: true, progress: 0, error: null });
    try {
      await downloadAndInstall(manifest, (frac) => set({ progress: frac }));
      set({ downloading: false });
    } catch (e) {
      const err = e as Error;
      const msg =
        err instanceof InstallPermissionRequired
          ? err.message
          : `Update failed: ${err?.message ?? 'unknown error'}`;
      set({ downloading: false, error: msg });
    }
  },
}));
