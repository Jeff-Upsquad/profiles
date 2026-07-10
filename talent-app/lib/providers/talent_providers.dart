import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/my_clients.dart';
import '../models/notification_item.dart';
import '../models/onboarding_progress.dart';
import '../models/profile_extras.dart';
import '../models/talent_profile.dart';
import '../models/training.dart';
import '../services/basic_profile_service.dart';
import '../services/dashboard_service.dart';
import '../services/my_clients_service.dart';
import '../services/notifications_service.dart';
import '../services/profiles_service.dart';
import '../services/training_service.dart';
import '../services/upload_service.dart';
import 'providers.dart';

// ─── Services ────────────────────────────────────────────────────────────────

final notificationsServiceProvider =
    Provider((ref) => NotificationsService(ref.watch(apiClientProvider)));
final profilesServiceProvider =
    Provider((ref) => ProfilesService(ref.watch(apiClientProvider)));
final dashboardServiceProvider =
    Provider((ref) => DashboardService(ref.watch(apiClientProvider)));
final myClientsServiceProvider =
    Provider((ref) => MyClientsService(ref.watch(apiClientProvider)));
final uploadServiceProvider =
    Provider((ref) => UploadService(ref.watch(apiClientProvider)));
final basicProfileServiceProvider =
    Provider((ref) => BasicProfileService(ref.watch(apiClientProvider)));
final trainingServiceProvider =
    Provider((ref) => TrainingService(ref.watch(apiClientProvider)));

// ─── Notifications ───────────────────────────────────────────────────────────

final notificationsProvider =
    FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  return ref.watch(notificationsServiceProvider).list();
});

final unreadNotificationsProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(notificationsServiceProvider).unreadCount();
});

// ─── Dashboard / profiles / clients ──────────────────────────────────────────

final onboardingProgressProvider =
    FutureProvider.autoDispose<OnboardingProgress>((ref) async {
  return ref.watch(dashboardServiceProvider).onboardingProgress();
});

final myProfilesProvider =
    FutureProvider.autoDispose<List<TalentProfile>>((ref) async {
  return ref.watch(profilesServiceProvider).list();
});

final profileDetailProvider =
    FutureProvider.autoDispose.family<TalentProfile, String>((ref, id) async {
  return ref.watch(profilesServiceProvider).get(id);
});

final creatableCategoriesProvider =
    FutureProvider.autoDispose<List<ProfileCategory>>((ref) async {
  return ref.watch(profilesServiceProvider).creatableCategories();
});

final portfolioProvider = FutureProvider.autoDispose
    .family<List<PortfolioItem>, String>((ref, profileId) async {
  return ref.watch(profilesServiceProvider).portfolio(profileId);
});

final myClientsProvider = FutureProvider.autoDispose<MyClientsData>((ref) async {
  return ref.watch(myClientsServiceProvider).get();
});

// ─── Training ────────────────────────────────────────────────────────────────

final myTrainingProvider = FutureProvider.autoDispose<MyTraining>((ref) async {
  return ref.watch(trainingServiceProvider).getMyTraining();
});

final moduleAccessProvider = FutureProvider.autoDispose<ModuleAccess>((ref) async {
  return ref.watch(trainingServiceProvider).moduleAccess();
});
