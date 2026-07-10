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
  bool _unreadOnly = false;

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
      // Optimistic: fire the mark-read and refresh badges.
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
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  selected: !_unreadOnly,
                  onTap: () => setState(() => _unreadOnly = false),
                ),
                const SizedBox(width: 8),
                _FilterChip(
                  label: 'Unread',
                  selected: _unreadOnly,
                  onTap: () => setState(() => _unreadOnly = true),
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
                final visible =
                    _unreadOnly ? items.where((n) => !n.read).toList() : items;
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
                                title: _unreadOnly ? 'All caught up' : 'No notifications',
                                subtitle: _unreadOnly
                                    ? "You've read everything."
                                    : "Updates about your jobs, offers and profiles will appear here.",
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: visible.length,
                          separatorBuilder: (_, _) => const SizedBox(height: 10),
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

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
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
    return Card(
      clipBehavior: Clip.antiAlias,
      color: item.read ? AppColors.card : const Color(0xFFF5F3FF),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!item.read)
                    Container(
                      margin: const EdgeInsets.only(top: 5, right: 8),
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                    ),
                  Expanded(
                    child: Text(
                      item.title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: item.read ? FontWeight.w600 : FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    timeAgo(item.createdAt),
                    style: const TextStyle(color: AppColors.textTertiary, fontSize: 11),
                  ),
                ],
              ),
              if ((item.body ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  item.body!,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 13,
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
                const Row(
                  children: [
                    Text('View',
                        style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 13,
                            fontWeight: FontWeight.w600)),
                    Icon(Icons.chevron_right, size: 18, color: AppColors.primary),
                  ],
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
