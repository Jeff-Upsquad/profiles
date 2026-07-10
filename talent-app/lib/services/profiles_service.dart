import '../core/json.dart';
import '../models/profile_extras.dart';
import '../models/talent_profile.dart';
import 'api_client.dart';

/// Talent job profiles — `/talent/profiles` (CRUD + portfolio), category
/// templates from `/public/categories/*`, and the creation training gate.
class ProfilesService {
  final ApiClient _client;
  ProfilesService(this._client);

  // ─── Profiles ──────────────────────────────────────────────────────────────

  Future<List<TalentProfile>> list() async {
    final r = await _client.dio.get('/talent/profiles');
    return _unwrapList(r.data, 'profiles').map(TalentProfile.fromJson).toList();
  }

  Future<TalentProfile> get(String id) async {
    final r = await _client.dio.get('/talent/profiles/$id');
    return TalentProfile.fromJson(_unwrapObj(r.data, 'profile'));
  }

  Future<TalentProfile> create(String categoryId, Map<String, dynamic> fieldData) async {
    final r = await _client.dio.post('/talent/profiles', data: {
      'category_id': categoryId,
      'field_data': fieldData,
    });
    return TalentProfile.fromJson(_unwrapObj(r.data, 'profile'));
  }

  Future<TalentProfile> update(String id, Map<String, dynamic> fieldData) async {
    final r = await _client.dio.put('/talent/profiles/$id', data: {'field_data': fieldData});
    return TalentProfile.fromJson(_unwrapObj(r.data, 'profile'));
  }

  Future<void> submit(String id) async {
    await _client.dio.patch('/talent/profiles/$id/submit');
  }

  Future<void> deactivate(String id) async {
    await _client.dio.patch('/talent/profiles/$id/deactivate');
  }

  Future<void> reactivate(String id) async {
    await _client.dio.patch('/talent/profiles/$id/reactivate');
  }

  Future<void> delete(String id) async {
    await _client.dio.delete('/talent/profiles/$id');
  }

  // ─── Categories, gate, templates ────────────────────────────────────────────

  Future<List<ProfileCategory>> creatableCategories() async {
    final r = await _client.dio.get('/talent/profile-categories');
    return _unwrapList(r.data, 'categories').map(ProfileCategory.fromJson).toList();
  }

  Future<ProfileGate> profileGate(String categoryId) async {
    final r = await _client.dio.get('/talent/training/profile-gate/$categoryId');
    return ProfileGate.fromJson(asObject(r.data));
  }

  /// [kind] is 'skills' | 'tools' | 'ai-tools' | 'portfolio-categories'.
  Future<List<TemplateItem>> templates(String categoryId, String kind) async {
    final r = await _client.dio.get('/public/categories/$categoryId/$kind');
    const keyFor = {
      'skills': 'skills',
      'tools': 'tools',
      'ai-tools': 'ai_tools',
      'portfolio-categories': 'portfolio_categories',
    };
    return asObjectList(asObject(r.data)[keyFor[kind]]).map(TemplateItem.fromJson).toList();
  }

  // ─── Portfolio ──────────────────────────────────────────────────────────────

  Future<List<PortfolioItem>> portfolio(String profileId) async {
    final r = await _client.dio.get('/talent/profiles/$profileId/portfolio');
    return _unwrapList(r.data, 'items').map(PortfolioItem.fromJson).toList();
  }

  Future<void> addPortfolioUpload(
    String profileId, {
    required String fileUrl,
    required String fileType,
    required String fileName,
    String? categoryName,
  }) async {
    await _client.dio.post('/talent/profiles/$profileId/portfolio', data: {
      'skill_name': categoryName ?? fileName,
      'category_name': ?categoryName,
      'skill_names': const [],
      'file_url': fileUrl,
      'file_type': fileType,
      'file_name': fileName,
    });
  }

  Future<void> addPortfolioLink(
    String profileId, {
    required String embedUrl,
    required String externalUrl,
    String? categoryName,
  }) async {
    await _client.dio.post('/talent/profiles/$profileId/portfolio', data: {
      'skill_name': categoryName ?? 'YouTube video',
      'category_name': ?categoryName,
      'skill_names': const [],
      'file_url': embedUrl,
      'file_type': 'video',
      'file_name': 'YouTube video',
      'source_type': 'link',
      'provider': 'youtube',
      'external_url': externalUrl,
      'embed_url': embedUrl,
    });
  }

  Future<void> deletePortfolio(String profileId, String itemId) async {
    await _client.dio.delete('/talent/profiles/$profileId/portfolio/$itemId');
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  List<Map<String, dynamic>> _unwrapList(dynamic data, String key) {
    final raw = data is Map ? (data[key] ?? data) : data;
    return asObjectList(raw);
  }

  Map<String, dynamic> _unwrapObj(dynamic data, String key) {
    final map = asObject(data);
    return map[key] is Map ? asObject(map[key]) : map;
  }
}
