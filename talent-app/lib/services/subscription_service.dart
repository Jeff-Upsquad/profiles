import '../models/subscription_card.dart';
import 'api_client.dart';

class SubscriptionService {
  final ApiClient _client;

  SubscriptionService(this._client);

  Future<List<SubscriptionCardRecipient>> list({
    String status = 'pending',
    String? cardType,
  }) async {
    final response = await _client.dio.get(
      '/talent/subscriptions',
      queryParameters: {
        'status': status,
        'card_type': ?cardType,
      },
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

  /// Bid / counter on a subscription or assignment card (₹500 steps).
  Future<void> submitOffer(
    String recipientId, {
    required int amount,
    String currency = 'INR',
    String period = 'per_month',
    String? note,
  }) async {
    await _client.dio.post(
      '/talent/subscriptions/$recipientId/offer',
      data: {
        'amount': {
          'amount': amount,
          'currency': currency,
          'period': period,
        },
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<List<Map<String, dynamic>>> listOffers() async {
    final response = await _client.dio.get('/talent/subscriptions/offers');
    final data = response.data as Map<String, dynamic>;
    final items = data['offers'] as List<dynamic>? ?? [];
    return items.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
}
