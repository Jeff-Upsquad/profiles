import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../widgets/ui_kit.dart';
import '../update/update_card.dart';

class AgencyHomeScreen extends ConsumerWidget {
  const AgencyHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).user;
    final agencyMe = ref.watch(agencyMeProvider);
    final squad = ref.watch(agencySquadProvider);
    final memberProfiles = ref.watch(agencyMemberProfilesProvider);
    final general = ref.watch(agencyGeneralPortfoliosProvider);
    final total = ref.watch(agencyTotalPortfolioProvider);

    final agencyName = (agencyMe.value?['agency_name'] as String?) ?? user?.fullName ?? '';
    final firstName = agencyName.trim().split(RegExp(r'\s+')).first;

    Future<void> refresh() async {
      ref.invalidate(agencyMeProvider);
      ref.invalidate(agencySquadProvider);
      ref.invalidate(agencyMemberProfilesProvider);
      ref.invalidate(agencyGeneralPortfoliosProvider);
      ref.invalidate(agencyTotalPortfolioProvider);
    }

    return ColoredBox(
      color: AppColors.surface,
      child: RefreshIndicator(
        onRefresh: refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            const UpdateCard(),
            HeroCard(
              title: firstName.isEmpty ? 'Welcome back.' : 'Welcome back, ',
              titleHighlight: firstName.isEmpty ? null : '$firstName.',
              subtitle: 'Manage your squad and portfolios.',
            ),
            const SizedBox(height: 16),
            _StatsGrid(
              squad: squad,
              memberProfiles: memberProfiles,
              general: general,
              total: total,
            ),
            const SizedBox(height: 16),
            _GetStartedChecklist(
              squadCount: squad.value?.length ?? 0,
              memberProfilesCount: memberProfiles.value?.length ?? 0,
              generalCount: general.value?.length ?? 0,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final AsyncValue<List<dynamic>> squad;
  final AsyncValue<List<dynamic>> memberProfiles;
  final AsyncValue<List<dynamic>> general;
  final AsyncValue<Map<String, dynamic>> total;

  const _StatsGrid({
    required this.squad,
    required this.memberProfiles,
    required this.general,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    Widget card(String label, String sub, AsyncValue<dynamic> v, IconData icon, VoidCallback onTap) {
      final count = v.when(
        data: (d) {
          if (d is List) return d.length.toString();
          if (d is Map) {
            final items = d['portfolio_items'] as List?;
            return (items?.length ?? 0).toString();
          }
          return '—';
        },
        loading: () => '…',
        error: (_, _) => '—',
      );
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
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
                  Container(
                    width: 36,
                    height: 36,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(10)),
                    child: Icon(icon, size: 18, color: AppColors.textSecondary),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
                ],
              ),
              const SizedBox(height: 12),
              Text(count, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
              Text(sub, style: const TextStyle(fontSize: 11, color: AppColors.textTertiary)),
            ],
          ),
        ),
      );
    }

    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.35,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        card('Squad Members', 'People in your squad', squad, Icons.groups_outlined, () => context.push('/more/webview?title=${Uri.encodeComponent('Squad Members')}&path=${Uri.encodeComponent('/agency/squad')}')),
        card('Job Profiles', 'Per-member profiles', memberProfiles, Icons.badge_outlined, () => context.push('/more/webview?title=${Uri.encodeComponent('Job Profiles')}&path=${Uri.encodeComponent('/agency/profiles')}')),
        card('General', 'Agency portfolios', general, Icons.description_outlined, () => context.push('/more/webview?title=${Uri.encodeComponent('General Portfolio')}&path=${Uri.encodeComponent('/agency/general')}')),
        card('Portfolio Items', 'Total portfolio', total, Icons.collections_outlined, () => context.push('/more/webview?title=${Uri.encodeComponent('Total Portfolio')}&path=${Uri.encodeComponent('/agency/portfolio')}')),
      ],
    );
  }
}

class _GetStartedChecklist extends StatelessWidget {
  final int squadCount;
  final int memberProfilesCount;
  final int generalCount;

  const _GetStartedChecklist({
    required this.squadCount,
    required this.memberProfilesCount,
    required this.generalCount,
  });

  @override
  Widget build(BuildContext context) {
    final steps = [
      (label: 'Complete agency profile', done: false, path: '/agency/profile', title: 'Agency Profile'),
      (label: 'Add squad members', done: squadCount > 0, path: '/agency/squad', title: 'Squad Members'),
      (label: 'Create job profiles', done: memberProfilesCount > 0, path: '/agency/profiles', title: 'Job Profiles'),
      (label: 'Build portfolio', done: generalCount > 0, path: '/agency/general', title: 'General Portfolio'),
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
