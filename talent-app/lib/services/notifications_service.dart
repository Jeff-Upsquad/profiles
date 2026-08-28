import '../core/json.dart';
import '../models/notification_item.dart';
import 'api_client.dart';

/// In-app notifications — `/api/talent/notifications`.
class NotificationsService {
  final ApiClient _client;
  NotificationsService(this._client);

  Future<List<NotificationItem>> list({String prefix = '/talent'}) async {
    final r = await _client.dio.get('$prefix/notifications');
    final data = r.data;
    final raw = data is Map ? data['notifications'] ?? data : data;
    return asObjectList(raw).map(NotificationItem.fromJson).toList();
  }

  Future<int> unreadCount({String prefix = '/talent'}) async {
    final r = await _client.dio.get('$prefix/notifications/unread-count');
    return asInt(asObject(r.data)['unread']) ?? asInt(asObject(r.data)['count']) ?? 0;
  }

  Future<void> markRead(String id, {String prefix = '/talent'}) async {
    await _client.dio.post('$prefix/notifications/$id/read');
  }

  Future<void> markAllRead({String prefix = '/talent'}) async {
    await _client.dio.post('$prefix/notifications/mark-all-read');
  }
}
