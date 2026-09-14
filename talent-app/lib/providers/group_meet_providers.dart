import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/group_meet.dart';
import '../services/group_meets_service.dart';
import 'providers.dart';

final groupMeetsServiceProvider = Provider((ref) => GroupMeetsService(ref.watch(apiClientProvider)));
final groupMeetProvider = FutureProvider.autoDispose.family<GroupMeet, String>((ref, id) => ref.watch(groupMeetsServiceProvider).get(id));
