import '../models/talent_me.dart';
import 'api_client.dart';

class TalentService {
  final ApiClient _client;

  TalentService(this._client);

  Future<TalentMe> getMe() async {
    final response = await _client.dio.get('/talent/me');
    return TalentMe.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TalentMe> setWhatsappUpdates(bool enabled) async {
    final response = await _client.dio.put(
      '/talent/me',
      data: {'whatsapp_subscription_updates_enabled': enabled},
    );
    return TalentMe.fromJson(response.data as Map<String, dynamic>);
  }
}
