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
  final String? approvalStatus;
  final bool onboardingCompleted;
  final bool skipOnboarding;
  final bool isActive;

  AuthUser({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.approvalStatus,
    this.onboardingCompleted = false,
    this.skipOnboarding = false,
    this.isActive = true,
  });

  bool get isApproved => approvalStatus == 'approved';
  bool get isOnboarded => onboardingCompleted || skipOnboarding;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      // `/auth/me` returns the talent_users row, which has no `email` column
      // (email lives on the auth user). Only the login response carries it.
      // Tolerate its absence so session restore doesn't throw → silent logout.
      email: (json['email'] as String?) ?? '',
      role: (json['role'] as String?) ?? 'talent',
      fullName: json['full_name'] as String?,
      approvalStatus: json['approval_status'] as String?,
      // Web: onboarded unless the flag is explicitly false (or skip is set).
      onboardingCompleted: json['onboarding_completed'] != false,
      skipOnboarding: json['skip_onboarding'] == true,
      isActive: json['is_active'] != false,
    );
  }
}
