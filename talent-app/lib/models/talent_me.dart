import '../core/json.dart';
import 'language_entry.dart';

/// The talent's own account record (`/talent/me`). Editable fields are surfaced
/// in Settings; `whatsappUpdatesEnabled` drives the notifications toggle.
class TalentMe {
  final String id;
  final String? email;
  final String? fullName;
  final String? phone;
  final int? age;
  final String? currentLocation;
  final String? nativePlace;
  final List<LanguageEntry> languagesSpoken;
  final bool isActive;
  final bool whatsappUpdatesEnabled;

  TalentMe({
    required this.id,
    this.email,
    this.fullName,
    this.phone,
    this.age,
    this.currentLocation,
    this.nativePlace,
    this.languagesSpoken = const [],
    required this.isActive,
    required this.whatsappUpdatesEnabled,
  });

  factory TalentMe.fromJson(Map<String, dynamic> json) {
    return TalentMe(
      id: json['id'] as String,
      email: asString(json['email']),
      fullName: asString(json['full_name']),
      phone: asString(json['phone']),
      age: asInt(json['age']),
      currentLocation: asString(json['current_location']),
      nativePlace: asString(json['native_place']),
      languagesSpoken:
          asObjectList(json['languages_spoken']).map(LanguageEntry.fromJson).toList(),
      // Absent → treat as active (don't block actions on missing data).
      isActive: json['is_active'] != false,
      // DB default is TRUE; only an explicit false disables.
      whatsappUpdatesEnabled: json['whatsapp_subscription_updates_enabled'] != false,
    );
  }
}
