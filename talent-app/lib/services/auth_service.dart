import '../models/auth_response.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient _client;

  AuthService(this._client);

  Future<AuthResponse> login(String email, String password) async {
    final response = await _client.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Change the signed-in user's password. Mirrors the web: only `new_password`
  /// is sent (the session authenticates the change); callers sign out after.
  Future<void> changePassword(String newPassword) async {
    await _client.dio.post('/auth/change-password', data: {
      'new_password': newPassword,
    });
  }

  Future<AuthUser> getMe() async {
    final response = await _client.dio.get('/auth/me');
    final data = response.data as Map<String, dynamic>;
    // /auth/me returns the user object flat (no `user` wrapper); the login
    // endpoint wraps it. Handle both shapes — mirrors the web client's
    // `data.user ?? data`. Previously this hard-cast data['user'], which threw
    // on every session restore and silently logged the user out on cold start.
    final userJson = (data['user'] as Map<String, dynamic>?) ?? data;
    return AuthUser.fromJson(userJson);
  }
}
