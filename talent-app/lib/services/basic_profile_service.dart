import '../core/json.dart';
import '../models/basic_profile.dart';
import 'api_client.dart';

/// Basic Profile — `/talent/me/basic-profile` (GET returns the row or null).
class BasicProfileService {
  final ApiClient _client;
  BasicProfileService(this._client);

  Future<BasicProfile> get() async {
    final response = await _client.dio.get('/talent/me/basic-profile');
    return BasicProfile.fromJson(
        response.data is Map ? asObject(response.data) : null);
  }

  Future<BasicProfile> update(BasicProfile profile) async {
    final response =
        await _client.dio.put('/talent/me/basic-profile', data: profile.toJson());
    return BasicProfile.fromJson(
        response.data is Map ? asObject(response.data) : null);
  }
}
