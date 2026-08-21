import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static const _accessTokenKey = 'squadhire_access_token';
  static const _refreshTokenKey = 'squadhire_refresh_token';
  static const _onboardingJourneyDismissedKey =
      'squadhire_onboarding_journey_dismissed';

  final _storage = const FlutterSecureStorage();

  Future<String?> getAccessToken() => _storage.read(key: _accessTokenKey);
  Future<String?> getRefreshToken() => _storage.read(key: _refreshTokenKey);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  Future<bool> getOnboardingJourneyDismissed() async =>
      await _storage.read(key: _onboardingJourneyDismissedKey) == '1';

  Future<void> setOnboardingJourneyDismissed() =>
      _storage.write(key: _onboardingJourneyDismissedKey, value: '1');
}
