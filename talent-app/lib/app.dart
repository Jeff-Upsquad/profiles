import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/router.dart';
import 'core/constants.dart';
import 'core/theme.dart';
import 'providers/providers.dart';
import 'services/notification_service.dart';

class TalentApp extends ConsumerStatefulWidget {
  const TalentApp({super.key});

  @override
  ConsumerState<TalentApp> createState() => _TalentAppState();
}

class _TalentAppState extends ConsumerState<TalentApp> {
  @override
  void initState() {
    super.initState();
    _setupPushNotifications();
    _setupSessionExpiry();
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
      _registerToken(token);
    }

    messaging.onTokenRefresh.listen(_registerToken);

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

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(unreadCountProvider);
    }

    // Cold-start via a tapped local notification (terminated → launched).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final route = consumeLaunchRoute();
      if (route != null) _handleRoute(route);
    });
  }

  void _handleRoute(String route) {
    if (!mounted) return;
    // Only navigate to real in-app tabs; the router redirects to /login if the
    // session isn't authenticated yet.
    if (route == '/pending' || route == '/responded') {
      ref.read(routerProvider).go(route);
    }
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
    );
  }
}
