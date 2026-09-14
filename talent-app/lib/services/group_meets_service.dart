import '../core/json.dart';
import '../models/group_meet.dart';
import 'api_client.dart';

class GroupMeetsService {
  final ApiClient _client;
  GroupMeetsService(this._client);
  Future<GroupMeet> get(String id) async {
    final response = await _client.dio.get('/talent/group-meets/$id');
    return GroupMeet.fromJson(asObject(asObject(response.data)['meeting']));
  }
  Future<GroupMeet> respond(String id, String action) async {
    final response = await _client.dio.post('/talent/group-meets/$id/respond', data: {'action': action});
    return GroupMeet.fromJson(asObject(asObject(response.data)['meeting']));
  }
  Future<void> send(String id, String body) => _client.dio.post('/talent/group-meets/$id/messages', data: {'body': body});
  Future<GroupMeetJoinCredentials> join(String id) async {
    final response = await _client.dio.post('/talent/group-meets/$id/join');
    return GroupMeetJoinCredentials.fromJson(asObject(asObject(response.data)['credentials']));
  }
  Future<void> leave(String id) => _client.dio.post('/talent/group-meets/$id/leave');
}
