import '../core/format.dart';
import '../core/json.dart';

/// Job-card + feed models. Field shapes mirror the web's `TalentJobFeedItem` /
/// `TalentJobDetail` (src/hooks/useJobs.ts) and the SquadHub hiring-card payload
/// (`JobCardContentShape`). Free-form snapshot blobs are wrapped and read via
/// tolerant getters rather than hard-cast.

// ─── Funnel tabs & stage labels ──────────────────────────────────────────────

/// The 10 talent-facing funnel tabs, in display order. Keys match the API's
/// `?tab=` param and the `/talent/jobs/counts` response keys.
const List<({String key, String label})> kJobsTabs = [
  (key: 'new', label: 'New'),
  (key: 'accepted', label: 'Accepted'),
  (key: 'shortlisted', label: 'Shortlisted'),
  (key: 'call_for_interview', label: 'Call for Interview'),
  (key: 'interview', label: 'Interviews'),
  (key: 'selected', label: 'Selected'),
  (key: 'rejected', label: 'Rejected'),
  (key: 'offer', label: 'Offer'),
  (key: 'hired', label: 'Hired'),
  (key: 'placed', label: 'Placed'),
];

/// Human labels for `job_candidates.funnel_stage`.
const Map<String, String> kFunnelStageLabels = {
  'applied': 'Applied',
  'screening': 'Screening',
  'shortlisted': 'Shortlisted',
  'interview_invited': 'Call for interview',
  'interview': 'Interview',
  'on_hold': 'On hold',
  'selected': 'Selected',
  'rejected': 'Rejected',
  'offer': 'Offer',
  'hired': 'Hired',
  'placed': 'Placed',
  'withdrawn': 'Withdrawn',
  'declined': 'Declined',
};

