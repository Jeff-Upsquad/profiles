import '../core/json.dart';

/// Job-offer models. Mirrors `TalentJobOffer` / `OfferEvent`
/// (src/hooks/useJobOffers.ts). Negotiation is locked out once the business
/// makes its FINAL counteroffer (`is_final_counter` / status 'countered').

class CompensationSlot {
  final num? amount;
  final String? cadence;

  const CompensationSlot({this.amount, this.cadence});

  factory CompensationSlot.fromJson(Map<String, dynamic> json) =>
      CompensationSlot(
        amount: asNum(json['amount']),
        cadence: asString(json['cadence']),
      );

  bool get isEmpty => amount == null && cadence == null;
}

class OfferCompensation {
  final String? currency;
  final CompensationSlot? training;
  final CompensationSlot? probation;
  final CompensationSlot? confirmed;

  const OfferCompensation({
    this.currency,
    this.training,
    this.probation,
    this.confirmed,
  });

  factory OfferCompensation.fromJson(Map<String, dynamic> json) {
    CompensationSlot? slot(String key) =>
        json[key] is Map ? CompensationSlot.fromJson(asObject(json[key])) : null;
    return OfferCompensation(
      currency: asString(json['currency']),
      training: slot('training'),
      probation: slot('probation'),
      confirmed: slot('confirmed'),
    );
  }
}

class OfferLetterSection {
  final String key;
  final String? title;
  final String? bodyHtml;

  const OfferLetterSection({required this.key, this.title, this.bodyHtml});

  factory OfferLetterSection.fromJson(Map<String, dynamic> json) =>
      OfferLetterSection(
        key: asString(json['key']) ?? '',
        title: asString(json['title']),
        bodyHtml: asString(json['body_html']),
      );
}

class OfferLetter {
  final List<OfferLetterSection> sections;
  final String? signatoryName;
  final String? signatoryTitle;

  const OfferLetter({
    this.sections = const [],
    this.signatoryName,
    this.signatoryTitle,
  });

  factory OfferLetter.fromJson(Map<String, dynamic> json) {
    final sig = asObject(json['signatory']);
    return OfferLetter(
      sections: asObjectList(json['sections'])
          .map(OfferLetterSection.fromJson)
          .toList(),
      signatoryName: asString(sig['name']),
      signatoryTitle: asString(sig['title']),
    );
  }
}

class JobOffer {
  final String id;
  final String? candidateId;
  final String? cardId;
  final String? jobProfileId;
  final String deliveryMode; // platform | manual_email
  final String positionTitle;
  final String? effectiveDate;
  final String? joinByDate;
  final String? expiresOn;
  final OfferCompensation compensation;
  final OfferLetter? letter;
  final String status; // draft|sent|negotiating|countered|accepted|declined|withdrawn|expired
  final bool isFinalCounter;
  final String? sentAt;
  final String? respondedAt;
  final String? withdrawnAt;
  final String? createdAt;
  // Present on the list endpoint (TalentJobOffer):
  final String? businessName;
  final String? jobTitle;

  const JobOffer({
    required this.id,
    this.candidateId,
    this.cardId,
    this.jobProfileId,
    this.deliveryMode = 'platform',
    required this.positionTitle,
    this.effectiveDate,
    this.joinByDate,
    this.expiresOn,
    required this.compensation,
    this.letter,
    required this.status,
    this.isFinalCounter = false,
    this.sentAt,
    this.respondedAt,
    this.withdrawnAt,
    this.createdAt,
    this.businessName,
    this.jobTitle,
  });

  factory JobOffer.fromJson(Map<String, dynamic> json) => JobOffer(
        id: json['id'] as String,
        candidateId: asString(json['candidate_id']),
        cardId: asString(json['card_id']),
        jobProfileId: asString(json['job_profile_id']),
        deliveryMode: asString(json['delivery_mode']) ?? 'platform',
        positionTitle: asString(json['position_title']) ?? 'Offer',
        effectiveDate: asString(json['effective_date']),
        joinByDate: asString(json['join_by_date']),
        expiresOn: asString(json['expires_on']),
        compensation: OfferCompensation.fromJson(asObject(json['compensation'])),
        letter: json['letter'] is Map
            ? OfferLetter.fromJson(asObject(json['letter']))
            : null,
        status: asString(json['status']) ?? 'sent',
        isFinalCounter: asBool(json['is_final_counter']),
        sentAt: asString(json['sent_at']),
        respondedAt: asString(json['responded_at']),
        withdrawnAt: asString(json['withdrawn_at']),
        createdAt: asString(json['created_at']),
        businessName: asString(json['business_name']),
        jobTitle: asString(json['job_title']),
      );

  /// True while the talent can still act (accept/decline/negotiate).
  bool get isOpen =>
      status == 'sent' || status == 'negotiating' || status == 'countered';

  /// Negotiation is blocked once the business posts its final counter.
  bool get canNegotiate => isOpen && !isFinalCounter;

  bool get isAccepted => status == 'accepted';
  bool get isDeclined => status == 'declined';
}

class OfferEvent {
  final String id;
  final String actorType; // talent | business | admin | system
  final String action;
  final num? amount;
  final String? note;
  final String? createdAt;

  const OfferEvent({
    required this.id,
    required this.actorType,
    required this.action,
    this.amount,
    this.note,
    this.createdAt,
  });

  factory OfferEvent.fromJson(Map<String, dynamic> json) => OfferEvent(
        id: json['id'] as String,
        actorType: asString(json['actor_type']) ?? 'system',
        action: asString(json['action']) ?? '',
        amount: asNum(json['amount']),
        note: asString(json['note']),
        createdAt: asString(json['created_at']),
      );

  bool get isMine => actorType == 'talent';
}

class OfferDetail {
  final JobOffer offer;
  final List<OfferEvent> events;

  const OfferDetail({required this.offer, this.events = const []});

  factory OfferDetail.fromJson(Map<String, dynamic> json) => OfferDetail(
        offer: JobOffer.fromJson(asObject(json['offer'])),
        events: asObjectList(json['events']).map(OfferEvent.fromJson).toList(),
      );
}
