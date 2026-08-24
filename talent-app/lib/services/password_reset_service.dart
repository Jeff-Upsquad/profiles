import 'package:dio/dio.dart';
import '../models/auth_response.dart';
import 'api_client.dart';

/// Result of `POST /auth/password-reset/lookup` — a masked identity hint plus
/// a short-lived signed ticket that scopes the rest of the reset.
class PasswordResetLookup {
  final bool found;
  final String? role; // 'talent' | 'business'
  final String? maskedName;
  final String? maskedBusiness;
  final String? resetTicket;

  const PasswordResetLookup({
    required this.found,
    this.role,
    this.maskedName,
    this.maskedBusiness,
    this.resetTicket,
  });

  factory PasswordResetLookup.fromJson(Map<String, dynamic> json) {
    return PasswordResetLookup(
      found: json['found'] == true,
      role: json['role'] as String?,
      maskedName: json['masked_name'] as String?,
      maskedBusiness: json['masked_business'] as String?,
      resetTicket: json['reset_ticket'] as String?,
    );
  }
}

/// Self-serve password reset via WhatsApp, mirroring the web wizard
/// (`frontend/src/views/auth/ForgotPassword.tsx`). All endpoints are public
/// and rate-limited; the temp password itself is never returned by the API —
/// it only travels over WhatsApp.
class PasswordResetService {
  final ApiClient _client;

  PasswordResetService(this._client);

  /// Step 1 — is this WhatsApp number registered? Returns a masked name (and
  /// business name for business accounts) to confirm before sending anything.
  Future<PasswordResetLookup> lookup(String phone) async {
    final response = await _client.dio.post(
      '/auth/password-reset/lookup',
      data: {'phone': phone},
    );
    return PasswordResetLookup.fromJson(response.data as Map<String, dynamic>);
  }

  /// Step 2 — apply a two-word temp password to the account and deliver it
  /// over WhatsApp. Returns whether the message was actually delivered
  /// (`{skipped:true}` from the CRM counts as accepted-but-not-delivered).
  Future<bool> sendTempPassword(String resetTicket) async {
    final response = await _client.dio.post(
      '/auth/password-reset/send',
      data: {'reset_ticket': resetTicket},
    );
    return (response.data as Map<String, dynamic>)['delivered'] == true;
  }

  /// Step 3 — verify the temp password by signing in with it. Returns the
  /// same payload shape the login endpoint does (talent → tokens + user).
  Future<AuthResponse> verifyTempPassword(
    String resetTicket,
    String tempPassword,
  ) async {
    final response = await _client.dio.post(
      '/auth/password-reset/verify',
      data: {'reset_ticket': resetTicket, 'temp_password': tempPassword},
    );
    return AuthResponse.fromJson(response.data as Map<String, dynamic>);
  }

  /// Final step — set the new password with the session obtained in
  /// [verifyTempPassword]. That session is held by the wizard and not yet
  /// persisted, so the bearer token is passed explicitly instead of relying
  /// on the shared interceptor.
  Future<void> setNewPassword(String accessToken, String newPassword) async {
    await _client.dio.post(
      '/auth/change-password',
      data: {'new_password': newPassword},
      options: Options(headers: {'Authorization': 'Bearer $accessToken'}),
    );
  }
}
