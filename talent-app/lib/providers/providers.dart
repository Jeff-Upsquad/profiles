import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/secure_storage.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/password_reset_service.dart';
import '../services/subscription_service.dart';
import '../services/talent_service.dart';
import '../services/agency_service.dart';
import '../services/push_service.dart';
import '../services/app_install_service.dart';
import '../models/auth_response.dart';
import '../models/subscription_card.dart';
import '../models/talent_me.dart';

// ─── Singletons ──────────────────────────────────────────────────────────────

final secureStorageProvider = Provider((_) => SecureStorageService());

final apiClientProvider = Provider((ref) {
  final storage = ref.watch(secureStorageProvider);
  return ApiClient(storage);
});

final authServiceProvider = Provider((ref) {
  return AuthService(ref.watch(apiClientProvider));
});

final passwordResetServiceProvider = Provider((ref) {
  return PasswordResetService(ref.watch(apiClientProvider));
});

final subscriptionServiceProvider = Provider((ref) {
  return SubscriptionService(ref.watch(apiClientProvider));
});

final talentServiceProvider = Provider((ref) {
  return TalentService(ref.watch(apiClientProvider));
});

final pushServiceProvider = Provider((ref) {
  return PushService(ref.watch(apiClientProvider));
});

final appInstallServiceProvider = Provider((ref) {
  return AppInstallService(ref.watch(apiClientProvider));
});

final agencyServiceProvider = Provider((ref) {
  return AgencyService(ref.watch(apiClientProvider));
});

// ─── Auth state ──────────────────────────────────────────────────────────────

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final AuthUser? user;
  final String? error;

  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.error,
  });

  AuthState copyWith({AuthStatus? status, AuthUser? user, String? error}) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      error: error,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restoreSession();
    return const AuthState();
  }

  static const _allowedRoles = {'talent', 'agency'};

  Future<void> _restoreSession() async {
    final storage = ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();
    if (token == null) {
      state = state.copyWith(status: AuthStatus.unauthenticated);
      return;
    }

    try {
      final authService = ref.read(authServiceProvider);
      final user = await authService.getMe();
      if (!_allowedRoles.contains(user.role)) {
        await storage.clearTokens();
        state = state.copyWith(status: AuthStatus.unauthenticated);
        return;
      }
      state = AuthState(status: AuthStatus.authenticated, user: user);
    } catch (_) {
      await storage.clearTokens();
      state = state.copyWith(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login(String email, String password, {String? expectedRole}) async {
    try {
      final authService = ref.read(authServiceProvider);
      final storage = ref.read(secureStorageProvider);
      final response = await authService.login(email, password);

      if (!_allowedRoles.contains(response.user.role)) {
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          error: 'This account type is not supported in this app.',
        );
        return;
      }

      if (expectedRole != null && response.user.role != expectedRole) {
        final label = expectedRole == 'agency' ? 'agency' : 'talent';
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          error: 'This account is not an $label account.',
        );
        return;
      }

      await storage.saveTokens(
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      );
      state = AuthState(status: AuthStatus.authenticated, user: response.user);
    } on DioException catch (e) {
      String msg;
      if (e.response?.statusCode == 401) {
        msg = 'Invalid email or password.';
      } else if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError) {
        msg = 'Cannot reach the server. Check your connection.';
      } else {
        msg = e.response?.data?['error']?.toString() ?? 'Login failed: ${e.message}';
      }
      state = state.copyWith(status: AuthStatus.unauthenticated, error: msg);
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: 'Login failed: $e',
      );
    }
  }

  Future<void> logout() async {
    final storage = ref.read(secureStorageProvider);
    await storage.clearTokens();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Adopts a session obtained outside the login form — currently only the
  /// WhatsApp password-reset wizard, which signs the user in with the temp
  /// password before collecting a new one. Mirrors the web's
  /// `applyResetSession`: persist tokens immediately so the router redirect
  /// lands the user in the app; [refreshUser] then swaps in the full profile
  /// (the reset payload carries only id/email/role).
  Future<void> applySession(AuthResponse response) async {
    final storage = ref.read(secureStorageProvider);
    await storage.saveTokens(
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    );
    state = AuthState(status: AuthStatus.authenticated, user: response.user);
  }

  /// Re-fetch the authenticated user (e.g. after editing name in Settings) so
  /// the shell/dashboard reflect the change without a re-login.
  Future<void> refreshUser() async {
    try {
      final user = await ref.read(authServiceProvider).getMe();
      if (_allowedRoles.contains(user.role)) {
        state = AuthState(status: AuthStatus.authenticated, user: user);
      }
    } catch (_) {
      // Keep the current session on a transient failure.
    }
  }

  void clearError() {
    state = state.copyWith(error: null);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

// ─── Subscription providers ─────────────────────────────────────────────────

/// Fetches subscription recipients for a backend-supported status filter:
/// `pending` | `accepted` | `rejected` | `all`, scoped to one product line
/// (`card_type`: 'subscription' | 'assignment' — the backend defaults to
/// 'subscription' when omitted). Keyed by (cardType, status) so the Pending
/// and Responded screens (and the Responded filter chips) each cache their own
/// list. Invalidate the whole family with `ref.invalidate(subscriptionListProvider)`.
typedef SubscriptionListQuery = (String cardType, String status);

final subscriptionListProvider = FutureProvider.autoDispose
    .family<List<SubscriptionCardRecipient>, SubscriptionListQuery>(
        (ref, query) async {
  final service = ref.watch(subscriptionServiceProvider);
  final (cardType, status) = query;
  return service.list(status: status, cardType: cardType);
});

final pendingCardsProvider = subscriptionListProvider(('subscription', 'pending'));

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.getUnreadCount();
});

