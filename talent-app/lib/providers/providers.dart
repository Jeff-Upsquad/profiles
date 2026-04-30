import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/secure_storage.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/subscription_service.dart';
import '../services/push_service.dart';
import '../models/auth_response.dart';
import '../models/subscription_card.dart';

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
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        error: 'Invalid email or password.',
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

final pendingCardsProvider = FutureProvider.autoDispose<List<SubscriptionCardRecipient>>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.list(status: 'pending');
});

final respondedCardsProvider = FutureProvider.autoDispose<List<SubscriptionCardRecipient>>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.list(status: 'responded');
});

final unreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final service = ref.watch(subscriptionServiceProvider);
  return service.getUnreadCount();
});
