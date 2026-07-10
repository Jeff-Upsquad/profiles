import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/interview.dart';
import '../models/job_card.dart';
import '../models/job_offer.dart';
import '../models/job_preferences.dart';
import '../models/job_profile_view.dart';
import '../services/interviews_service.dart';
import '../services/jobs_service.dart';
import '../services/offers_service.dart';
import 'providers.dart';

// ─── Services ────────────────────────────────────────────────────────────────

final jobsServiceProvider =
    Provider((ref) => JobsService(ref.watch(apiClientProvider)));
final interviewsServiceProvider =
    Provider((ref) => InterviewsService(ref.watch(apiClientProvider)));
final offersServiceProvider =
    Provider((ref) => OffersService(ref.watch(apiClientProvider)));

// ─── Opt-in & preferences ────────────────────────────────────────────────────

final jobOptInProvider = FutureProvider.autoDispose<JobPreferences>((ref) async {
  return ref.watch(jobsServiceProvider).getOptIn();
});

// ─── Feed ────────────────────────────────────────────────────────────────────

/// Feed for a funnel tab (keyed by `kJobsTabs` key). Each tab caches its own list.
final jobsFeedProvider = FutureProvider.autoDispose
    .family<List<TalentJobFeedItem>, String>((ref, tab) async {
  return ref.watch(jobsServiceProvider).feed(tab);
});

final jobsCountsProvider =
    FutureProvider.autoDispose<Map<String, int>>((ref) async {
  return ref.watch(jobsServiceProvider).counts();
});

final jobsUnreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(jobsServiceProvider).unreadCount();
});

final jobDetailProvider = FutureProvider.autoDispose
    .family<TalentJobDetail, String>((ref, recipientId) async {
  return ref.watch(jobsServiceProvider).detail(recipientId);
});

final jobProfileViewProvider = FutureProvider.autoDispose
    .family<JobProfileView, String>((ref, jobProfileId) async {
  return ref.watch(jobsServiceProvider).profileView(jobProfileId);
});

/// Invalidate every jobs-related provider (after a respond/withdraw/reapply),
/// mirroring the web's `invalidateQueries(['jobs'])`.
void invalidateJobs(WidgetRef ref) {
  ref.invalidate(jobsFeedProvider);
  ref.invalidate(jobsCountsProvider);
  ref.invalidate(jobsUnreadCountProvider);
  ref.invalidate(jobDetailProvider);
  ref.invalidate(jobProfileViewProvider);
}

// ─── Interviews ──────────────────────────────────────────────────────────────

final interviewInvitesProvider =
    FutureProvider.autoDispose<List<TalentInviteItem>>((ref) async {
  return ref.watch(interviewsServiceProvider).invites();
});

/// Live queue for an invite — fetches immediately, then re-polls every 20s
/// (matches the web's `useInviteQueue`). Auto-disposes when the panel closes.
final inviteQueueProvider = StreamProvider.autoDispose
    .family<InviteQueueSnapshot, String>((ref, inviteId) async* {
  final svc = ref.watch(interviewsServiceProvider);
  yield await svc.queue(inviteId);
  await for (final _ in Stream<void>.periodic(const Duration(seconds: 20))) {
    yield await svc.queue(inviteId);
  }
});

// ─── Offers ──────────────────────────────────────────────────────────────────

final offersListProvider = FutureProvider.autoDispose<List<JobOffer>>((ref) async {
  return ref.watch(offersServiceProvider).list();
});

final offerDetailProvider =
    FutureProvider.autoDispose.family<OfferDetail, String>((ref, offerId) async {
  return ref.watch(offersServiceProvider).detail(offerId);
});
