/// Release manifest served by the backend's `GET /api/talent-app/version`.
/// Mirrors the SquadHub partner app's manifest shape exactly so the in-app
/// updater can compare the installed build against the latest release.
class VersionManifest {
  final int versionCode;
  final String versionName;
  final String apkUrl;
  final String sha256;
  final String releaseNotes;
  final bool forceUpdate;
  final int minSupportedVersionCode;

  const VersionManifest({
    required this.versionCode,
    required this.versionName,
    required this.apkUrl,
    required this.sha256,
    required this.releaseNotes,
    required this.forceUpdate,
    required this.minSupportedVersionCode,
  });

  factory VersionManifest.fromJson(Map<String, dynamic> json) {
    return VersionManifest(
      versionCode: (json['version_code'] as num?)?.toInt() ?? 0,
      versionName: json['version_name']?.toString() ?? '',
      apkUrl: json['apk_url']?.toString() ?? '',
      sha256: json['sha256']?.toString() ?? '',
      releaseNotes: json['release_notes']?.toString() ?? '',
      forceUpdate: json['force_update'] == true,
      minSupportedVersionCode:
          (json['min_supported_version_code'] as num?)?.toInt() ?? 1,
    );
  }
}
