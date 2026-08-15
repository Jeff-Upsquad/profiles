import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/providers.dart';
import '../models/subscription_card.dart';
import '../features/auth/splash_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/home/home_screen.dart';
import '../features/jobs/jobs_screen.dart';
import '../features/jobs/job_detail_screen.dart';
import '../features/jobs/job_profile_screen.dart';
import '../features/jobs/interviews/interviews_screen.dart';
import '../features/jobs/interviews/interview_detail_screen.dart';
import '../features/jobs/offers/offers_screen.dart';
import '../features/jobs/offers/offer_detail_screen.dart';
import '../features/offers/offers_inbox_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/messages/messages_inbox_screen.dart';
import '../features/messages/conversation_screen.dart';
import '../features/clients/my_clients_screen.dart';
import '../features/training/training_screen.dart';
import '../features/profile/basic_profile_screen.dart';
import '../features/profile/profiles_list_screen.dart';
import '../features/profile/profile_create_screen.dart';
import '../features/profile/profile_edit_screen.dart';
import '../features/more/more_screen.dart';
import '../features/more/contact_support_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/settings/change_password_screen.dart';
import '../features/subscriptions/subscription_detail_screen.dart';
import '../widgets/app_bottom_nav.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();

/// Bridges Riverpod's auth state into a Listenable that GoRouter can subscribe
/// to via refreshListenable, so redirects re-evaluate on auth changes.
class _RouterRefreshNotifier extends ChangeNotifier {
  _RouterRefreshNotifier(Ref ref) {
    ref.listen(authProvider, (_, _) => notifyListeners());
  }
}

/// A full-screen route stacked above the tab shell.
GoRoute _rootRoute(String path, Widget Function(GoRouterState) build) {
  return GoRoute(
    path: path,
    parentNavigatorKey: _rootNavigatorKey,
    builder: (_, state) => build(state),
  );
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _RouterRefreshNotifier(ref);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final authState = ref.read(authProvider);
      final isAuth = authState.status == AuthStatus.authenticated;
      final isSplash = state.matchedLocation == '/splash';
      final isLogin = state.matchedLocation == '/login';

      if (authState.status == AuthStatus.unknown) return null;
      if (!isAuth && !isSplash && !isLogin) return '/login';
      if (!isAuth && isSplash) return '/login';
      if (isAuth && (isSplash || isLogin)) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, _) => const LoginScreen()),

      // Full-screen detail routes (stacked over the shell).
      _rootRoute('/job/:recipientId',
          (s) => JobDetailScreen(recipientId: s.pathParameters['recipientId']!)),
      _rootRoute('/job-profile/:jobProfileId',
          (s) => JobProfileScreen(jobProfileId: s.pathParameters['jobProfileId']!)),
      _rootRoute('/interview/:inviteId',
          (s) => InterviewDetailScreen(inviteId: s.pathParameters['inviteId']!)),
      _rootRoute('/offer/:offerId',
          (s) => OfferDetailScreen(offerId: s.pathParameters['offerId']!)),
      _rootRoute('/interviews', (_) => const InterviewsScreen()),
      _rootRoute('/job-offers', (_) => const OffersScreen()),
      _rootRoute('/more/my-clients', (_) => const MyClientsScreen()),
      _rootRoute('/more/settings', (_) => const SettingsScreen()),
      _rootRoute('/more/change-password', (_) => const ChangePasswordScreen()),
      _rootRoute('/more/contact-support', (_) => const ContactSupportScreen()),
      _rootRoute('/basic-profile', (_) => const BasicProfileScreen()),
      _rootRoute('/more/profiles', (_) => const ProfilesListScreen()),
      _rootRoute('/more/profiles/new', (_) => const ProfileCreateScreen()),
      _rootRoute('/more/profiles/edit/:id',
          (s) => ProfileEditScreen(profileId: s.pathParameters['id']!)),
      _rootRoute('/more/training', (_) => const TrainingScreen()),
      _rootRoute('/messages', (_) => const MessagesInboxScreen()),
      _rootRoute('/messages/:id',
          (s) => ConversationScreen(conversationId: s.pathParameters['id']!)),
      _rootRoute('/subscription-detail', (state) {
        final recipient = state.extra as SubscriptionCardRecipient?;
        if (recipient == null) {
          return const Scaffold(body: Center(child: Text('Offer details unavailable')));
        }
        return SubscriptionDetailScreen(recipient: recipient);
      }),

      // The tab shell.
      StatefulShellRoute.indexedStack(
        builder: (_, _, navigationShell) =>
            AppBottomNav(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (_, _) => const HomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/jobs', builder: (_, _) => const JobsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/offers', builder: (_, _) => const OffersInboxScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
                path: '/notifications',
                builder: (_, _) => const NotificationsScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/more', builder: (_, _) => const MoreScreen()),
          ]),
        ],
      ),
    ],
  );
});
