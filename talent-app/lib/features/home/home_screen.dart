import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants.dart';
import '../../core/theme.dart';
import '../../models/talent_profile.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/ui_kit.dart';
import '../update/update_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final firstName = (user?.fullName ?? '').trim().split(RegExp(r'\s+')).first;

    return Scaffold(
      appBar: AppBar(title: const Text(appName)),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(onboardingProgressProvider);
          ref.invalidate(myProfilesProvider);
          await ref.read(myProfilesProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const UpdateCard(),
            Text(
              firstName.isEmpty ? 'Welcome back 👋' : 'Hi, $firstName 👋',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 4),
            const Text(
              "Here's what's happening with your work.",
              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 20),
            const _OnboardingStrip(),
            _ProfileStats(),
            const SizedBox(height: 8),
            const SectionLabel('Quick actions', padding: EdgeInsets.fromLTRB(4, 8, 4, 10)),
            const _QuickActions(),
            const SizedBox(height: 8),
            _RecentProfiles(),
          ],
        ),
      ),
    );
  }
}

class _OnboardingStrip extends ConsumerWidget {
  const _OnboardingStrip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(onboardingProgressProvider);
    return progress.maybeWhen(
      data: (p) {
        if (p.allDone) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: TitledCard(
            title: 'Complete your setup',
            icon: Icons.rocket_launch_outlined,
            trailing: Text(
              '${p.completed}/${p.total}',
              style: const TextStyle(
                color: AppColors.primary,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            child: Column(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: p.total == 0 ? 0 : p.completed / p.total,
                    minHeight: 8,
                    backgroundColor: AppColors.divider,
                    valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  ),
                ),
                const SizedBox(height: 14),
                ...p.stages.map(_stageRow),
                if (!p.onboardingCompleted) ...[
                  const SizedBox(height: 4),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => context.push('/more/training'),
                      child: const Text('Continue training'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }

  Widget _stageRow(({String label, bool done}) s) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            s.done ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: s.done ? AppColors.success : AppColors.textTertiary,
          ),
          const SizedBox(width: 10),
          Text(
            s.label,
            style: TextStyle(
              color: s.done ? AppColors.textPrimary : AppColors.textSecondary,
              fontSize: 14,
              fontWeight: s.done ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileStats extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profiles = ref.watch(myProfilesProvider);
    return profiles.maybeWhen(
      data: (list) {
        final approved = list.where((p) => p.isApproved).length;
        final pending = list.where((p) => p.isPending).length;
        final draft = list.where((p) => p.isDraft).length;
        return Row(
          children: [
            _StatTile(label: 'Profiles', value: list.length, color: AppColors.primary),
            const SizedBox(width: 10),
            _StatTile(label: 'Live', value: approved, color: AppColors.success),
            const SizedBox(width: 10),
            _StatTile(label: 'In review', value: pending, color: AppColors.warning),
            const SizedBox(width: 10),
            _StatTile(label: 'Drafts', value: draft, color: AppColors.textTertiary),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final int value;
  final Color color;
  const _StatTile({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              '$value',
              style: TextStyle(color: color, fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final actions = <({IconData icon, String label, String route})>[
      (icon: Icons.work_outline, label: 'Jobs', route: '/jobs'),
      (icon: Icons.mail_outline, label: 'Offers', route: '/offers'),
      (icon: Icons.groups_outlined, label: 'My Clients', route: '/more/my-clients'),
      (icon: Icons.school_outlined, label: 'Training', route: '/more/training'),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 2.4,
      children: [
        for (final a in actions)
          Card(
            clipBehavior: Clip.antiAlias,
            margin: EdgeInsets.zero,
            child: InkWell(
              onTap: () {
                if (a.route.startsWith('/more/')) {
                  context.push(a.route);
                } else {
                  context.go(a.route);
                }
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Row(
                  children: [
                    Icon(a.icon, color: AppColors.primary, size: 22),
                    const SizedBox(width: 10),
                    Text(
                      a.label,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _RecentProfiles extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profiles = ref.watch(myProfilesProvider);
    return profiles.maybeWhen(
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        final recent = list.take(3).toList();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionLabel('Your profiles', padding: EdgeInsets.fromLTRB(4, 12, 4, 10)),
            for (final p in recent) _ProfileRow(profile: p),
          ],
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _ProfileRow extends StatelessWidget {
  final TalentProfile profile;
  const _ProfileRow({required this.profile});

  ({String label, BadgeVariant variant}) get _status {
    if (profile.isApproved) return (label: 'Live', variant: BadgeVariant.green);
    if (profile.isPending) return (label: 'In review', variant: BadgeVariant.yellow);
    if (profile.isRejected) return (label: 'Changes needed', variant: BadgeVariant.red);
    if (profile.isInactive) return (label: 'Paused', variant: BadgeVariant.gray);
    return (label: 'Draft', variant: BadgeVariant.gray);
  }

  @override
  Widget build(BuildContext context) {
    final s = _status;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: const Icon(Icons.badge_outlined, color: AppColors.primary),
        title: Text(
          profile.displayName,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
        trailing: Pill(label: s.label, variant: s.variant),
        onTap: () => context.push('/more/profiles'),
      ),
    );
  }
}
