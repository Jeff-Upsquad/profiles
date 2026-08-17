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

  String _when(String? iso) {
    final d = DateTime.tryParse(iso ?? '');
    if (d == null) return '';
    final diff = DateTime.now().difference(d.toLocal());
    if (diff.inSeconds < 60) return 'now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return formatDateShort(iso);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(conversationsListProvider);
    return ColoredBox(
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Text(
              'Chatroom',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.36,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          const Divider(height: 1, color: AppColors.border),
          Expanded(
            child: list.when(
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
                        itemCount: items.length,
                        separatorBuilder: (_, _) =>
                            const Divider(height: 1, color: Color(0xFFF0F0F0)),
                        itemBuilder: (_, i) {
                          final c = items[i];
                          final unread = c.unreadCount > 0;
                          final photo = c.business.photoUrl;
                          return InkWell(
                            onTap: () => context.push('/messages/${c.id}'),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 24,
                                    backgroundColor: AppColors.avatarFill,
                                    backgroundImage:
                                        photo != null && photo.isNotEmpty
                                            ? NetworkImage(photo)
                                            : null,
                                    child: photo == null || photo.isEmpty
                                        ? Text(
                                            c.business.name.isEmpty
                                                ? 'B'
                                                : c.business.name[0].toUpperCase(),
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.textPrimary,
                                            ),
                                          )
                                        : null,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                c.business.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 15,
                                                  fontWeight: unread
                                                      ? FontWeight.w600
                                                      : FontWeight.w500,
                                                  color: AppColors.textPrimary,
                                                ),
                                              ),
                                            ),
                                            Text(
                                              _when(c.lastMessageAt),
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: unread
                                                    ? AppColors.textPrimary
                                                    : AppColors.textMuted,
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                _preview(c),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                  fontSize: 13,
                                                  fontWeight: unread
                                                      ? FontWeight.w500
                                                      : FontWeight.w400,
                                                  color: unread
                                                      ? const Color(0xFF262626)
                                                      : AppColors.textTertiary,
                                                ),
                                              ),
                                            ),
                                            if (unread) ...[
                                              const SizedBox(width: 8),
                                              CountBadge(c.unreadCount),
                                            ],
                                          ],
                                        ),
                                        if ((c.cardTitle ?? '').isNotEmpty)
                                          Padding(
                                            padding: const EdgeInsets.only(top: 2),
                                            child: Text(
                                              c.cardTitle!,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
