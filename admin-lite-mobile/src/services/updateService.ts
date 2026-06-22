import api from './api';
import type { VersionManifest } from './version';

/**
 * Fetch the release manifest from the public `GET /api/admin-lite/version`
 * endpoint. Returns null on any transport/shape error (caller treats null as
 * "no update available"). Reuses the shared axios client for base URL/timeout.
 */
export async function fetchVersionManifest(): Promise<VersionManifest | null> {
  const { data } = await api.get('/admin-lite/version');
  if (data && data.success && data.data) {
    return data.data as VersionManifest;
  }
  return null;
}
