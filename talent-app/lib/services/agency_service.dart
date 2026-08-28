import 'api_client.dart';

/// Minimal agency API mirroring `frontend/src/services/agency-api.ts`.
/// Endpoints are agency-scoped and require `role: agency`.
class AgencyService {
  final ApiClient _client;
  AgencyService(this._client);

  Future<Map<String, dynamic>> getMe() async {
    final res = await _client.dio.get('/agency/me');
    final data = res.data;
    if (data is Map && data['data'] != null) {
      return Map<String, dynamic>.from(data['data'] as Map);
    }
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<dynamic>> listSquad() async {
    final res = await _client.dio.get('/agency/squad');
    return _unwrapList(res.data);
  }

  Future<List<dynamic>> listMemberProfiles() async {
    final res = await _client.dio.get('/agency/member-profiles');
    return _unwrapList(res.data);
  }

  Future<List<dynamic>> listGeneralPortfolios() async {
    final res = await _client.dio.get('/agency/general-portfolios');
    return _unwrapList(res.data);
  }

  Future<Map<String, dynamic>> getTotalPortfolio() async {
    final res = await _client.dio.get('/agency/total-portfolio');
    final data = res.data;
    if (data is Map && data['data'] is Map) {
      return Map<String, dynamic>.from(data['data'] as Map);
    }
    if (data is Map<String, dynamic>) return data;
    return {};
  }

  List<dynamic> _unwrapList(dynamic data) {
    if (data is Map && data['data'] is List) return data['data'] as List;
    if (data is List) return data;
    return [];
  }
}
