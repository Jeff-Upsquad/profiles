import '../core/json.dart';
import '../models/training.dart';
import 'api_client.dart';

/// Training program — `/talent/training/*`.
class TrainingService {
  final ApiClient _client;
  TrainingService(this._client);

  Future<MyTraining> getMyTraining() async {
    final r = await _client.dio.get('/talent/training');
    return MyTraining.fromJson(asObject(r.data));
  }

  Future<ModuleAccess> moduleAccess() async {
    final r = await _client.dio.get('/talent/training/module-access');
    return ModuleAccess.fromJson(asObject(r.data));
  }

  Future<int> incompleteCount() async {
    final r = await _client.dio.get('/talent/training/incomplete-count');
    return asInt(asObject(r.data)['incomplete_count']) ?? 0;
  }

  Future<void> startCourse(String courseId) async {
    await _client.dio.post('/talent/training/courses/$courseId/start');
  }

  Future<void> requestReopen(String courseId, {String? reason}) async {
    await _client.dio.post(
      '/talent/training/courses/$courseId/request-reopen',
      data: {'reason': ?reason},
    );
  }

  Future<void> markLessonComplete(String lessonId) async {
    await _client.dio.post('/talent/training/lessons/$lessonId/complete');
  }

  Future<void> markLessonIncomplete(String lessonId) async {
    await _client.dio.delete('/talent/training/lessons/$lessonId/complete');
  }

  Future<void> completeOnboarding() async {
    await _client.dio.post('/talent/training/complete-onboarding');
  }
}
