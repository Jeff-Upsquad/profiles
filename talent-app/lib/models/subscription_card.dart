class SubscriptionCard {
  final String id;
  final String externalId;
  final Map<String, dynamic> content;
  final String status;
  final String publishedAt;
  final String? expiresAt;
  /// Product line — 'subscription' (default) or 'assignment'. Both types share
  /// the same feed; the UI tags each card with this so they're distinguishable.
  final String cardType;

  SubscriptionCard({
    required this.id,
    required this.externalId,
    required this.content,
    required this.status,
    required this.publishedAt,
    this.expiresAt,
    this.cardType = 'subscription',
  });

  factory SubscriptionCard.fromJson(Map<String, dynamic> json) {
    final content = (json['content'] as Map<String, dynamic>?) ?? {};
    return SubscriptionCard(
      id: json['id'] as String,
      externalId: json['external_id'] as String,
      content: content,
      status: json['status'] as String,
      publishedAt: json['published_at'] as String,
      expiresAt: json['expires_at'] as String?,
      // Prefer the top-level column; fall back to the value SquadHub also
      // stamps into content; default to subscription for legacy payloads.
      cardType: (json['card_type'] as String?) ??
          (content['card_type'] as String?) ??
          'subscription',
    );
  }

  bool get isAssignment => cardType == 'assignment';
  Map<String, dynamic> get assignmentDetails =>
      (content['assignment_details'] as Map<String, dynamic>?) ?? const {};
  String? get assignmentDuration => assignmentDetails['duration'] as String?;
  String? get assignmentStartDate => assignmentDetails['start_date'] as String?;
  String? get assignmentDeadline => assignmentDetails['deadline'] as String?;

  String? get title => content['title'] as String?;
  String? get description => content['description'] as String?;
  String? get imageUrl => content['imageUrl'] as String?;
  bool get isPopular => content['is_popular'] == true;
  /// Content-level expiry the web renders as a relative "Expires …" line.
  String? get contentExpiresAt => content['expiresAt'] as String?;
  String? get brandName => content['brand_name'] as String?;
  String? get planName => content['plan_name'] as String?;
  String? get subscriptionName => content['subscription_name'] as String?;
  String? get businessNature => content['business_nature'] as String?;
  String? get customerLocation => content['customer_location'] as String?;
  String? get hoursLabel => content['hours_label'] as String?;
  String? get capacityLabel => content['capacity_label'] as String?;
  /// Prefer deliverables_label (SquadHub maps requirement_note here).
  String? get deliverablesLabel {
    final label = content['deliverables_label'] as String?;
    if (label != null && label.trim().isNotEmpty) return label;
    final req = content['requirement_note'] as String?;
    if (req != null && req.trim().isNotEmpty) return req;
    return label;
  }
  String? get priceLabel => content['price_label'] as String?;
  String? get notes => content['notes'] as String?;
  String? get ctaLabel => content['cta_label'] as String?;
  num? get monthlyPrice => content['monthly_price'] as num?;
  String? get currency => content['currency'] as String?;
  List<dynamic>? get customDeliverables =>
      content['custom_deliverables'] as List<dynamic>?;
  List<dynamic>? get workingDays =>
      content['working_days'] as List<dynamic>?;
  List<dynamic>? get targetCountryNames =>
      content['target_country_names'] as List<dynamic>?;
  List<dynamic>? get targetLanguages =>
      content['target_languages'] as List<dynamic>?;
}

class SubscriptionCardRecipient {
  final String id;
  final String status;
  final String? respondedAt;
  final String? cancelledAt;
  final String? selectedAt;
  final String? passedOverAt;
  final SubscriptionCard? card;

  SubscriptionCardRecipient({
    required this.id,
    required this.status,
    this.respondedAt,
    this.cancelledAt,
    this.selectedAt,
    this.passedOverAt,
    this.card,
  });

  factory SubscriptionCardRecipient.fromJson(Map<String, dynamic> json) {
    return SubscriptionCardRecipient(
      id: json['id'] as String,
      status: json['status'] as String,
      respondedAt: json['responded_at'] as String?,
      cancelledAt: json['cancelled_at'] as String?,
      selectedAt: json['selected_at'] as String?,
      passedOverAt: json['passed_over_at'] as String?,
      card: json['card'] != null
          ? SubscriptionCard.fromJson(json['card'] as Map<String, dynamic>)
          : null,
    );
  }

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
  bool get isRejected => status == 'rejected';
  bool get isCancelled => cancelledAt != null;
  bool get isSelected => selectedAt != null;
  bool get isPassedOver => passedOverAt != null;
}
