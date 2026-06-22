import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/router.dart';
import 'core/constants.dart';
import 'core/theme.dart';
import 'features/update/update_gate.dart';
import 'providers/providers.dart';
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
        _flushPendingRoute();
      }
    });
  }

  void _setupSessionExpiry() {
    final apiClient = ref.read(apiClientProvider);
    apiClient.onSessionExpired = () {
      ref.read(authProvider.notifier).logout();
    };
  }

  Future<void> _setupPushNotifications() async {
    final messaging = FirebaseMessaging.instance;

    // Set up local-notification rendering + tap routing first. We do NOT bail
    // out if the user declines the prompt: FCM data messages still arrive (so
    // in-app refresh keeps working), the user just won't see banners until they
    // enable notifications in system settings.
    await initNotifications(onTap: _handleRoute);
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
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(unreadCountProvider);
    });

    // A tap that resumes the app from background (FCM notification-type path).
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(unreadCountProvider);
      final route = message.data['route']?.toString();
      if (route != null && route.isNotEmpty) _handleRoute(route);
    });

    // Cold-start via a tapped FCM notification (app was terminated).
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(unreadCountProvider);
      final route = initialMessage.data['route']?.toString();
      if (route != null && route.isNotEmpty) _handleRoute(route);
    }

    // Cold-start via a tapped local notification (terminated → launched).
    final launchRoute = consumeLaunchRoute();
    if (launchRoute != null) _handleRoute(launchRoute);
  }

  /// Navigate to a notification's route, or defer it until the session is
  /// authenticated (cold start). The auth listener calls [_flushPendingRoute].
  void _handleRoute(String route) {
    if (route != '/pending' && route != '/responded') return;
    final authed = ref.read(authProvider).status == AuthStatus.authenticated;
    if (authed) {
      _pendingRoute = null;
      if (mounted) ref.read(routerProvider).go(route);
    } else {
      _pendingRoute = route;
    }
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
