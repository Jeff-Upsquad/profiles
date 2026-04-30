import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/router.dart';
import 'core/constants.dart';
import 'core/theme.dart';
import 'providers/providers.dart';

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

    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus != AuthorizationStatus.authorized) return;

    final token = await messaging.getToken();
    if (token != null) {
      _registerToken(token);
    }

    messaging.onTokenRefresh.listen(_registerToken);

    FirebaseMessaging.onMessage.listen((message) {
      ref.invalidate(pendingCardsProvider);
      ref.invalidate(respondedCardsProvider);
      ref.invalidate(unreadCountProvider);
    });

    FirebaseMessaging.onMessageOpenedApp.listen((_) {
      ref.invalidate(pendingCardsProvider);
      ref.invalidate(unreadCountProvider);
    });

    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      ref.invalidate(pendingCardsProvider);
      ref.invalidate(unreadCountProvider);
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
