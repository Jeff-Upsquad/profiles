import '../core/json.dart';

/// In-app notification. Mirrors the web `Notification` shape in
/// TalentNotifications.tsx. `id` is the recipient-row id used for mark-read.

class NotificationMedia {
  final String type; // image | pdf | loom
  final String url;
  final String? name;

  const NotificationMedia({required this.type, required this.url, this.name});

  factory NotificationMedia.fromJson(Map<String, dynamic> json) =>
      NotificationMedia(
        type: asString(json['type']) ?? 'image',
        url: asString(json['url']) ?? '',
        name: asString(json['name']),
      );

  bool get isImage => type == 'image';
  bool get isPdf => type == 'pdf';
  bool get isLoom => type == 'loom';
}

class NotificationItem {
  final String id;
  final String? notificationId;
  final String kind; // broadcast | system
  final String? systemType;
  final String title;
  final String? body;
  final List<NotificationMedia> media;
  final String? linkUrl;
  final bool read;
  final String? readAt;
  final String? createdAt;

  const NotificationItem({
    required this.id,
    this.notificationId,
    this.kind = 'system',
    this.systemType,
    required this.title,
    this.body,
    this.media = const [],
    this.linkUrl,
    this.read = false,
    this.readAt,
    this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) =>
      NotificationItem(
        id: json['id'] as String,
        notificationId: asString(json['notification_id']),
        kind: asString(json['kind']) ?? 'system',
        systemType: asString(json['system_type']),
        title: asString(json['title']) ?? '',
        body: asString(json['body']),
        media: asObjectList(json['media']).map(NotificationMedia.fromJson).toList(),
        linkUrl: asString(json['link_url']),
        read: asBool(json['read']),
        readAt: asString(json['read_at']),
        createdAt: asString(json['created_at']),
      );

  bool get isClickable => (linkUrl ?? '').isNotEmpty;
}
