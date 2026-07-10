import '../core/json.dart';
import '../models/interview.dart';
import 'api_client.dart';

/// Interview invites + live FIFO queue — `/api/talent/jobs/interview-invites`.
class InterviewsService {
  final ApiClient _client;
  InterviewsService(this._client);

  Future<List<TalentInviteItem>> invites() async {
    final r = await _client.dio.get('/talent/jobs/interview-invites');
    return asObjectList(asObject(r.data)['invites'])
        .map(TalentInviteItem.fromJson)
        .toList();
  }

  /// RSVP to an invite. [action] is 'accept' | 'decline'.
  Future<void> respond(String inviteId, String action) async {
    await _client.dio.post(
      '/talent/jobs/interview-invites/$inviteId/respond',
      data: {'action': action},
    );
  }

  /// The T-10 "I'm available" tap — atomic FIFO ticket. Returns the fresh queue.
  Future<InviteQueueSnapshot> confirm(String inviteId) async {
    final r = await _client.dio
        .post('/talent/jobs/interview-invites/$inviteId/confirm');
    return InviteQueueSnapshot.fromJson(asObject(r.data));
  }

  /// Live queue position + approx time (polled ~every 20s while the panel is up).
  Future<InviteQueueSnapshot> queue(String inviteId) async {
    final r =
        await _client.dio.get('/talent/jobs/interview-invites/$inviteId/queue');
    return InviteQueueSnapshot.fromJson(asObject(r.data));
  }
}
