import '../core/json.dart';
import 'job_card.dart';

/// Recipient-gated job + business profile view with its Q&A thread and the
/// viewer's own recipient row. Mirrors the `useJobProfileView` response
/// (src/hooks/useJobs.ts): `{ profile, questions, recipient }`.

class TalentJobProfile {
  final String id;
  final String? externalId;
  final String title;
  final String? description;
  final JobProfileSnapshot details;
  final BusinessProfileSnapshot businessSnapshot;
  final BrandProfileSnapshot? brandSnapshot;
  final String status;

  const TalentJobProfile({
    required this.id,
    this.externalId,
    required this.title,
    this.description,
    required this.details,
    required this.businessSnapshot,
    this.brandSnapshot,
    required this.status,
  });

  factory TalentJobProfile.fromJson(Map<String, dynamic> json) {
    final brand = json['brand_snapshot'];
    final hasBrand = brand is Map && brand.isNotEmpty;
    return TalentJobProfile(
      id: json['id'] as String,
      externalId: asString(json['external_id']),
      title: asString(json['title']) ?? 'Job opening',
      description: asString(json['description']),
      details: JobProfileSnapshot(asObject(json['details'])),
      businessSnapshot: BusinessProfileSnapshot(asObject(json['business_snapshot'])),
      brandSnapshot: hasBrand ? BrandProfileSnapshot(asObject(brand)) : null,
      status: asString(json['status']) ?? 'published',
    );
  }
}

class JobQuestion {
  final String id;
  final String question;
  final String? answer;
  final String? answeredAt;
  final bool isPublished;
  final bool isMine;
  final String? askerName;
  final String? createdAt;

  const JobQuestion({
    required this.id,
    required this.question,
    this.answer,
    this.answeredAt,
    this.isPublished = false,
    this.isMine = false,
    this.askerName,
    this.createdAt,
  });

  factory JobQuestion.fromJson(Map<String, dynamic> json) => JobQuestion(
        id: json['id'] as String,
        question: asString(json['question']) ?? '',
        answer: asString(json['answer']),
        answeredAt: asString(json['answered_at']),
        isPublished: asBool(json['is_published']),
        isMine: asBool(json['is_mine']),
        askerName: asString(json['asker_name']),
        createdAt: asString(json['created_at']),
      );

  bool get isAnswered => (answer ?? '').isNotEmpty;
}

/// The viewer's own recipient on this profile's newest card (drives the action
/// bar). Null before the talent has ever received a card for this profile.
class JobProfileViewerRecipient {
  final String id;
  final String status;
  final String cardId;
  final bool cardLive;
  final String? candidateStage;

  const JobProfileViewerRecipient({
    required this.id,
    required this.status,
    required this.cardId,
    this.cardLive = false,
    this.candidateStage,
  });

  factory JobProfileViewerRecipient.fromJson(Map<String, dynamic> json) =>
      JobProfileViewerRecipient(
        id: json['id'] as String,
        status: asString(json['status']) ?? 'pending',
        cardId: asString(json['card_id']) ?? '',
        cardLive: asBool(json['card_live']),
        candidateStage: asString(json['candidate_stage']),
      );

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
}

class JobProfileView {
  final TalentJobProfile profile;
  final List<JobQuestion> questions;
  final JobProfileViewerRecipient? recipient;

  const JobProfileView({
    required this.profile,
    this.questions = const [],
    this.recipient,
  });

  factory JobProfileView.fromJson(Map<String, dynamic> json) => JobProfileView(
        profile: TalentJobProfile.fromJson(asObject(json['profile'])),
        questions:
            asObjectList(json['questions']).map(JobQuestion.fromJson).toList(),
        recipient: json['recipient'] is Map
            ? JobProfileViewerRecipient.fromJson(asObject(json['recipient']))
            : null,
      );
}
