import '../core/json.dart';
import 'job_card.dart';

/// Interview invite + live FIFO queue models. Mirrors `TalentInviteItem` /
/// `InviteQueueSnapshot` (src/hooks/useJobInterviews.ts). The meeting link /
/// venue stay null until the business "starts" this invite (`round.link_locked`).

class TalentInterviewInvite {
  final String id;
  final String rsvp; // invited | accepted | declined
  final String? rsvpAt;
  final String queueStatus; // none|queued|waitlisted|in_progress|done|no_show|not_joined|removed
  final int? confirmSeq;
  final String? confirmedAt;
  final String? promotedAt;
  final String? showedUpAt;
  final String? startedAt;
  final String? completedAt;
  final String? outcome; // selected | rejected | on_hold | null

  const TalentInterviewInvite({
    required this.id,
    required this.rsvp,
    this.rsvpAt,
    this.queueStatus = 'none',
    this.confirmSeq,
    this.confirmedAt,
    this.promotedAt,
    this.showedUpAt,
    this.startedAt,
    this.completedAt,
    this.outcome,
  });

  factory TalentInterviewInvite.fromJson(Map<String, dynamic> json) =>
      TalentInterviewInvite(
        id: json['id'] as String,
        rsvp: asString(json['rsvp']) ?? 'invited',
        rsvpAt: asString(json['rsvp_at']),
        queueStatus: asString(json['queue_status']) ?? 'none',
        confirmSeq: asInt(json['confirm_seq']),
        confirmedAt: asString(json['confirmed_at']),
        promotedAt: asString(json['promoted_at']),
        showedUpAt: asString(json['showed_up_at']),
        startedAt: asString(json['started_at']),
        completedAt: asString(json['completed_at']),
        outcome: asString(json['outcome']),
      );

  bool get hasAccepted => rsvp == 'accepted';
  bool get hasDeclined => rsvp == 'declined';
  bool get isInvited => rsvp == 'invited';
  bool get isInQueue => queueStatus == 'queued' || queueStatus == 'waitlisted';
  bool get isInProgress => queueStatus == 'in_progress';
  bool get isDone => queueStatus == 'done';
}

class TalentInterviewRound {
  final String id;
  final String cardId;
  final String jobProfileId;
  final int roundNo;
  final String? title;
  final String mode; // virtual | physical
  final String? windowStart;
  final String? windowEnd;
  final int minutesPerInterview;
  final String status; // scheduled | in_progress | completed | cancelled
  final String? confirmOpenedAt;
  final String? meetingProvider;
  final String? meetingLink;
  final JobLocationSnapshot? location;
  final bool linkLocked;

  const TalentInterviewRound({
    required this.id,
    required this.cardId,
    required this.jobProfileId,
    this.roundNo = 1,
    this.title,
    this.mode = 'virtual',
    this.windowStart,
    this.windowEnd,
    this.minutesPerInterview = 0,
    this.status = 'scheduled',
    this.confirmOpenedAt,
    this.meetingProvider,
    this.meetingLink,
    this.location,
    this.linkLocked = true,
  });

  factory TalentInterviewRound.fromJson(Map<String, dynamic> json) =>
      TalentInterviewRound(
        id: json['id'] as String,
        cardId: asString(json['card_id']) ?? '',
        jobProfileId: asString(json['job_profile_id']) ?? '',
        roundNo: asInt(json['round_no']) ?? 1,
        title: asString(json['title']),
        mode: asString(json['mode']) ?? 'virtual',
        windowStart: asString(json['window_start']),
        windowEnd: asString(json['window_end']),
        minutesPerInterview: asInt(json['minutes_per_interview']) ?? 0,
        status: asString(json['status']) ?? 'scheduled',
        confirmOpenedAt: asString(json['confirm_opened_at']),
        meetingProvider: asString(json['meeting_provider']),
        meetingLink: asString(json['meeting_link']),
        location: json['location'] is Map
            ? JobLocationSnapshot(asObject(json['location']))
            : null,
        linkLocked: asBool(json['link_locked'], or: true),
      );

  bool get isVirtual => mode == 'virtual';
  bool get confirmWindowOpen => confirmOpenedAt != null;
}

class TalentInviteItem {
  final TalentInterviewInvite invite;
  final TalentInterviewRound round;
  final String jobTitle;
  final String businessName;

  const TalentInviteItem({
    required this.invite,
    required this.round,
    required this.jobTitle,
    required this.businessName,
  });

  factory TalentInviteItem.fromJson(Map<String, dynamic> json) {
    final job = asObject(json['job']);
    return TalentInviteItem(
      invite: TalentInterviewInvite.fromJson(asObject(json['invite'])),
      round: TalentInterviewRound.fromJson(asObject(json['round'])),
      jobTitle: asString(job['title']) ?? 'Interview',
      businessName: asString(job['business_name']) ?? 'Business',
    );
  }
}

class InviteQueue {
  final int? position;
  final String? approxTime;
  final int? waitlistPosition;
  final int capacity;
  final int queuedCount;
  final int waitlistCount;

  const InviteQueue({
    this.position,
    this.approxTime,
    this.waitlistPosition,
    this.capacity = 0,
    this.queuedCount = 0,
    this.waitlistCount = 0,
  });

  factory InviteQueue.fromJson(Map<String, dynamic> json) => InviteQueue(
        position: asInt(json['position']),
        approxTime: asString(json['approx_time']),
        waitlistPosition: asInt(json['waitlist_position']),
        capacity: asInt(json['capacity']) ?? 0,
        queuedCount: asInt(json['queued_count']) ?? 0,
        waitlistCount: asInt(json['waitlist_count']) ?? 0,
      );
}

class InviteQueueSnapshot {
  final TalentInterviewInvite invite;
  final TalentInterviewRound round;
  final InviteQueue queue;

  const InviteQueueSnapshot({
    required this.invite,
    required this.round,
    required this.queue,
  });

  factory InviteQueueSnapshot.fromJson(Map<String, dynamic> json) =>
      InviteQueueSnapshot(
        invite: TalentInterviewInvite.fromJson(asObject(json['invite'])),
        round: TalentInterviewRound.fromJson(asObject(json['round'])),
        queue: InviteQueue.fromJson(asObject(json['queue'])),
      );
}
