import '../core/json.dart';
import '../models/job_offer.dart';
import 'api_client.dart';

/// Job offers — `/api/talent/jobs/offers` (offers.service.ts on the backend).
class OffersService {
  final ApiClient _client;
  OffersService(this._client);

  Future<List<JobOffer>> list() async {
    final r = await _client.dio.get('/talent/jobs/offers');
    return asObjectList(asObject(r.data)['offers'])
        .map(JobOffer.fromJson)
        .toList();
  }

  Future<OfferDetail> detail(String offerId) async {
    final r = await _client.dio.get('/talent/jobs/offers/$offerId');
    return OfferDetail.fromJson(asObject(r.data));
  }

  /// Respond to an offer. [action] is 'accept' | 'decline' | 'negotiate'.
  /// For 'negotiate', pass the proposed monthly [amount] and an optional [note].
  Future<void> respond(
    String offerId,
    String action, {
    num? amount,
    String? note,
  }) async {
    await _client.dio.post(
      '/talent/jobs/offers/$offerId/respond',
      data: {
        'action': action,
        'amount': ?amount,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
  }

  Future<void> askQuestion(String offerId, String question) async {
    await _client.dio.post(
      '/talent/jobs/offers/$offerId/questions',
      data: {'question': question},
    );
  }
}
