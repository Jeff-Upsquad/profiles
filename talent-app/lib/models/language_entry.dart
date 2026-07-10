import '../core/json.dart';

/// A spoken language + proficiency. Mirrors the web `LanguageEntry`.
class LanguageEntry {
  final String language;
  final String proficiency;

  const LanguageEntry({required this.language, this.proficiency = 'fluent'});

  factory LanguageEntry.fromJson(Map<String, dynamic> json) => LanguageEntry(
        language: asString(json['language']) ?? '',
        proficiency: asString(json['proficiency']) ?? 'fluent',
      );

  Map<String, dynamic> toJson() => {
        'language': language,
        'proficiency': proficiency,
      };

  LanguageEntry copyWith({String? language, String? proficiency}) => LanguageEntry(
        language: language ?? this.language,
        proficiency: proficiency ?? this.proficiency,
      );
}
