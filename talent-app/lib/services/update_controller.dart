import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import '../models/version_manifest.dart';
import '../providers/providers.dart';
import 'update_service.dart';

/// An available update + whether it must be installed before continuing.
class UpdateInfo {
  final VersionManifest manifest;
  final bool isForce;
  const UpdateInfo(this.manifest, this.isForce);
}

/// Drives the in-app update prompt (mirrors the partner app's UpdateManager +
/// UpdateViewModel). [progress] is null while idle, 0..1 while downloading.
class UpdateState {
  final UpdateInfo? info;
  final double? progress;
  final bool downloading;
  final String? error;

  const UpdateState({
    this.info,
    this.progress,
    this.downloading = false,
    this.error,
  });
}

/// Raised when the OS won't let us install until the user allows this source.
class _InstallPermissionRequired implements Exception {
  final String message;
  const _InstallPermissionRequired(this.message);
}

const MethodChannel _installer = MethodChannel('talent_app/updater');

/// Sideloaded in-app updater (mirrors the SquadHub partner app). Polls
/// GET /talent-app/version, compares the manifest's versionCode against the
/// installed build, and — when a newer build exists — exposes it via [state] so
/// the UI can prompt. On confirm, downloads the APK to the cache with progress,
/// verifies its sha256, and hands it to the system package installer.
///
/// Android-only and self-contained: no Play Services, no Play Store dependency.
class UpdateController extends Notifier<UpdateState> {
  int? _dismissedVersion;
  int _currentVersionCode = 0;

  @override
  UpdateState build() => const UpdateState();

  Future<int> _currentCode() async {
    if (_currentVersionCode > 0) return _currentVersionCode;
    try {
      final info = await PackageInfo.fromPlatform();
      _currentVersionCode = int.tryParse(info.buildNumber) ?? 0;
    } catch (_) {
      _currentVersionCode = 0;
    }
    return _currentVersionCode;
  }

  /// Fetch the manifest and publish [state] if a newer build is available.
  Future<void> check() async {
    if (!Platform.isAndroid) return; // APK sideload updater is Android-only.
    final service = ref.read(updateServiceProvider);
    VersionManifest? manifest;
    try {
      manifest = await service.fetchManifest();
    } catch (_) {
      return;
    }
    if (manifest == null) return;

    final current = await _currentCode();
    if (manifest.versionCode <= current || manifest.apkUrl.isEmpty) {
      state = const UpdateState();
      return;
    }
    final isForce =
        manifest.forceUpdate || current < manifest.minSupportedVersionCode;
    // A dismissed optional update stays hidden until it's superseded or forced.
    if (!isForce && manifest.versionCode == _dismissedVersion) return;
    state = UpdateState(info: UpdateInfo(manifest, isForce));
  }

  /// Hide an optional update for this session (no-op for forced/downloading).
  void dismiss() {
    final info = state.info;
    if (info == null || info.isForce || state.downloading) return;
    _dismissedVersion = info.manifest.versionCode;
    state = const UpdateState();
  }

  /// Download [manifest]'s APK with progress, verify its checksum, and launch
  /// the system installer.
  Future<void> onUpdate(VersionManifest manifest) async {
    if (state.downloading) return;
    state = UpdateState(info: state.info, downloading: true, progress: 0);
    try {
      await _downloadAndInstall(manifest);
      state = UpdateState(info: state.info, downloading: false);
    } on _InstallPermissionRequired catch (e) {
      state = UpdateState(info: state.info, downloading: false, error: e.message);
    } catch (e) {
      state = UpdateState(
          info: state.info, downloading: false, error: 'Update failed: $e');
    }
  }

  Future<void> _downloadAndInstall(VersionManifest manifest) async {
    final canInstall = await _installer.invokeMethod<bool>('canInstall') ?? false;
    if (!canInstall) {
      await _installer.invokeMethod('openInstallSettings');
      throw const _InstallPermissionRequired(
          'Allow installs from this app, then tap Update again.');
    }

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/talent-app-${manifest.versionCode}.apk');
    try {
      await Dio().download(
        manifest.apkUrl,
        file.path,
        onReceiveProgress: (received, total) {
          if (total > 0) {
            state = UpdateState(
                info: state.info, downloading: true, progress: received / total);
          }
        },
      );
      await _verifyChecksum(file, manifest.sha256);
    } catch (e) {
      try {
        await file.delete();
      } catch (_) {}
      rethrow;
    }
    await _installer.invokeMethod('install', {'path': file.path});
  }

  Future<void> _verifyChecksum(File file, String expected) async {
    // Skip when no real hash is published (matches the partner placeholder convention).
    if (expected.isEmpty || expected.startsWith('00000')) return;
    final digest = await sha256.bind(file.openRead()).first;
    if (digest.toString().toLowerCase() != expected.toLowerCase()) {
      throw Exception('APK checksum mismatch');
    }
  }
}

final updateServiceProvider =
    Provider<UpdateService>((ref) => UpdateService(ref.watch(apiClientProvider)));

final updateControllerProvider =
    NotifierProvider<UpdateController, UpdateState>(UpdateController.new);
