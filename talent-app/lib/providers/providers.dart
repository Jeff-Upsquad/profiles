import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/secure_storage.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/subscription_service.dart';
import '../services/talent_service.dart';
import '../services/push_service.dart';
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

final subscriptionServiceProvider = Provider((ref) {
  return SubscriptionService(ref.watch(apiClientProvider));
});

final talentServiceProvider = Provider((ref) {
  return TalentService(ref.watch(apiClientProvider));
});

final pushServiceProvider = Provider((ref) {
  return PushService(ref.watch(apiClientProvider));
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
      if (user.role != 'talent') {
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

  Future<void> login(String email, String password) async {
    try {
      final authService = ref.read(authServiceProvider);
      final storage = ref.read(secureStorageProvider);
      final response = await authService.login(email, password);

      if (response.user.role != 'talent') {
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          error: 'This app is for talent users only.',
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

  void clearError() {
    state = state.copyWith(error: null);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

// ─── Subscription providers ─────────────────────────────────────────────────

/// Fetches subscription recipients for a backend-supported status filter:
/// `pending` | `accepted` | `rejected` | `all`. Keyed by status so the Pending
/// and Responded screens (and the Responded filter chips) each cache their own
/// list. Invalidate the whole family with `ref.invalidate(subscriptionListProvider)`.
final subscriptionListProvider = FutureProvider.autoDispose
    .family<List<SubscriptionCardRecipient>, String>((ref, status) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.list(status: status);
});

final pendingCardsProvider = subscriptionListProvider('pending');

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.getUnreadCount();
});

// ─── Talent profile (for WhatsApp toggle + inactive-profile guard) ───────────

final talentMeProvider = FutureProvider.autoDispose<TalentMe>((ref) async {
  final service = ref.watch(talentServiceProvider);
  return service.getMe();
});
