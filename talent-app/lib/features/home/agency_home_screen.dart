import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../widgets/ui_kit.dart';
import '../update/update_card.dart';

/// Agency Home — mirrors talent's Home (Subscriptions / Assignments tabs)
/// but backed by `/agency/subscriptions` and `/agency/assignments` (currently
/// stubs returning [] until matcher is wired — empty state is the expected UI).
class AgencyHomeScreen extends ConsumerStatefulWidget {
  const AgencyHomeScreen({super.key});

  @override
  ConsumerState<AgencyHomeScreen> createState() => _AgencyHomeScreenState();
}

class _AgencyHomeScreenState extends ConsumerState<AgencyHomeScreen> {
  String _tab = 'subscriptions';
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(agencySubscriptionsProvider);
    ref.invalidate(agencyAssignmentsProvider);
    ref.invalidate(agencyMeProvider);
    ref.invalidate(agencySquadProvider);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final agencyMe = ref.watch(agencyMeProvider);
    final agencyName = (agencyMe.value?['agency_name'] as String?) ?? user?.fullName ?? '';
    final firstName = agencyName.trim().split(RegExp(r'\s+')).first;

    final subCount = ref.watch(agencySubscriptionsProvider).value?.length ?? 0;
    final assignCount = ref.watch(agencyAssignmentsProvider).value?.length ?? 0;

    return ColoredBox(
      color: AppColors.surface,
      child: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const UpdateCard(),
            HeroCard(
              title: firstName.isEmpty ? 'Welcome back.' : 'Welcome back, ',
              titleHighlight: firstName.isEmpty ? null : '$firstName.',
              subtitle: 'Subscriptions and assignments from businesses.',
            ),
            const SizedBox(height: 16),
            SoftSegmentedTabs(
              expanded: true,
              tabs: [
                SegmentTab(key: 'subscriptions', label: 'Subscriptions', count: subCount),
                SegmentTab(key: 'assignments', label: 'Assignments', count: assignCount),
              ],
              activeKey: _tab,
              onChange: (v) => setState(() => _tab = v),
            ),
            const SizedBox(height: 16),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: _tab == 'subscriptions'
                  ? const _AgencySubscriptionsView(key: ValueKey('subs'))
                  : const _AgencyAssignmentsView(key: ValueKey('assigns')),
            ),
            const SizedBox(height: 16),
            const _AgencyGetStarted(),
          ],
        ),
      ),
    );
  }
}

class _AgencySubscriptionsView extends ConsumerWidget {
  const _AgencySubscriptionsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(agencySubscriptionsProvider);
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
      error: (e, _) => AppErrorRetry(onRetry: () => ref.invalidate(agencySubscriptionsProvider), message: 'Failed to load subscriptions'),
      data: (list) {
        if (list.isEmpty) {
          return _EmptyCard(
            icon: Icons.inbox_outlined,
            title: 'No subscriptions yet',
            subtitle: 'When businesses subscribe to your agency they\'ll appear here.',
            actionLabel: 'View squad',
            onAction: () => context.push('/more/webview?title=${Uri.encodeComponent('Squad Members')}&path=${Uri.encodeComponent('/agency/squad')}'),
          );
        }
        return Column(
          children: [
            for (final item in list) _AgencyRequestCard(item: item, type: 'subscription'),
          ],
        );
      },
    );
  }
}

class _AgencyAssignmentsView extends ConsumerWidget {
  const _AgencyAssignmentsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(agencyAssignmentsProvider);
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
      error: (e, _) => AppErrorRetry(onRetry: () => ref.invalidate(agencyAssignmentsProvider), message: 'Failed to load assignments'),
      data: (list) {
        if (list.isEmpty) {
          return _EmptyCard(
            icon: Icons.assignment_outlined,
            title: 'No assignments yet',
            subtitle: 'Assignments from subscribed businesses will appear here.',
            actionLabel: 'View subscriptions',
            onAction: () => context.push('/more/webview?title=${Uri.encodeComponent('Total Portfolio')}&path=${Uri.encodeComponent('/agency/portfolio')}'),
          );
        }
        return Column(
          children: [
            for (final item in list) _AgencyRequestCard(item: item, type: 'assignment'),
          ],
        );
      },
    );
  }
}

class _EmptyCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  const _EmptyCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        children: [
          Container(
            width: 48,
            height: 48,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 24, color: AppColors.textTertiary),
          ),
          const SizedBox(height: 12),
          Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text(subtitle, textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: AppColors.textTertiary, height: 1.4)),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}

class _AgencyRequestCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final String type;
  const _AgencyRequestCard({required this.item, required this.type});

  @override
  Widget build(BuildContext context) {
    final title = (item['title'] ?? item['card_title'] ?? item['business_name'] ?? 'Request').toString();
    final status = (item['status'] ?? 'pending').toString();
    final business = (item['business_name'] ?? item['company_name'] ?? '').toString();
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Pill(label: status, variant: status == 'pending' ? BadgeVariant.yellow : BadgeVariant.gray),
              const Spacer(),
              Text(type, style: const TextStyle(fontSize: 11, color: AppColors.textMuted, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
          if (business.isNotEmpty) ...[
            const SizedBox(height: 4),
            InfoChip(icon: Icons.business_outlined, label: business),
          ],
        ],
      ),
    );
  }
}

class _AgencyGetStarted extends ConsumerWidget {
  const _AgencyGetStarted();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final squad = ref.watch(agencySquadProvider).value?.length ?? 0;
    final profiles = ref.watch(agencyMemberProfilesProvider).value?.length ?? 0;
    final general = ref.watch(agencyGeneralPortfoliosProvider).value?.length ?? 0;

    final steps = [
      (label: 'Complete agency profile', done: false, path: '/agency/profile', title: 'Agency Profile'),
      (label: 'Add squad members', done: squad > 0, path: '/agency/squad', title: 'Squad Members'),
      (label: 'Create job profiles', done: profiles > 0, path: '/agency/profiles', title: 'Job Profiles'),
      (label: 'Build portfolio', done: general > 0, path: '/agency/general', title: 'General Portfolio'),
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Get started', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          const Text('Complete these steps to get discovered by businesses.', style: TextStyle(fontSize: 12, color: AppColors.textTertiary)),
          const SizedBox(height: 16),
          for (final s in steps) ...[
            InkWell(
              onTap: () => context.push('/more/webview?title=${Uri.encodeComponent(s.title)}&path=${Uri.encodeComponent(s.path)}'),
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Icon(s.done ? Icons.check_circle : Icons.circle_outlined, size: 20, color: s.done ? AppColors.success : AppColors.textMuted),
                    const SizedBox(width: 10),
                    Expanded(child: Text(s.label, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: s.done ? AppColors.textPrimary : AppColors.textSecondary))),
                    const Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
                  ],
                ),
              ),
            ),
            const Divider(height: 1, color: AppColors.divider),
          ],
        ],
      ),
    );
  }
}
