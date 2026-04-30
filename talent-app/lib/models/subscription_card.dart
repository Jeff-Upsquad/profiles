class SubscriptionCard {
  final String id;
  final String externalId;
  final Map<String, dynamic> content;
  final String status;
  final String publishedAt;
  final String? expiresAt;

  SubscriptionCard({
    required this.id,
    required this.externalId,
    required this.content,
    required this.status,
    required this.publishedAt,
    this.expiresAt,
  });

  factory SubscriptionCard.fromJson(Map<String, dynamic> json) {
    return SubscriptionCard(
      id: json['id'] as String,
      externalId: json['external_id'] as String,
      content: (json['content'] as Map<String, dynamic>?) ?? {},
      status: json['status'] as String,
      publishedAt: json['published_at'] as String,
      expiresAt: json['expires_at'] as String?,
    );
  }

  String? get title => content['title'] as String?;
  String? get brandName => content['brand_name'] as String?;
  String? get planName => content['plan_name'] as String?;
  String? get subscriptionName => content['subscription_name'] as String?;
  String? get businessNature => content['business_nature'] as String?;
  String? get hoursLabel => content['hours_label'] as String?;
  String? get capacityLabel => content['capacity_label'] as String?;
  String? get deliverablesLabel => content['deliverables_label'] as String?;
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
