import '../core/json.dart';
import '../models/onboarding_progress.dart';
import 'api_client.dart';

/// Dashboard data — the onboarding-progress strip.
class DashboardService {
  final ApiClient _client;
  DashboardService(this._client);

  Future<OnboardingProgress> onboardingProgress() async {
    final r = await _client.dio.get('/talent/me/onboarding-progress');
    return OnboardingProgress.fromJson(asObject(r.data));
  }
}
