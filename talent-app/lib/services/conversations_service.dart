import '../core/json.dart';
import '../models/conversation.dart';
import 'api_client.dart';

/// Intro rooms — `/api/talent/conversations`.
class ConversationsService {
  final ApiClient _client;
  ConversationsService(this._client);

  Future<List<IntroConversation>> list() async {
    final r = await _client.dio.get('/talent/conversations');
    return asObjectList(asObject(r.data)['conversations'])
        .map(IntroConversation.fromJson)
        .toList();
  }

  Future<int> unreadCount() async {
    final r = await _client.dio.get('/talent/conversations/unread-count');
    return asInt(asObject(r.data)['unread']) ?? 0;
  }

  Future<IntroConversation> get(String id) async {
    final r = await _client.dio.get('/talent/conversations/$id');
    return IntroConversation.fromJson(asObject(asObject(r.data)['conversation']));
  }

  Future<List<IntroMessage>> messages(String id) async {
    final r = await _client.dio.get(
      '/talent/conversations/$id/messages',
      queryParameters: {'limit': 100},
    );
    return asObjectList(asObject(r.data)['messages'])
        .map(IntroMessage.fromJson)
        .toList();
  }

  Future<IntroMessage> send(String id, String body) async {
    final r = await _client.dio.post(
      '/talent/conversations/$id/messages',
      data: {'body': body},
    );
    return IntroMessage.fromJson(asObject(asObject(r.data)['message']));
  }

  Future<IntroMessage> proposeMeeting(
    String id, {
    required String startsAt,
    String? endsAt,
    String? timezone,
    required String provider,
    required String meetingLink,
  }) async {
    final r = await _client.dio.post(
      '/talent/conversations/$id/meetings',
      data: {
        'starts_at': startsAt,
        ?'ends_at': endsAt,
        ?'timezone': timezone,
        'provider': provider,
        'meeting_link': meetingLink,
      },
    );
    return IntroMessage.fromJson(asObject(asObject(r.data)['message']));
  }

  Future<IntroMeeting> respond(
    String conversationId,
    String meetingId,
    String action,
  ) async {
    final r = await _client.dio.post(
      '/talent/conversations/$conversationId/meetings/$meetingId/respond',
      data: {'action': action},
    );
    return IntroMeeting.fromJson(asObject(asObject(r.data)['meeting']));
  }

  Future<IntroMeeting> cancel(String conversationId, String meetingId) async {
    final r = await _client.dio.post(
      '/talent/conversations/$conversationId/meetings/$meetingId/cancel',
    );
    return IntroMeeting.fromJson(asObject(asObject(r.data)['meeting']));
  }
}
