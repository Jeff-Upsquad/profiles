import 'api_client.dart';

class PushService {
  final ApiClient _client;

  PushService(this._client);

  Future<void> registerToken(String token, String platform) async {
    await _client.dio.post('/talent/push/register', data: {
      'token': token,
      'platform': platform,
    });
  }

  Future<void> unregisterToken(String token) async {
    await _client.dio.post('/talent/push/unregister', data: {
      'token': token,
    });
  }
}
