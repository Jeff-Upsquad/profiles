import 'dart:io';
import 'package:package_info_plus/package_info_plus.dart';
import 'api_client.dart';

/// Reports the installed app build to the backend on launch so the admin panel
/// can track who has the talent app and which version they currently run.
class AppInstallService {
  final ApiClient _client;
  AppInstallService(this._client);

  Future<void> checkin() async {
    final info = await PackageInfo.fromPlatform();
    final platform = Platform.isIOS ? 'ios' : 'android';
    await _client.dio.post('/talent/app-checkin', data: {
      'version_name': info.version,
      'version_code': int.tryParse(info.buildNumber) ?? 0,
      'platform': platform,
    });
  }
}
