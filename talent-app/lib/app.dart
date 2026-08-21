import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/router.dart';
import 'core/constants.dart';
import 'core/deep_links.dart';
import 'core/launchers.dart';
import 'core/theme.dart';
import 'features/update/update_gate.dart';
import 'providers/providers.dart';
import 'providers/jobs_providers.dart';
import 'providers/talent_providers.dart';
import 'providers/conversations_providers.dart';
import 'services/notification_service.dart';
import 'services/update_controller.dart';

class TalentApp extends ConsumerStatefulWidget {
  const TalentApp({super.key});

  @override
  ConsumerState<TalentApp> createState() => _TalentAppState();
}

class _TalentAppState extends ConsumerState<TalentApp> {
  String? _fcmToken;

  /// A notification's target route captured before the session is ready
  /// (e.g. cold start from a tap). Flushed once the user is authenticated.
  String? _pendingRoute;

  @override
  void initState() {
    super.initState();
    _setupPushNotifications();
    _setupSessionExpiry();

    // Poll the release manifest once at launch; the inline UpdateCard / blocking
    // UpdateGate surface any newer build.
    ref.read(updateControllerProvider.notifier).check();

    // When the user becomes authenticated: register the FCM token (the push
    // setup runs once at startup, before a fresh login completes) and navigate
    // to any route a notification tap was waiting on.
    ref.listenManual(authProvider, (prev, next) {
      if (next.status == AuthStatus.authenticated) {
        if (_fcmToken != null) _registerToken(_fcmToken!);
        _recordAppCheckin();
        _flushPendingRoute();
      }
    });
  }

  /// Report the installed build to the backend so admins can track who has the
  /// app and which version. Fire-and-forget — never blocks or surfaces errors.
  void _recordAppCheckin() {
    ref.read(appInstallServiceProvider).checkin().catchError((Object e) {
      debugPrint('[app-checkin] failed: $e');
    });
  }

  void _setupSessionExpiry() {
    final apiClient = ref.read(apiClientProvider);
    apiClient.onSessionExpired = () {
      ref.read(authProvider.notifier).logout();
    };
  }

  Future<void> _setupPushNotifications() async {
    // Local-notification rendering + tap routing first; works even if FCM is
    // unavailable (e.g. missing iOS Firebase config).
    try {
      await initNotifications(onTap: _handleRoute);
    } catch (e) {
      debugPrint('[push] local notification init failed: $e');
    }

    final FirebaseMessaging messaging;
    try {
      messaging = FirebaseMessaging.instance;
    } catch (e) {
      debugPrint('[push] FCM unavailable: $e');
      return;
    }

    // We do NOT bail out if the user declines the permission prompt: FCM data
    // messages still arrive (so in-app refresh keeps working), the user just
    // won't see banners until they enable notifications in system settings.
    try {
      await messaging.requestPermission();

      final token = await messaging.getToken();
      if (token != null) {
        _fcmToken = token;
        _registerToken(token);
      }

      messaging.onTokenRefresh.listen((t) {
        _fcmToken = t;
        _registerToken(t);
      });

      // Foreground: the OS does not display data-only messages, so render one
      // ourselves, then refresh the lists.
      FirebaseMessaging.onMessage.listen((message) {
        showLocalNotification(message);
        _refreshFeeds();
      });

      // A tap that resumes the app from background (FCM notification-type path).
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        _refreshFeeds();
        final route = message.data['route']?.toString();
        if (route != null && route.isNotEmpty) _handleRoute(route);
      });

      // Cold-start via a tapped FCM notification (app was terminated).
      final initialMessage = await messaging.getInitialMessage();
      if (initialMessage != null) {
        _refreshFeeds();
        final route = initialMessage.data['route']?.toString();
        if (route != null && route.isNotEmpty) _handleRoute(route);
      }
    } catch (e) {
      debugPrint('[push] setup failed: $e');
    }

    // Cold-start via a tapped local notification (terminated → launched).
    try {
      final launchRoute = consumeLaunchRoute();
      if (launchRoute != null) _handleRoute(launchRoute);
    } catch (e) {
      debugPrint('[push] launch route failed: $e');
    }
  }

  /// Refresh every unread badge + feed after a push arrives.
  void _refreshFeeds() {
    ref.invalidate(subscriptionListProvider);
    ref.invalidate(unreadCountProvider);
    ref.invalidate(jobsUnreadCountProvider);
    ref.invalidate(jobsFeedProvider);
    ref.invalidate(jobsCountsProvider);
    ref.invalidate(interviewInvitesProvider);
    ref.invalidate(offersListProvider);
    ref.invalidate(notificationsProvider);
    ref.invalidate(unreadNotificationsProvider);
    ref.invalidate(conversationsListProvider);
    ref.invalidate(conversationsUnreadProvider);
  }

  /// Navigate to a notification's target (a web link_url or an app route), or
  /// defer it until the session is authenticated (cold start). The auth
  /// listener calls [_flushPendingRoute]. Links with no in-app surface
  /// (external https URLs) open in the browser.
  void _handleRoute(String route) {
    final mapped = mapNotificationRoute(route);
    final isExternal = mapped == null && _isExternalLink(route);
    if (mapped == null && !isExternal) return;
    final authed = ref.read(authProvider).status == AuthStatus.authenticated;
    if (!authed) {
      _pendingRoute = route;
      return;
    }
    _pendingRoute = null;
    if (!mounted) return;
    if (isExternal) {
      openExternalUrl(route);
      return;
    }
    final router = ref.read(routerProvider);
    const tabs = {'/home', '/messages', '/notifications', '/more'};
    final isTab = tabs.contains(mapped!) || mapped.startsWith('/home?');
    if (isTab) {
      router.go(mapped);
    } else {
      router.push(mapped);
    }
  }

  /// True for absolute links the app has no internal screen for — broadcasts
  /// can carry arbitrary https URLs, which open in the system browser.
  bool _isExternalLink(String route) {
    final r = route.trim().toLowerCase();
    return r.startsWith('https://') ||
        r.startsWith('http://') ||
        r.startsWith('mailto:') ||
        r.startsWith('tel:');
  }

  void _flushPendingRoute() {
    final route = _pendingRoute;
    if (route != null) _handleRoute(route);
  }

  void _registerToken(String token) {
    final authState = ref.read(authProvider);
    if (authState.status != AuthStatus.authenticated) return;

    final pushService = ref.read(pushServiceProvider);
    final platform = Platform.isIOS ? 'ios' : 'android';
    pushService.registerToken(token, platform).catchError((e) {
      debugPrint('[push] register failed: $e');
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: appName,
      theme: buildAppTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
      // Overlay the forced-update gate above every route.
      builder: (context, child) => Stack(
        children: [
          child ?? const SizedBox.shrink(),
          const Positioned.fill(child: UpdateGate()),
        ],
      ),
    );
  }
}
