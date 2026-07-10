import '../core/json.dart';

/// "My Clients" — subscription retainers the talent has been selected for or is
/// actively assigned to. Mirrors `MyClientsResponse` (src/hooks/useMyClients.ts).

class MyClientRow {
  final String recipientId;
  final String? cardId;
  final String? externalId;
  final String? selectedAt;
  final String? subscriptionActivatedAt;
  final String? brandName;
  final String? businessNature;
  final String? planName;
  final String? subscriptionName;
  final num? monthlyPrice;
  final String? currency;
  final String? priceLabel;
  final String? hoursLabel;
  final List<String> workingDays;
  final List<Map<String, dynamic>> customDeliverables;

  const MyClientRow({
    required this.recipientId,
    this.cardId,
    this.externalId,
    this.selectedAt,
    this.subscriptionActivatedAt,
    this.brandName,
    this.businessNature,
    this.planName,
    this.subscriptionName,
    this.monthlyPrice,
    this.currency,
    this.priceLabel,
    this.hoursLabel,
    this.workingDays = const [],
    this.customDeliverables = const [],
  });

  factory MyClientRow.fromJson(Map<String, dynamic> json) => MyClientRow(
        recipientId: asString(json['recipient_id']) ?? '',
        cardId: asString(json['card_id']),
        externalId: asString(json['external_id']),
        selectedAt: asString(json['selected_at']),
        subscriptionActivatedAt: asString(json['subscription_activated_at']),
        brandName: asString(json['brand_name']),
        businessNature: asString(json['business_nature']),
        planName: asString(json['plan_name']),
        subscriptionName: asString(json['subscription_name']),
        monthlyPrice: asNum(json['monthly_price']),
        currency: asString(json['currency']),
        priceLabel: asString(json['price_label']),
        hoursLabel: asString(json['hours_label']),
        workingDays: asStringList(json['working_days']),
        customDeliverables: asObjectList(json['custom_deliverables']),
      );

  String get displayName => brandName ?? subscriptionName ?? planName ?? 'Client';
  bool get isActive => subscriptionActivatedAt != null;
}

class MyClientsData {
  final List<MyClientRow> selected;
  final List<MyClientRow> assigned;
  final num monthlyEarnings;
  final String earningsCurrency;
  final num hoursPerWeek;
  final num hoursPerMonth;

  const MyClientsData({
    this.selected = const [],
    this.assigned = const [],
    this.monthlyEarnings = 0,
    this.earningsCurrency = 'INR',
    this.hoursPerWeek = 0,
    this.hoursPerMonth = 0,
  });

  factory MyClientsData.fromJson(Map<String, dynamic> json) {
    final earnings = asObject(json['earnings']);
    final commitment = asObject(json['commitment']);
    return MyClientsData(
      selected: asObjectList(json['selected']).map(MyClientRow.fromJson).toList(),
      assigned: asObjectList(json['assigned']).map(MyClientRow.fromJson).toList(),
      monthlyEarnings: asNum(earnings['monthly_total']) ?? 0,
      earningsCurrency: asString(earnings['currency']) ?? 'INR',
      hoursPerWeek: asNum(commitment['hours_per_week']) ?? 0,
      hoursPerMonth: asNum(commitment['hours_per_month']) ?? 0,
    );
  }

  bool get isEmpty => selected.isEmpty && assigned.isEmpty;
}
