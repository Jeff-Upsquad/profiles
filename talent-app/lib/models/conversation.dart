import '../core/json.dart';

class IntroPerson {
  final String id;
  final String name;
  final String? email;
  final String? photoUrl;

  const IntroPerson({
    required this.id,
    required this.name,
    this.email,
    this.photoUrl,
  });

  factory IntroPerson.fromJson(Map<String, dynamic> json) => IntroPerson(
        id: asString(json['id']) ?? '',
        name: asString(json['name']) ?? 'Unknown',
        email: asString(json['email']),
        photoUrl: asString(json['photo_url']),
      );
}

class IntroLastMessage {
  final String kind;
  final String? body;
  final String senderType;
  final String? createdAt;

  const IntroLastMessage({
    required this.kind,
    this.body,
    required this.senderType,
    this.createdAt,
  });

  factory IntroLastMessage.fromJson(Map<String, dynamic> json) =>
      IntroLastMessage(
        kind: asString(json['kind']) ?? 'text',
        body: asString(json['body']),
        senderType: asString(json['sender_type']) ?? 'system',
        createdAt: asString(json['created_at']),
      );
}

class IntroMeeting {
  final String id;
  final String conversationId;
  final String proposedByType;
  final String? proposedById;
  final String startsAt;
  final String? endsAt;
  final String? timezone;
  final String provider;
  final String? meetingLink;
  final String status;
  final String? createdAt;

  const IntroMeeting({
    required this.id,
    required this.conversationId,
    required this.proposedByType,
    this.proposedById,
    required this.startsAt,
    this.endsAt,
    this.timezone,
    required this.provider,
    this.meetingLink,
    required this.status,
    this.createdAt,
  });

  factory IntroMeeting.fromJson(Map<String, dynamic> json) => IntroMeeting(
        id: asString(json['id']) ?? '',
        conversationId: asString(json['conversation_id']) ?? '',
        proposedByType: asString(json['proposed_by_type']) ?? '',
        proposedById: asString(json['proposed_by_id']),
        startsAt: asString(json['starts_at']) ?? '',
        endsAt: asString(json['ends_at']),
        timezone: asString(json['timezone']),
        provider: asString(json['provider']) ?? 'other',
        meetingLink: asString(json['meeting_link']),
        status: asString(json['status']) ?? 'proposed',
        createdAt: asString(json['created_at']),
      );

  bool get isProposed => status == 'proposed';
  bool get isAccepted => status == 'accepted';
  bool get isLive => isProposed || isAccepted;
}

class IntroMessage {
  final String id;
  final String conversationId;
  final String senderType;
  final String? senderId;
  final String? senderName;
  final String kind;
  final String? body;
  final IntroMeeting? meeting;
  final String createdAt;
  final String? deletedAt;

  const IntroMessage({
    required this.id,
    required this.conversationId,
    required this.senderType,
    this.senderId,
    this.senderName,
    required this.kind,
    this.body,
    this.meeting,
    required this.createdAt,
    this.deletedAt,
  });

  factory IntroMessage.fromJson(Map<String, dynamic> json) => IntroMessage(
        id: asString(json['id']) ?? '',
        conversationId: asString(json['conversation_id']) ?? '',
        senderType: asString(json['sender_type']) ?? 'system',
        senderId: asString(json['sender_id']),
        senderName: asString(json['sender_name']),
        kind: asString(json['kind']) ?? 'text',
        body: asString(json['body']),
        meeting: json['meeting'] is Map
            ? IntroMeeting.fromJson(asObject(json['meeting']))
            : null,
        createdAt: asString(json['created_at']) ?? '',
        deletedAt: asString(json['deleted_at']),
      );

  bool get isSystem => kind == 'system';
  bool get isMeeting => kind == 'meeting';
  bool get isDeleted => deletedAt != null;
}

class IntroConversation {
  final String id;
  final String status;
  final bool frozen;
  final String? frozenReason;
  final bool canSend;
  final String cardId;
  final String? cardType;
  final String? cardTitle;
  final IntroPerson business;
  final IntroPerson talent;
  final IntroPerson? salesperson;
  final IntroLastMessage? lastMessage;
  final int unreadCount;
  final String? lastMessageAt;
  final String createdAt;

  const IntroConversation({
    required this.id,
    required this.status,
    required this.frozen,
    this.frozenReason,
    required this.canSend,
    required this.cardId,
    this.cardType,
    this.cardTitle,
    required this.business,
    required this.talent,
    this.salesperson,
    this.lastMessage,
    this.unreadCount = 0,
    this.lastMessageAt,
    required this.createdAt,
  });

  factory IntroConversation.fromJson(Map<String, dynamic> json) =>
      IntroConversation(
        id: asString(json['id']) ?? '',
        status: asString(json['status']) ?? 'open',
        frozen: asBool(json['frozen']),
        frozenReason: asString(json['frozen_reason']),
        canSend: asBool(json['can_send'], or: true),
        cardId: asString(json['card_id']) ?? '',
        cardType: asString(json['card_type']),
        cardTitle: asString(json['card_title']),
        business: IntroPerson.fromJson(asObject(json['business'])),
        talent: IntroPerson.fromJson(asObject(json['talent'])),
        salesperson: json['salesperson'] is Map
            ? IntroPerson.fromJson(asObject(json['salesperson']))
            : null,
        lastMessage: json['last_message'] is Map
            ? IntroLastMessage.fromJson(asObject(json['last_message']))
            : null,
        unreadCount: asInt(json['unread_count']) ?? 0,
        lastMessageAt: asString(json['last_message_at']),
        createdAt: asString(json['created_at']) ?? '',
      );
}
