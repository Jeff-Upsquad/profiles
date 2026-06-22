import '../models/version_manifest.dart';
import 'api_client.dart';

/// Fetches the release manifest from the public `GET /api/talent-app/version`
/// endpoint. The endpoint needs no auth; we reuse [ApiClient]'s Dio so the
/// base URL + timeouts are shared (the auth interceptor only *adds* a token
/// when one is present, so this works pre-login too).
class UpdateService {
  final ApiClient _client;
  UpdateService(this._client);

  /// Returns the parsed manifest, or null on any transport/shape error
  /// (caller treats null as "no update available").
  Future<VersionManifest?> fetchManifest() async {
    final response = await _client.dio.get('/talent-app/version');
    final data = response.data;
    if (data is Map && data['success'] == true && data['data'] is Map) {
      return VersionManifest.fromJson(Map<String, dynamic>.from(data['data'] as Map));
    }
    return null;
  }
}
