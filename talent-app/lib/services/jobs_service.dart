import '../core/json.dart';
import '../models/job_card.dart';
import '../models/job_preferences.dart';
import '../models/job_profile_view.dart';
import 'api_client.dart';

/// Talent jobs marketplace — `/api/talent/jobs/*` (jobs-talent.routes.ts).
class JobsService {
  final ApiClient _client;
  JobsService(this._client);

  // ─── Opt-in & preferences ──────────────────────────────────────────────────

  Future<JobPreferences> getOptIn() async {
    final r = await _client.dio.get('/talent/jobs/opt-in');
    return JobPreferences.fromJson(asObject(asObject(r.data)['preferences']));
  }

  Future<JobPreferences> optIn(Map<String, dynamic> prefs) async {
    final r = await _client.dio.post('/talent/jobs/opt-in', data: prefs);
    return JobPreferences.fromJson(asObject(asObject(r.data)['preferences']));
  }

  Future<JobPreferences> optOut() async {
    final r = await _client.dio.delete('/talent/jobs/opt-in');
    return JobPreferences.fromJson(asObject(asObject(r.data)['preferences']));
  }

  Future<JobPreferences> updatePreferences(Map<String, dynamic> prefs) async {
    final r = await _client.dio.put('/talent/jobs/preferences', data: prefs);
    return JobPreferences.fromJson(asObject(asObject(r.data)['preferences']));
  }

  // ─── Feed ───────────────────────────────────────────────────────────────────

  Future<List<TalentJobFeedItem>> feed(String tab) async {
    final r = await _client.dio.get(
      '/talent/jobs',
      queryParameters: {'tab': tab},
    );
    return asObjectList(asObject(r.data)['jobs'])
        .map(TalentJobFeedItem.fromJson)
        .toList();
  }

  Future<int> unreadCount() async {
    final r = await _client.dio.get('/talent/jobs/unread-count');
    return asInt(asObject(r.data)['count']) ?? 0;
  }

  /// Per-tab counts keyed by the `kJobsTabs` keys.
  Future<Map<String, int>> counts() async {
    final r = await _client.dio.get('/talent/jobs/counts');
    final raw = asObject(asObject(r.data)['counts']);
    return raw.map((k, v) => MapEntry(k, asInt(v) ?? 0));
  }

  Future<TalentJobDetail> detail(String recipientId) async {
    final r = await _client.dio.get('/talent/jobs/$recipientId');
    return TalentJobDetail.fromJson(asObject(r.data));
  }

  Future<void> respond(String recipientId, String action) async {
    await _client.dio.patch(
      '/talent/jobs/$recipientId/respond',
      data: {'action': action},
    );
  }

  Future<void> withdraw(String recipientId) async {
    await _client.dio.post('/talent/jobs/$recipientId/withdraw');
  }

  Future<void> reapply(String recipientId) async {
    await _client.dio.post('/talent/jobs/$recipientId/reapply');
  }

  // ─── Job profile view + Q&A ─────────────────────────────────────────────────

  Future<JobProfileView> profileView(String jobProfileId) async {
    final r = await _client.dio.get('/talent/jobs/profiles/$jobProfileId');
    return JobProfileView.fromJson(asObject(r.data));
  }

  Future<void> askQuestion(
    String jobProfileId,
    String question, {
    String? cardId,
  }) async {
    await _client.dio.post(
      '/talent/jobs/profiles/$jobProfileId/questions',
      data: {
        'question': question,
        'card_id': ?cardId,
      },
    );
  }
}