/// Pending assignment count (assignments have no dedicated unread endpoint).
final unreadAssignmentCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final items =
      await ref.watch(subscriptionListProvider(('assignment', 'pending')).future);
  return items.length;
});

final unreadSubscriptionFeedCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final items = await ref
      .watch(subscriptionListProvider(('subscription', 'pending')).future);
  return items.length;
});

// ─── Bidding providers ─────────────────────────────────────────────────────

/// All active bids/offers across cards for the Bidding tab.
final talentCardOffersProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.listOffers();
});

/// Open (active) bid count for a card type — used as the Bidding tab badge.
final biddingCountProvider = Provider.autoDispose<int>((ref) {
  final offers = ref.watch(talentCardOffersProvider).value ?? const [];
  final openStatuses = {'pending_business', 'pending_talent'};
  return offers.where((o) {
    final status = o['status'] as String? ?? '';
    return openStatuses.contains(status);
  }).length;
});

/// Offer details for a specific recipient (used in subscription detail screen).
final offerDetailProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>?, String>((ref, recipientId) async {
  final service = ref.watch(subscriptionServiceProvider);
  try {
    return await service.getOffer(recipientId);
  } catch (_) {
    return null;
  }
});

// ─── Talent profile (for WhatsApp toggle + inactive-profile guard) ───────────

final talentMeProvider = FutureProvider.autoDispose<TalentMe>((ref) async {
  final service = ref.watch(talentServiceProvider);
  return service.getMe();
});

// ─── Agency providers ───────────────────────────────────────────────────────

final agencyMeProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.watch(agencyServiceProvider);
  return service.getMe();
});

final agencySquadProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final service = ref.watch(agencyServiceProvider);
  return service.listSquad();
});

final agencyMemberProfilesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final service = ref.watch(agencyServiceProvider);
  return service.listMemberProfiles();
});

final agencyGeneralPortfoliosProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final service = ref.watch(agencyServiceProvider);
  return service.listGeneralPortfolios();
});

final agencyTotalPortfolioProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final service = ref.watch(agencyServiceProvider);
  return service.getTotalPortfolio();
});