String funnelStageLabel(String? stage) {
  if (stage == null || stage.isEmpty) return '';
  return kFunnelStageLabels[stage] ?? stage;
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

class JobLocationSnapshot {
  final Map<String, dynamic> raw;
  const JobLocationSnapshot(this.raw);

  String? get label => asString(raw['label']);
  String? get address => asString(raw['address']);
  String? get city => asString(raw['city']);
  String? get region => asString(raw['region']);
  String? get googleMapsUrl => asString(raw['google_maps_url']);

  /// "City, Region" (falling back to label).
  String? get shortLabel {
    final parts = [city, region].whereType<String>().toList();
    if (parts.isNotEmpty) return parts.join(', ');
    return label;
  }
}

class JobProfileSnapshot {
  final Map<String, dynamic> raw;
  const JobProfileSnapshot(this.raw);

  String? get title => asString(raw['title']);
  String? get description => asString(raw['description']);
  List<String> get responsibilities => asStringList(raw['responsibilities']);
  List<String> get requirements => asStringList(raw['requirements']);
  List<String> get skills => asStringList(raw['skills']);
  int? get minExperienceYears => asInt(raw['min_experience_years']);
  int? get maxExperienceYears => asInt(raw['max_experience_years']);
  String? get education => asString(raw['education']);
  String? get employmentType => asString(raw['employment_type']);
  String? get workMode => asString(raw['work_mode']);
  List<String> get workingDays => asStringList(raw['working_days']);
  String? get workingHoursStart =>
      asString(asObject(raw['working_hours'])['start']);
  String? get workingHoursEnd =>
      asString(asObject(raw['working_hours'])['end']);
  num? get salaryMin => asNum(raw['salary_min']);
  num? get salaryMax => asNum(raw['salary_max']);
  String? get salaryCurrency => asString(raw['salary_currency']);
  String? get salaryPeriod => asString(raw['salary_period']);
  List<String> get benefits => asStringList(raw['benefits']);
  String? get growthPath => asString(raw['growth_path']);
  JobLocationSnapshot? get location => raw['location'] is Map
      ? JobLocationSnapshot(asObject(raw['location']))
      : null;

  /// "3–5 yrs" / "2+ yrs" / null.
  String? get experienceLabel {
    final lo = minExperienceYears, hi = maxExperienceYears;
    if (lo == null && hi == null) return null;
    if (lo != null && hi != null && lo != hi) return '$lo–$hi yrs';
    final v = lo ?? hi;
    return v == 0 ? 'Fresher' : '$v+ yrs';
  }
}

class BusinessProfileSnapshot {
  final Map<String, dynamic> raw;
  const BusinessProfileSnapshot(this.raw);

  String? get name => asString(raw['name']);
  String? get about => asString(raw['about']);
  String? get industry => asString(raw['industry']);
  String? get companySize => asString(raw['company_size']);
  String? get website => asString(raw['website']);
  String? get logoUrl => asString(raw['logo_url']);
  List<String> get photos => asStringList(raw['photos']);
  String? get culture => asString(raw['culture']);
  List<String> get perks => asStringList(raw['perks']);
  int? get foundedYear => asInt(raw['founded_year']);
  Map<String, dynamic> get socials => asObject(raw['socials']);
}

class BrandProfileSnapshot {
  final Map<String, dynamic> raw;
  const BrandProfileSnapshot(this.raw);

  String? get name => asString(raw['name']);
  String? get about => asString(raw['about']);
  String? get industry => asString(raw['industry']);
  String? get website => asString(raw['website']);
  String? get logoUrl => asString(raw['logo_url']);
  List<String> get photos => asStringList(raw['photos']);
  Map<String, dynamic> get socials => asObject(raw['socials']);
}

// ─── Card content ────────────────────────────────────────────────────────────

class JobCardContent {
  final Map<String, dynamic> raw;
  const JobCardContent(this.raw);

  String? get titleRaw => asString(raw['title']);
  String? get brandName => asString(raw['brand_name']);
  String? get description => asString(raw['description']);
  String? get cardType => asString(raw['card_type']);
  num? get packageMin => asNum(raw['package_min']);
  num? get packageMax => asNum(raw['package_max']);
  String? get packageCurrency => asString(raw['package_currency']);
  String? get packagePeriod => asString(raw['package_period']);
  String? get packageNotes => asString(raw['package_notes']);
  int? get openingsCount => asInt(raw['openings_count']);
  String? get expectedJoiningDate => asString(raw['expected_joining_date']);

  JobProfileSnapshot get jobProfile =>
      JobProfileSnapshot(asObject(raw['job_profile']));
  BusinessProfileSnapshot get businessProfile =>
      BusinessProfileSnapshot(asObject(raw['business_profile']));
  BrandProfileSnapshot? get brandProfile => raw['brand_profile'] is Map
      ? BrandProfileSnapshot(asObject(raw['brand_profile']))
      : null;

  /// Best available job title.
  String get jobTitle {
    final t = titleRaw;
    if (t != null) return t;
    return jobProfile.title ?? 'Job opening';
  }

  /// Best available business/brand name.
  String get businessName {
    final b = brandName;
    if (b != null) return b;
    return businessProfile.name ?? 'Business';
  }

  /// "₹15,000–₹20,000/mo" from the card package (falls back to the profile).
  String? get packageLabel {
    final min = packageMin ?? jobProfile.salaryMin;
    final max = packageMax ?? jobProfile.salaryMax;
    final currency = packageCurrency ?? jobProfile.salaryCurrency;
    final period = packagePeriod ?? jobProfile.salaryPeriod;
    return formatSalaryRange(min, max, currency, period);
  }

  String? get employmentType => jobProfile.employmentType;
  String? get workMode => jobProfile.workMode;
  String? get locationLabel => jobProfile.location?.shortLabel;
}

// ─── Feed card + item ────────────────────────────────────────────────────────

class JobFeedCard {
  final String id;
  final String? externalId;
  final JobCardContent content;
  final String status;
  final String? publishedAt;
  final String? expiresAt;

  const JobFeedCard({
    required this.id,
    this.externalId,
    required this.content,
    required this.status,
    this.publishedAt,
    this.expiresAt,
  });

  factory JobFeedCard.fromJson(Map<String, dynamic> json) => JobFeedCard(
        id: json['id'] as String,
        externalId: asString(json['external_id']),
        content: JobCardContent(asObject(json['content'])),
        status: asString(json['status']) ?? 'published',
        publishedAt: asString(json['published_at']),
        expiresAt: asString(json['expires_at']),
      );
}

class TalentJobFeedItem {
  final String? recipientId;
  final String? candidateId;
  final String? funnelStage;
  final String? stageChangedAt;
  final String? jobProfileId;
  final JobFeedCard? card;

  const TalentJobFeedItem({
    this.recipientId,
    this.candidateId,
    this.funnelStage,
    this.stageChangedAt,
    this.jobProfileId,
    this.card,
  });

  factory TalentJobFeedItem.fromJson(Map<String, dynamic> json) =>
      TalentJobFeedItem(
        recipientId: asString(json['recipient_id']),
        candidateId: asString(json['candidate_id']),
        funnelStage: asString(json['funnel_stage']),
        stageChangedAt: asString(json['stage_changed_at']),
        jobProfileId: asString(json['job_profile_id']),
        card: json['card'] is Map
            ? JobFeedCard.fromJson(asObject(json['card']))
            : null,
      );

  /// `new`-tab cards are un-applied recipients (no candidate row yet).
  bool get isNew => candidateId == null;
}

// ─── Candidate + detail ──────────────────────────────────────────────────────

class JobCandidate {
  final String id;
  final String recipientId;
  final String cardId;
  final String jobProfileId;
  final String funnelStage;
  final String? stageChangedAt;
  final String? rejectedReason;
  final String? hiredAt;
  final bool? keepCardOpen;
  final String? joiningDate;
  final String? joinedAt;
  final String? createdAt;

  const JobCandidate({
    required this.id,
    required this.recipientId,
    required this.cardId,
    required this.jobProfileId,
    required this.funnelStage,
    this.stageChangedAt,
    this.rejectedReason,
    this.hiredAt,
    this.keepCardOpen,
    this.joiningDate,
    this.joinedAt,
    this.createdAt,
  });

  factory JobCandidate.fromJson(Map<String, dynamic> json) => JobCandidate(
        id: json['id'] as String,
        recipientId: asString(json['recipient_id']) ?? '',
        cardId: asString(json['card_id']) ?? '',
        jobProfileId: asString(json['job_profile_id']) ?? '',
        funnelStage: asString(json['funnel_stage']) ?? 'applied',
        stageChangedAt: asString(json['stage_changed_at']),
        rejectedReason: asString(json['rejected_reason']),
        hiredAt: asString(json['hired_at']),
        keepCardOpen: json['keep_card_open'] is bool
            ? json['keep_card_open'] as bool
            : null,
        joiningDate: asString(json['joining_date']),
        joinedAt: asString(json['joined_at']),
        createdAt: asString(json['created_at']),
      );
}

class JobRecipientRef {
  final String id;
  final String status; // pending | accepted | rejected
  final String? respondedAt;
  final String? cancelledAt;
  final String? createdAt;

  const JobRecipientRef({
    required this.id,
    required this.status,
    this.respondedAt,
    this.cancelledAt,
    this.createdAt,
  });

  factory JobRecipientRef.fromJson(Map<String, dynamic> json) =>
      JobRecipientRef(
        id: json['id'] as String,
        status: asString(json['status']) ?? 'pending',
        respondedAt: asString(json['responded_at']),
        cancelledAt: asString(json['cancelled_at']),
        createdAt: asString(json['created_at']),
      );

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
  bool get isRejected => status == 'rejected';
  bool get isWithdrawnBySelf => cancelledAt != null;
}

class TalentJobDetail {
  final JobRecipientRef recipient;
  final JobCandidate? candidate;
  final String? jobProfileId;
  final JobFeedCard? card;

  const TalentJobDetail({
    required this.recipient,
    this.candidate,
    this.jobProfileId,
    this.card,
  });

  factory TalentJobDetail.fromJson(Map<String, dynamic> json) => TalentJobDetail(
        recipient: JobRecipientRef.fromJson(asObject(json['recipient'])),
        candidate: json['candidate'] is Map
            ? JobCandidate.fromJson(asObject(json['candidate']))
            : null,
        jobProfileId: asString(json['job_profile_id']),
        card: json['card'] is Map
            ? JobFeedCard.fromJson(asObject(json['card']))
            : null,
      );

  bool get hasApplied => candidate != null;
}
