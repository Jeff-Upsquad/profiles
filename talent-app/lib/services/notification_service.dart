import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Renders FCM messages as visible local notifications.
///
/// The backend sends **data-only** FCM messages (no `notification` block), so
/// Android never shows a tray notification on its own — the client must do it.
/// We surface them via `flutter_local_notifications` in every app state:
///   • foreground  → [showLocalNotification] from `onMessage`
///   • background  → [showLocalNotification] from the background isolate handler
///   • terminated  → background isolate shows it; the tap cold-starts the app
///                   and [consumeLaunchRoute] picks up the route.
///
/// Tapping a notification routes to `data['route']` (e.g. `/home`).

const String _channelId = 'subscription_offers';
const String _channelName = 'Offers & Updates';
const String _channelDesc = 'New opportunities and assignment updates';

const AndroidNotificationChannel _channel = AndroidNotificationChannel(
  _channelId,
  _channelName,
  description: _channelDesc,
  importance: Importance.high,
);

final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();

bool _initialized = false;
void Function(String route)? _onTap;

/// Route captured when the app is cold-started by tapping a notification.
String? _pendingLaunchRoute;

Future<void> _ensureInitialized() async {
  if (_initialized) return;
  const androidInit = AndroidInitializationSettings('ic_stat_notify');
  await _plugin.initialize(
    settings: const InitializationSettings(android: androidInit),
    onDidReceiveNotificationResponse: (response) {
      final route = response.payload;
      if (route != null && route.isNotEmpty) _onTap?.call(route);
    },
  );
  await _plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(_channel);
  _initialized = true;
}

/// Call once from the main isolate at startup. Wires the tap handler, creates
/// the channel, requests the Android 13+ runtime permission, and records a
/// cold-start launch route if the app was opened from a notification.
Future<void> initNotifications({
  required void Function(String route) onTap,
}) async {
  _onTap = onTap;
  await _ensureInitialized();

  await _plugin
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
      ?.requestNotificationsPermission();

  final launch = await _plugin.getNotificationAppLaunchDetails();
  if (launch?.didNotificationLaunchApp == true) {
    final route = launch!.notificationResponse?.payload;
    if (route != null && route.isNotEmpty) _pendingLaunchRoute = route;
  }
}

/// Returns (once) the route the app was cold-started with via a notification tap.
String? consumeLaunchRoute() {
  final route = _pendingLaunchRoute;
  _pendingLaunchRoute = null;
  return route;
}

/// Displays a notification for an incoming FCM message. Safe to call from the
/// background isolate — it self-initializes the plugin and channel there.
Future<void> showLocalNotification(RemoteMessage message) async {
  await _ensureInitialized();

  final data = message.data;
  final title = (data['title']?.toString().trim().isNotEmpty ?? false)
      ? data['title'].toString()
      : (message.notification?.title ?? 'SquadHire');
  final body = (data['body']?.toString().trim().isNotEmpty ?? false)
      ? data['body'].toString()
      : (message.notification?.body ?? '');
  final route = (data['route']?.toString().trim().isNotEmpty ?? false)
      ? data['route'].toString()
      : '/home';

  final id = message.messageId?.hashCode ??
      DateTime.now().millisecondsSinceEpoch.remainder(1 << 31);

  try {
    await _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          _channelName,
          channelDescription: _channelDesc,
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_stat_notify',
        ),
      ),
      payload: route,
    );
  } catch (e) {
    debugPrint('[push] show notification failed: $e');
  }
}
