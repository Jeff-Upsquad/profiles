class TalentMe {
  final String id;
  final String? email;
  final String? fullName;
  final bool isActive;
  final bool whatsappUpdatesEnabled;

  TalentMe({
    required this.id,
    this.email,
    this.fullName,
    required this.isActive,
    required this.whatsappUpdatesEnabled,
  });

  factory TalentMe.fromJson(Map<String, dynamic> json) {
    return TalentMe(
      id: json['id'] as String,
      email: json['email'] as String?,
      fullName: json['full_name'] as String?,
      // Absent → treat as active (don't block actions on missing data).
      isActive: json['is_active'] != false,
      // DB default is TRUE; only an explicit false disables.
      whatsappUpdatesEnabled: json['whatsapp_subscription_updates_enabled'] != false,
    );
  }
}
