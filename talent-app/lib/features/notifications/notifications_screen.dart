import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/deep_links.dart';
import '../../core/format.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../models/notification_item.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  String _tab = 'unread';

  Future<void> _markAllRead() async {
    try {
      await ref.read(notificationsServiceProvider).markAllRead();
      ref.invalidate(notificationsProvider);
      ref.invalidate(unreadNotificationsProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not mark all as read')),
        );
      }
    }
  }

  Future<void> _open(NotificationItem n) async {
    if (!n.read) {
      ref.read(notificationsServiceProvider).markRead(n.id).then((_) {
        ref.invalidate(notificationsProvider);
        ref.invalidate(unreadNotificationsProvider);
      }).catchError((_) {});
    }
    final route = mapNotificationRoute(n.linkUrl);
    if (route != null && mounted) context.push(route);
  }

  @override
  Widget build(BuildContext context) {
    final notifs = ref.watch(notificationsProvider);
    final unread = notifs.value?.where((n) => !n.read).length ?? 0;

    return ColoredBox(
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              children: [
                HeroCard(
                  eyebrow: unread > 0
                      ? '$unread unread'
                      : 'All caught up',
                  title: 'Notifications',
                  titleHighlight: '.',
                  subtitle: 'Updates about your jobs, offers and profiles.',
                  trailing: TextButton(
                    onPressed: _markAllRead,
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.textPrimary,
                      backgroundColor: Colors.white,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('Mark all read', style: TextStyle(fontSize: 12)),
                  ),
                ),
                const SizedBox(height: 12),
                InkSegmentedTabs(
                  tabs: [
                    SegmentTab(key: 'unread', label: 'Unread', count: unread),
                    SegmentTab(key: 'all', label: 'All', count: notifs.value?.length ?? 0),
                    SegmentTab(
                      key: 'read',
                      label: 'Read',
                      count: (notifs.value?.length ?? 0) - unread,
                    ),
                  ],
                  activeKey: _tab,
                  onChange: (k) => setState(() => _tab = k),
                ),
              ],
            ),
          ),
          Expanded(
            child: notifs.when(
              loading: () => const ShimmerCardList(),
              error: (_, _) => AppErrorRetry(
                onRetry: () => ref.invalidate(notificationsProvider),
              ),
              data: (items) {
                final visible = switch (_tab) {
                  'unread' => items.where((n) => !n.read).toList(),
                  'read' => items.where((n) => n.read).toList(),
                  _ => items,
                };
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(notificationsProvider);
                    ref.invalidate(unreadNotificationsProvider);
                    await ref.read(notificationsProvider.future);
                  },
                  child: visible.isEmpty
                      ? ListView(
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 80),
                              child: EmptyState(
                                icon: Icons.notifications_none,
                                title: _tab == 'unread'
                                    ? 'All caught up'
                                    : 'No notifications',
                                subtitle: _tab == 'unread'
                                    ? "You've read everything."
                                    : 'Updates about your jobs, offers and profiles will appear here.',
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: visible.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 12),
                          itemBuilder: (_, i) => _NotificationTile(
                            item: visible[i],
                            onTap: () => _open(visible[i]),
                          ),
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  final NotificationItem item;
  final VoidCallback onTap;
  const _NotificationTile({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!item.read)
                    Container(
                      margin: const EdgeInsets.only(top: 6, right: 10),
                      width: 6,
                      height: 6,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  Expanded(
                    child: Text(
                      item.title,
                      style: TextStyle(
                        color: item.read
                            ? AppColors.textSecondary
                            : AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight:
                            item.read ? FontWeight.w500 : FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    timeAgo(item.createdAt),
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                ],
              ),
              if ((item.body ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  item.body!,
                  style: TextStyle(
                    color: item.read
                        ? AppColors.textTertiary
                        : const Color(0xFF404040),
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ],
              for (final m in item.media) ...[
                const SizedBox(height: 10),
                _Media(media: m),
              ],
              if (item.isClickable) ...[
                const SizedBox(height: 8),
                const Text(
                  'View',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _Media extends StatelessWidget {
  final NotificationMedia media;
  const _Media({required this.media});

  @override
  Widget build(BuildContext context) {
    if (media.isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          media.url,
          height: 160,
          width: double.infinity,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const SizedBox.shrink(),
        ),
      );
    }
    final isVideo = media.isLoom;
    return OutlinedButton.icon(
      onPressed: () => openExternalUrl(media.url),
      icon: Icon(isVideo ? Icons.play_circle_outline : Icons.picture_as_pdf_outlined, size: 18),
      label: Text(isVideo ? 'Watch video' : (media.name ?? 'Open PDF')),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerLeft,
        minimumSize: const Size(double.infinity, 44),
      ),
    );
  }
}
