import '../core/json.dart';
import '../models/my_clients.dart';
import 'api_client.dart';

/// "My Clients" — active/selected retainers under `/api/talent/subscriptions`.
class MyClientsService {
  final ApiClient _client;
  MyClientsService(this._client);

  Future<MyClientsData> get() async {
    final r = await _client.dio.get('/talent/subscriptions/my-clients');
    return MyClientsData.fromJson(asObject(r.data));
  }
}
