import '../core/json.dart';

/// A talent "job profile" (per-category portfolio of skills). Mirrors the web
/// `Profile` type (src/types/index.ts). `field_data` holds the dynamic
/// category-specific fields.
class ProfileCategory {
  final String id;
  final String name;
  final String? slug;

  const ProfileCategory({required this.id, required this.name, this.slug});

  factory ProfileCategory.fromJson(Map<String, dynamic> json) => ProfileCategory(
        id: asString(json['id']) ?? '',
        name: asString(json['name']) ?? 'Profile',
        slug: asString(json['slug']),
      );
}

class TalentProfile {
  final String id;
  final String? categoryId;
  final ProfileCategory? category;
  final String status; // draft | pending | approved | rejected | inactive
  final Map<String, dynamic> fieldData;
  final String? rejectionReason;
  final String? submittedAt;
  final String? reviewedAt;
  final String? createdAt;
  final String? updatedAt;
  final bool isGhost;
  final String? tier;

  const TalentProfile({
    required this.id,
    this.categoryId,
    this.category,
    required this.status,
    this.fieldData = const {},
    this.rejectionReason,
    this.submittedAt,
    this.reviewedAt,
    this.createdAt,
    this.updatedAt,
    this.isGhost = false,
    this.tier,
  });

  factory TalentProfile.fromJson(Map<String, dynamic> json) => TalentProfile(
        id: json['id'] as String,
        categoryId: asString(json['category_id']),
        category: json['category'] is Map
            ? ProfileCategory.fromJson(asObject(json['category']))
            : null,
        status: asString(json['status']) ?? 'draft',
        fieldData: asObject(json['field_data']),
        rejectionReason: asString(json['rejection_reason']),
        submittedAt: asString(json['submitted_at']),
        reviewedAt: asString(json['reviewed_at']),
        createdAt: asString(json['created_at']),
        updatedAt: asString(json['updated_at']),
        isGhost: asBool(json['is_ghost']),
        tier: asString(json['tier']),
      );

  String get displayName =>
      category?.name ?? asString(fieldData['title']) ?? 'Profile';

  bool get isApproved => status == 'approved';
  bool get isPending => status == 'pending';
  bool get isDraft => status == 'draft';
  bool get isRejected => status == 'rejected';
  bool get isInactive => status == 'inactive' || status == 'paused';
}
