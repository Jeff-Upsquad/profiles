import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../models/talent_profile.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';

class ProfilesListScreen extends ConsumerWidget {
  const ProfilesListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profiles = ref.watch(myProfilesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Job profiles')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/more/profiles/new'),
        icon: const Icon(Icons.add),
        label: const Text('New profile'),
      ),
      body: profiles.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(onRetry: () => ref.invalidate(myProfilesProvider)),
        data: (all) {
          // Hide ghost profiles unless approved (mirrors the web list).
          final items = all.where((p) => !p.isGhost || p.isApproved).toList();
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myProfilesProvider);
              await ref.read(myProfilesProvider.future);
            },
            child: items.isEmpty
                ? ListView(
                    children: const [
                      Padding(
                        padding: EdgeInsets.only(top: 80),
                        child: EmptyState(
                          icon: Icons.badge_outlined,
                          title: 'No profiles yet',
                          subtitle:
                              'Create a job profile to showcase your skills and get matched to work.',
                        ),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 88),
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, i) => _ProfileCard(profile: items[i]),
                  ),
          );
        },
      ),
    );
  }
}

class _ProfileCard extends ConsumerWidget {
  final TalentProfile profile;
  const _ProfileCard({required this.profile});

  ({String label, BadgeVariant variant}) get _status {
    if (profile.isApproved) return (label: 'Live', variant: BadgeVariant.green);
    if (profile.isPending) return (label: 'In review', variant: BadgeVariant.yellow);
    if (profile.isRejected) return (label: 'Changes needed', variant: BadgeVariant.red);
    if (profile.isInactive) return (label: 'Paused', variant: BadgeVariant.gray);
    return (label: 'Draft', variant: BadgeVariant.gray);
  }

  Future<void> _act(BuildContext context, WidgetRef ref, String action) async {
    final svc = ref.read(profilesServiceProvider);
    try {
      switch (action) {
        case 'pause':
          await svc.deactivate(profile.id);
        case 'reactivate':
          await svc.reactivate(profile.id);
        case 'delete':
          final ok = await _confirmDelete(context);
          if (ok != true) return;
          await svc.delete(profile.id);
      }
      ref.invalidate(myProfilesProvider);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Action failed. Please try again.')),
        );
      }
    }
  }

  Future<bool?> _confirmDelete(BuildContext context) => showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: const Text('Delete this profile?'),
          content: const Text('This cannot be undone.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
              child: const Text('Delete'),
            ),
          ],
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = _status;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/more/profiles/edit/${profile.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.badge_outlined, color: AppColors.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      profile.displayName,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Pill(label: s.label, variant: s.variant),
                  if (!profile.isGhost)
                    PopupMenuButton<String>(
                      onSelected: (a) => _act(context, ref, a),
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'edit', child: Text('Edit')),
                        if (profile.isApproved)
                          const PopupMenuItem(value: 'pause', child: Text('Pause')),
                        if (profile.isInactive)
                          const PopupMenuItem(value: 'reactivate', child: Text('Reactivate')),
                        const PopupMenuItem(value: 'delete', child: Text('Delete')),
                      ],
                      onOpened: () {},
                    ),
                ],
              ),
              if (profile.isRejected && (profile.rejectionReason ?? '').isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.dangerBg,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    profile.rejectionReason!,
                    style: const TextStyle(color: AppColors.danger, fontSize: 12.5),
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
