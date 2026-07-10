import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';

/// App-route → training module key (mirrors `ROUTE_TO_MODULE`). Sections not
/// listed are always accessible.
const Map<String, String> kRouteToModule = {
  '/basic-profile': 'basic-profile',
  '/more/profiles': 'profiles',
  '/more/my-clients': 'subscriptions',
  '/interviews': 'jobs',
  '/job-offers': 'jobs',
  '/more/settings': 'settings',
};

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                    child: Text(
                      initialsFor(user?.fullName ?? user?.email),
                      style: const TextStyle(
                        color: AppColors.primary,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if ((user?.fullName ?? '').isNotEmpty)
                          Text(user!.fullName!,
                              style: Theme.of(context).textTheme.titleMedium),
                        Text(user?.email ?? '',
                            style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          _group('Work', const [
            _Item(Icons.event_available_outlined, 'Interviews', '/interviews'),
            _Item(Icons.mail_outline, 'Job offers', '/job-offers'),
            _Item(Icons.groups_outlined, 'My Clients', '/more/my-clients'),
          ]),
          const SizedBox(height: 12),
          _group('Profile', const [
            _Item(Icons.person_outline, 'Basic profile', '/basic-profile'),
            _Item(Icons.badge_outlined, 'Job profiles', '/more/profiles'),
          ]),
          const SizedBox(height: 12),
          _group('Learn', const [
            _Item(Icons.school_outlined, 'Training program', '/more/training'),
          ]),
          const SizedBox(height: 12),
          _group('Account', const [
            _Item(Icons.settings_outlined, 'Settings', '/more/settings'),
            _Item(Icons.help_outline, 'Contact support', '/more/contact-support'),
          ]),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: () => _confirmSignOut(context, ref),
            icon: const Icon(Icons.logout, color: AppColors.danger),
            label: const Text('Sign out'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ],
      ),
    );
  }

  Widget _group(String title, List<_Item> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            title.toUpperCase(),
            style: const TextStyle(
              color: AppColors.textTertiary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
            ),
          ),
        ),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (int i = 0; i < items.length; i++) ...[
                if (i > 0)
                  const Divider(height: 1, indent: 56, color: AppColors.divider),
                items[i],
              ],
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
    if (confirmed == true) ref.read(authProvider.notifier).logout();
  }
}

class _Item extends ConsumerWidget {
  final IconData icon;
  final String label;
  final String route;
  const _Item(this.icon, this.label, this.route);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final module = kRouteToModule[route];
    final locked = module == null
        ? null
        : ref.watch(moduleAccessProvider).value?.lockedInfo(module);

    if (locked != null) {
      return ListTile(
        leading: Icon(icon, color: AppColors.textTertiary),
        title: Text(label,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
        subtitle: Text(
          'Complete "${locked.chapterTitle}" to unlock',
          style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
        ),
        trailing: const Icon(Icons.lock_outline, size: 18, color: AppColors.textTertiary),
        onTap: () => _showGate(context, locked.chapterTitle),
      );
    }

    return ListTile(
      leading: Icon(icon, color: AppColors.textSecondary),
      title: Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary),
      onTap: () => context.push(route),
    );
  }

  void _showGate(BuildContext context, String chapter) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Training required'),
        content: Text('Complete the "$chapter" training to unlock $label.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: const Text('Later')),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              context.push('/more/training');
            },
            child: const Text('Go to training'),
          ),
        ],
      ),
    );
  }
}
