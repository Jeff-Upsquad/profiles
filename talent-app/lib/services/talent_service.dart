import '../core/json.dart';
import '../models/language_entry.dart';
import '../models/talent_me.dart';
import 'api_client.dart';

class TalentService {
  final ApiClient _client;

  TalentService(this._client);

  /// `/talent/me` returns either the record flat or wrapped in `talent`.
  TalentMe _parse(dynamic data) {
    final map = asObject(data);
    final info = map['talent'] is Map ? asObject(map['talent']) : map;
    return TalentMe.fromJson(info);
  }

  Future<TalentMe> getMe() async {
    final response = await _client.dio.get('/talent/me');
    return _parse(response.data);
  }

  Future<TalentMe> setWhatsappUpdates(bool enabled) async {
    final response = await _client.dio.put(
      '/talent/me',
      data: {'whatsapp_subscription_updates_enabled': enabled},
    );
    return _parse(response.data);
  }

  /// Update editable account details (Settings).
  Future<TalentMe> updateProfile({
    required String fullName,
    String? phone,
    int? age,
    String? currentLocation,
    String? nativePlace,
    required List<LanguageEntry> languages,
  }) async {
    final response = await _client.dio.put('/talent/me', data: {
      'full_name': fullName,
      'phone': phone ?? '',
      'age': ?age,
      'current_location': currentLocation ?? '',
      'native_place': nativePlace ?? '',
      'languages_spoken':
          languages.where((e) => e.language.isNotEmpty).map((e) => e.toJson()).toList(),
    });
    return _parse(response.data);
  }

  /// Patch arbitrary `/talent/me` fields (e.g. just `full_name` from the Basic
  /// Profile form). Returns the updated record.
  Future<TalentMe> updateFields(Map<String, dynamic> fields) async {
    final response = await _client.dio.put('/talent/me', data: fields);
    return _parse(response.data);
  }
}
