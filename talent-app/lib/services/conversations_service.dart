import '../core/json.dart';
import '../models/conversation.dart';
import 'api_client.dart';

/// Intro rooms — `/api/talent/conversations`.
class ConversationsService {
  final ApiClient _client;
  ConversationsService(this._client);

  Future<List<IntroConversation>> list({String prefix = '/talent'}) async {
    final r = await _client.dio.get('$prefix/conversations');
    return asObjectList(asObject(r.data)['conversations'])
        .map(IntroConversation.fromJson)
        .toList();
  }

  Future<int> unreadCount({String prefix = '/talent'}) async {
    final r = await _client.dio.get('$prefix/conversations/unread-count');
    // Agency returns {count: N}, talent returns {unread: N}
    final obj = asObject(r.data);
    return asInt(obj['unread']) ?? asInt(obj['count']) ?? 0;
  }

  Future<IntroConversation> get(String id, {String prefix = '/talent'}) async {
    final r = await _client.dio.get('$prefix/conversations/$id');
    return IntroConversation.fromJson(asObject(asObject(r.data)['conversation']));
  }

  Future<List<IntroMessage>> messages(String id, {String prefix = '/talent'}) async {
    final r = await _client.dio.get(
      '$prefix/conversations/$id/messages',
      queryParameters: {'limit': 100},
    );
    return asObjectList(asObject(r.data)['messages'])
        .map(IntroMessage.fromJson)
        .toList();
  }

  Future<IntroMessage> send(String id, String body, {String prefix = '/talent'}) async {
    final r = await _client.dio.post(
      '$prefix/conversations/$id/messages',
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
    String prefix = '/talent',
  }) async {
    final r = await _client.dio.post(
      '$prefix/conversations/$id/meetings',
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
    String action, {
    String prefix = '/talent',
  }) async {
    final r = await _client.dio.post(
      '$prefix/conversations/$conversationId/meetings/$meetingId/respond',
      data: {'action': action},
    );
    return IntroMeeting.fromJson(asObject(asObject(r.data)['meeting']));
  }

  Future<IntroMeeting> cancel(String conversationId, String meetingId, {String prefix = '/talent'}) async {
    final r = await _client.dio.post(
      '$prefix/conversations/$conversationId/meetings/$meetingId/cancel',
    );
    return IntroMeeting.fromJson(asObject(asObject(r.data)['meeting']));
  }
}
