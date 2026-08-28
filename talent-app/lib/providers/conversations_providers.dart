import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/conversation.dart';
import '../services/conversations_service.dart';
import 'providers.dart';

final conversationsServiceProvider =
    Provider((ref) => ConversationsService(ref.watch(apiClientProvider)));

String _convPrefixRead(Ref ref) {
  return ref.read(authProvider).user?.isAgency == true ? '/agency' : '/talent';
}

final conversationsListProvider =
    FutureProvider.autoDispose<List<IntroConversation>>((ref) async {
  return ref.watch(conversationsServiceProvider).list(prefix: _convPrefixRead(ref));
});

final conversationsUnreadProvider = FutureProvider.autoDispose<int>((ref) async {
  return ref.watch(conversationsServiceProvider).unreadCount(prefix: _convPrefixRead(ref));
});

final conversationDetailProvider =
    FutureProvider.autoDispose.family<IntroConversation, String>((ref, id) async {
  return ref.watch(conversationsServiceProvider).get(id, prefix: _convPrefixRead(ref));
});

final conversationMessagesProvider =
    FutureProvider.autoDispose.family<List<IntroMessage>, String>((ref, id) async {
  return ref.watch(conversationsServiceProvider).messages(id, prefix: _convPrefixRead(ref));
});
