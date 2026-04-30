import '../models/subscription_card.dart';
import 'api_client.dart';

class SubscriptionService {
  final ApiClient _client;

  SubscriptionService(this._client);

  Future<List<SubscriptionCardRecipient>> list({String status = 'pending'}) async {
    final response = await _client.dio.get(
      '/talent/subscriptions',
      queryParameters: {'status': status},
    );
    final data = response.data as Map<String, dynamic>;
    final items = data['items'] as List<dynamic>;
    return items
        .map((e) => SubscriptionCardRecipient.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<int> getUnreadCount() async {
    final response = await _client.dio.get('/talent/subscriptions/unread-count');
    final data = response.data as Map<String, dynamic>;
    return data['count'] as int;
  }

  Future<void> respond(String recipientId, String action) async {
    await _client.dio.patch(
      '/talent/subscriptions/$recipientId/respond',
      data: {'action': action},
    );
  }
}
