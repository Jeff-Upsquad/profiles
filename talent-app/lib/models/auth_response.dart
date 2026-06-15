class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final AuthUser user;

  AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      user: AuthUser.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class AuthUser {
  final String id;
  final String email;
  final String role;
  final String? fullName;

  AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      // `/auth/me` returns the talent_users row, which has no `email` column
      // (email lives on the auth user). Only the login response carries it.
      // Tolerate its absence so session restore doesn't throw → silent logout.
      email: (json['email'] as String?) ?? '',
      role: (json['role'] as String?) ?? 'talent',
      fullName: json['full_name'] as String?,
    );
  }
}
