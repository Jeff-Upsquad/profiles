import '../core/json.dart';

/// A template option for a category (skill / tool / AI tool / portfolio genre).
class TemplateItem {
  final String id;
  final String name;
  final String? group;

  const TemplateItem({required this.id, required this.name, this.group});

  factory TemplateItem.fromJson(Map<String, dynamic> json) => TemplateItem(
        id: asString(json['id']) ?? '',
        name: asString(json['name']) ?? '',
        group: asString(json['group']),
      );
}

/// Result of the per-category training gate on profile creation.
class ProfileGate {
  final bool locked;
  final String? chapterTitle;

  const ProfileGate({this.locked = false, this.chapterTitle});

  factory ProfileGate.fromJson(Map<String, dynamic> json) => ProfileGate(
        locked: asBool(json['locked']),
        chapterTitle: asString(asObject(json['chapter'])['title']),
      );
}

/// A leveled item stored in `field_data` (skills/tools/ai_tools/categories).
/// The inner name key varies by field (`skill`, `category`, or `name`).
class LeveledItem {
  final String name;
  final int level;

  const LeveledItem({required this.name, this.level = 3});

  static LeveledItem fromJson(Map<String, dynamic> json, String innerKey) => LeveledItem(
        name: asString(json[innerKey]) ?? asString(json['name']) ?? '',
        level: (asInt(json['level']) ?? 3).clamp(1, 5),
      );

  Map<String, dynamic> toJson(String innerKey) => {innerKey: name, 'level': level};
}

const List<String> kLevelLabels = [
  'Learning',
  'Beginner',
  'Intermediate',
  'Advanced',
  'Expert',
];

class PortfolioItem {
  final String id;
  final String fileUrl;
  final String fileType; // image | pdf | video
  final String? fileName;
  final String? categoryName;
  final List<String> skills;
  final String? sourceType; // upload | link
  final String? provider;
  final String? externalUrl;
  final String? embedUrl;
  final String? thumbnailUrl;

  const PortfolioItem({
    required this.id,
    required this.fileUrl,
    required this.fileType,
    this.fileName,
    this.categoryName,
    this.skills = const [],
    this.sourceType,
    this.provider,
    this.externalUrl,
    this.embedUrl,
    this.thumbnailUrl,
  });

  factory PortfolioItem.fromJson(Map<String, dynamic> json) => PortfolioItem(
        id: json['id'] as String,
        fileUrl: asString(json['file_url']) ?? '',
        fileType: asString(json['file_type']) ?? 'image',
        fileName: asString(json['file_name']),
        categoryName: asString(json['category_name']),
        skills: asStringList(json['skills']),
        sourceType: asString(json['source_type']),
        provider: asString(json['provider']),
        externalUrl: asString(json['external_url']),
        embedUrl: asString(json['embed_url']),
        thumbnailUrl: asString(json['thumbnail_url']),
      );

  bool get isImage => fileType == 'image';
  bool get isVideo => fileType == 'video';
  bool get isPdf => fileType == 'pdf';
}
