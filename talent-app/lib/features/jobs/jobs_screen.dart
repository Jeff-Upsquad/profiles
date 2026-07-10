import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../models/job_card.dart';
import '../../models/job_preferences.dart';
import '../../providers/jobs_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';
import '../update/update_card.dart';
import 'widgets/job_list_card.dart';
import 'widgets/jobs_opt_in_card.dart';

/// The Jobs tab: an opt-in gate, then the 10-stage funnel feed.
class JobsScreen extends ConsumerWidget {
  const JobsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optIn = ref.watch(jobOptInProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Jobs')),
      body: optIn.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(jobOptInProvider),
        ),
        data: (prefs) =>
            prefs.optedIn ? _JobsHome(prefs: prefs) : const JobsOptInCard(),
      ),
    );
  }
}

class _JobsHome extends ConsumerStatefulWidget {
  final JobPreferences prefs;
  const _JobsHome({required this.prefs});

  @override
  ConsumerState<_JobsHome> createState() => _JobsHomeState();
}

class _JobsHomeState extends ConsumerState<_JobsHome>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs =
      TabController(length: kJobsTabs.length, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final counts = ref.watch(jobsCountsProvider).value ?? const {};

    return Column(
      children: [
        _PreferencesBar(prefs: widget.prefs),
        Material(
          color: Colors.white,
          child: TabBar(
            controller: _tabs,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: AppColors.primary,
            labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            tabs: [
              for (final t in kJobsTabs)
                _CountTab(label: t.label, count: counts[t.key] ?? 0),
            ],
          ),
        ),
        const Divider(height: 1, color: AppColors.divider),
        Expanded(
          child: TabBarView(
            controller: _tabs,
            children: [
              for (final t in kJobsTabs) _JobsFeedList(tab: t.key),
            ],
          ),
        ),
      ],
    );
  }
}

class _CountTab extends StatelessWidget {
  final String label;
  final int count;
  const _CountTab({required this.label, required this.count});

  @override
  Widget build(BuildContext context) {
    return Tab(
      height: 44,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (count > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _JobsFeedList extends ConsumerWidget {
  final String tab;
  const _JobsFeedList({required this.tab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(jobsFeedProvider(tab));

    return feed.when(
      loading: () => const ShimmerCardList(),
      error: (_, _) => AppErrorRetry(
        onRetry: () => ref.invalidate(jobsFeedProvider(tab)),
      ),
      data: (items) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(jobsFeedProvider(tab));
          ref.invalidate(jobsCountsProvider);
          ref.invalidate(jobsUnreadCountProvider);
          await ref.read(jobsFeedProvider(tab).future);
        },
        child: items.isEmpty
            ? ListView(
                children: const [
                  UpdateCard(),
                  Padding(
                    padding: EdgeInsets.only(top: 64),
                    child: EmptyState(
                      icon: Icons.work_outline,
                      title: 'Nothing here yet',
                      subtitle:
                          "When there's a job at this stage, it'll show up here.",
                    ),
                  ),
                ],
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: items.length + 1,
                separatorBuilder: (_, i) =>
                    SizedBox(height: i == 0 ? 0 : 12),
                itemBuilder: (_, i) {
                  if (i == 0) return const UpdateCard();
                  return JobListCard(item: items[i - 1]);
                },
              ),
      ),
    );
  }
}

class _PreferencesBar extends ConsumerWidget {
  final JobPreferences prefs;
  const _PreferencesBar({required this.prefs});

  Future<void> _optOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Opt out of job openings?'),
        content: const Text(
          "You'll stop being matched with new jobs. You can opt back in any time.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Opt out'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(jobsServiceProvider).optOut();
      ref.invalidate(jobOptInProvider);
      invalidateJobs(ref);
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not opt out. Please try again.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locations = prefs.locationSummary;
    final summary = <String>[
      if (locations.isNotEmpty)
        locations.take(2).join(', ') +
            (locations.length > 2 ? ' +${locations.length - 2}' : ''),
      for (final t in prefs.preferredJobTypes.take(2)) humanize(t),
      if (prefs.openToRelocation) 'Open to relocate',
      if (prefs.expectedSalaryMonthly != null)
        '${formatMoney(prefs.expectedSalaryMonthly, 'INR')}/mo',
    ];

    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
      child: Row(
        children: [
          const Icon(Icons.tune, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              summary.isEmpty ? 'No preferences set yet' : summary.join('  ·  '),
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12.5,
                fontWeight: FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          TextButton(
            onPressed: () => context.push('/basic-profile'),
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 36),
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
            child: const Text('Edit'),
          ),
          TextButton(
            onPressed: () => _optOut(context, ref),
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 36),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              foregroundColor: AppColors.textTertiary,
            ),
            child: const Text('Opt out'),
          ),
        ],
      ),
    );
  }
}
