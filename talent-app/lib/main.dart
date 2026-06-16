import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'services/notification_service.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Runs in a separate isolate when the app is backgrounded or terminated.
  await Firebase.initializeApp();
  // When the message carries a `notification` payload, Android draws it itself
  // in this state — drawing our own too would double it. Only render manually
  // for data-only messages (where the OS shows nothing).
  if (message.notification == null) {
    await showLocalNotification(message);
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  } catch (e) {
    debugPrint('[push] Firebase init failed: $e');
  }

  runApp(const ProviderScope(child: TalentApp()));
}
