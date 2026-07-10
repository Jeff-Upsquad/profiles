import '../core/json.dart';
import '../models/notification_item.dart';
import 'api_client.dart';

/// In-app notifications — `/api/talent/notifications`.
class NotificationsService {
  final ApiClient _client;
  NotificationsService(this._client);

  Future<List<NotificationItem>> list() async {
    final r = await _client.dio.get('/talent/notifications');
    final data = r.data;
    final raw = data is Map ? data['notifications'] ?? data : data;
    return asObjectList(raw).map(NotificationItem.fromJson).toList();
  }

  Future<int> unreadCount() async {
    final r = await _client.dio.get('/talent/notifications/unread-count');
    return asInt(asObject(r.data)['unread']) ?? 0;
  }

  Future<void> markRead(String id) async {
    await _client.dio.post('/talent/notifications/$id/read');
  }

  Future<void> markAllRead() async {
    await _client.dio.post('/talent/notifications/mark-all-read');
  }
}
