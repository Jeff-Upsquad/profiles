import '../core/json.dart';

class GroupMeetMember {
  final String id;
  final String participantType;
  final String displayName;
  final String role;
  final String rsvp;
  final Map<String, dynamic>? agreedAmount;

  const GroupMeetMember({required this.id, required this.participantType, required this.displayName, required this.role, required this.rsvp, this.agreedAmount});
  factory GroupMeetMember.fromJson(Map<String, dynamic> json) => GroupMeetMember(
    id: asString(json['id']) ?? '', participantType: asString(json['participant_type']) ?? '',
    displayName: asString(json['display_name']) ?? 'Participant', role: asString(json['role']) ?? 'guest',
    rsvp: asString(json['rsvp']) ?? 'invited', agreedAmount: json['agreed_amount'] is Map ? asObject(json['agreed_amount']) : null,
  );
}

class GroupMeetMessage {
  final String id;
  final String senderType;
  final String senderName;
  final String body;
  final DateTime createdAt;
  const GroupMeetMessage({required this.id, required this.senderType, required this.senderName, required this.body, required this.createdAt});
  factory GroupMeetMessage.fromJson(Map<String, dynamic> json) => GroupMeetMessage(
    id: asString(json['id']) ?? '', senderType: asString(json['sender_type']) ?? 'system',
    senderName: asString(json['sender_name']) ?? 'Group Meet', body: asString(json['body']) ?? '',
    createdAt: DateTime.tryParse(asString(json['created_at']) ?? '') ?? DateTime.now(),
  );
}

class GroupMeet {
  final String id;
  final String title;
  final DateTime startsAt;
  final DateTime endsAt;
  final String timezone;
  final String meetingLink;
  final String status;
  final int revision;
  final List<GroupMeetMember> members;
  final List<GroupMeetMessage> messages;
  final int invitedCount;
  final int acceptedCount;
  final int declinedCount;
  final String? selfRsvp;
  const GroupMeet({required this.id, required this.title, required this.startsAt, required this.endsAt, required this.timezone, required this.meetingLink, required this.status, required this.revision, required this.members, required this.messages, required this.invitedCount, required this.acceptedCount, required this.declinedCount, this.selfRsvp});
  factory GroupMeet.fromJson(Map<String, dynamic> json) => GroupMeet(
    id: asString(json['id']) ?? '', title: asString(json['title']) ?? 'Group Meet',
    startsAt: DateTime.tryParse(asString(json['starts_at']) ?? '') ?? DateTime.now(),
    endsAt: DateTime.tryParse(asString(json['ends_at']) ?? '') ?? DateTime.now(),
    timezone: asString(json['timezone']) ?? 'UTC', meetingLink: asString(json['meeting_link']) ?? '',
    status: asString(json['status']) ?? 'scheduled', revision: asInt(json['revision']) ?? 1,
    members: asObjectList(json['members']).map(GroupMeetMember.fromJson).toList(),
    messages: asObjectList(json['messages']).map(GroupMeetMessage.fromJson).toList(),
    invitedCount: asInt(json['invited_count']) ?? 0, acceptedCount: asInt(json['accepted_count']) ?? 0,
    declinedCount: asInt(json['declined_count']) ?? 0,
    selfRsvp: asString(json['self_rsvp']),
  );
}

class GroupMeetJoinCredentials {
  final String token;
  final String url;
  final String identity;
  final GroupMeet meeting;
  const GroupMeetJoinCredentials({required this.token, required this.url, required this.identity, required this.meeting});
  factory GroupMeetJoinCredentials.fromJson(Map<String, dynamic> json) => GroupMeetJoinCredentials(
    token: asString(json['token']) ?? '',
    url: asString(json['url']) ?? '',
    identity: asString(json['identity']) ?? '',
    meeting: GroupMeet.fromJson(asObject(json['meeting'])),
  );
}
