/// Release manifest served by the backend's `GET /api/admin-lite/version`.
/// Mirrors the SquadHub partner app's manifest shape exactly.
export interface VersionManifest {
  version_code: number;
  version_name: string;
  apk_url: string;
  sha256: string;
  release_notes: string;
  force_update: boolean;
  min_supported_version_code: number;
}
