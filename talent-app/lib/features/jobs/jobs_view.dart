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
import 'widgets/job_list_card.dart';
import 'widgets/jobs_opt_in_card.dart';

/// Jobs funnel feed for embedding under Home. Matches `TalentJobsView`
/// (`embedded`): renders shrink-wrapped content — the parent page scroll
/// view owns scrolling and pull-to-refresh.
class JobsView extends ConsumerWidget {
  const JobsView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final optIn = ref.watch(jobOptInProvider);
    return optIn.when(
      loading: () => const ShimmerCardList.embedded(),
      error: (_, _) =>
          AppErrorRetry(onRetry: () => ref.invalidate(jobOptInProvider)),
      data: (prefs) =>
          prefs.optedIn ? _JobsHome(prefs: prefs) : const JobsOptInCard(),
    );
  }
}

class _JobsHome extends ConsumerStatefulWidget {
  final JobPreferences prefs;
  const _JobsHome({required this.prefs});

  @override
  ConsumerState<_JobsHome> createState() => _JobsHomeState();
}

class _JobsHomeState extends ConsumerState<_JobsHome> {
  String _tab = kJobsTabs.first.key;

  @override
  Widget build(BuildContext context) {
    final counts = ref.watch(jobsCountsProvider).value ?? const {};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PreferencesBar(prefs: widget.prefs),
        const SizedBox(height: 12),
        SoftSegmentedTabs(
          tabs: [
            for (final t in kJobsTabs)
              SegmentTab(key: t.key, label: t.label, count: counts[t.key] ?? 0),
          ],
          activeKey: _tab,
          onChange: (k) => setState(() => _tab = k),
        ),
        const SizedBox(height: 16),
        _JobsFeedList(tab: _tab),
      ],
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
      loading: () => const ShimmerCardList.embedded(),
      error: (_, _) =>
          AppErrorRetry(onRetry: () => ref.invalidate(jobsFeedProvider(tab))),
      data: (items) => items.isEmpty
          ? const Padding(
              padding: EdgeInsets.only(top: 64),
              child: EmptyState(
                icon: Icons.work_outline,
                title: 'Nothing here yet',
                subtitle:
                    "When there's a job at this stage, it'll show up here.",
              ),
            )
          : Column(
              children: [
                for (int i = 0; i < items.length; i++) ...[
                  if (i > 0) const SizedBox(height: 12),
                  JobListCard(item: items[i]),
                ],
              ],
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
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          const Icon(Icons.tune, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              summary.isEmpty
                  ? 'No preferences set yet'
                  : summary.join('  ·  '),
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
              foregroundColor: AppColors.danger,
            ),
            child: const Text('Opt out'),
          ),
        ],
      ),
    );
  }
}
