import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/conversation.dart';
import '../../providers/conversations_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';

class MessagesInboxScreen extends ConsumerWidget {
  const MessagesInboxScreen({super.key});

  String _preview(IntroConversation c) {
    final last = c.lastMessage;
    if (last == null) return 'No messages yet';
    if (last.kind == 'meeting') return 'Meeting update';
    return last.body ?? 'Update';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(conversationsListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Chatroom')),
      body: list.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(conversationsListProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(conversationsListProvider);
            ref.invalidate(conversationsUnreadProvider);
            await ref.read(conversationsListProvider.future);
          },
          child: items.isEmpty
              ? ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: EmptyState(
                        icon: Icons.chat_bubble_outline,
                        title: 'No chatrooms yet',
                        subtitle:
                            'A business will open one after they shortlist you. An UpSquad teammate is always in the room.',
                      ),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, i) {
                    final c = items[i];
                    return Card(
                      clipBehavior: Clip.antiAlias,
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        leading: CircleAvatar(
                          backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                          child: Text(
                            c.business.name.isEmpty
                                ? 'B'
                                : c.business.name[0].toUpperCase(),
                            style: const TextStyle(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        title: Text(
                          c.business.name,
                          style: TextStyle(
                            fontWeight: c.unreadCount > 0
                                ? FontWeight.w700
                                : FontWeight.w600,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              [
                                c.cardTitle ?? 'Intro room',
                                c.salesperson?.name ?? 'UpSquad joining',
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: AppColors.textTertiary,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _preview(c),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: c.unreadCount > 0
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (c.lastMessageAt != null)
                              Text(
                                formatDateTime(c.lastMessageAt),
                                style: const TextStyle(
                                  color: AppColors.textTertiary,
                                  fontSize: 11,
                                ),
                              ),
                            if (c.unreadCount > 0) ...[
                              const SizedBox(height: 6),
                              Pill(
                                label: '${c.unreadCount}',
                                variant: BadgeVariant.indigo,
                              ),
                            ],
                          ],
                        ),
                        onTap: () => context.push('/messages/${c.id}'),
                      ),
                    );
                  },
                ),
        ),
      ),
    );
  }
}
