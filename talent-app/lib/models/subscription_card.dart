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
  /// Public R2 URL of the client's recorded requirement voice note (optional).
  String? get requirementVoiceUrl {
    final v = content['requirement_voice_url'] as String?;
    if (v != null && v.trim().isNotEmpty) return v.trim();
    return null;
  }
  String? get priceLabel => content['price_label'] as String?;
  String? get notes => content['notes'] as String?;
  String? get ctaLabel => content['cta_label'] as String?;
  String? get currency => content['currency'] as String?;

  /// Partner (talent) price. If margin fields are present, compute from the
  /// business budget so the talent always sees their actual pay, regardless of
  /// what was stamped into `monthly_price` by the upstream system.
  num? get monthlyPrice {
    // Business-side budget (what the client pays).
    final businessPrice = (content['customer_monthly_price'] as num?) ??
        (content['proposed_price'] as num?);
    if (businessPrice != null && businessPrice > 0) {
      final margin = _resolveMargin(businessPrice);
      final partner = (businessPrice - margin).round();
      return partner > 0 ? partner : content['monthly_price'] as num?;
    }
    return content['monthly_price'] as num?;
  }

  /// Compute the absolute margin amount from the card's margin fields.
  num _resolveMargin(num businessBase) {
    final marginType = content['margin_type'] == 'percent' ? 'percent' : 'fixed';
    final marginValue = content['margin_value'] as num?;

    if (marginType == 'percent' && marginValue != null && businessBase > 0) {
      // Ceiling to nearest 100, matching the backend ceilToHundred helper.
      final raw = (businessBase * marginValue) / 100;
      return (raw / 100).ceil() * 100;
    }

    final marginAmount = content['margin_amount'] as num?;
    if (marginAmount != null && marginAmount >= 0) return marginAmount;

    if (marginType == 'fixed' && marginValue != null && marginValue >= 0) {
      return marginValue;
    }

    // Fallback: customer - partner gap.
    final customer = content['customer_monthly_price'] as num?;
    final partner = content['monthly_price'] as num?;
    if (customer != null && partner != null && customer >= partner) {
      return customer - partner;
    }

    return 0;
  }
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
