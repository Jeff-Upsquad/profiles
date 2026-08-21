import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/subscription_utils.dart';
import '../../models/subscription_card.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import 'widgets/empty_state.dart';
import 'widgets/status_badge.dart';
import 'widgets/subscription_list_tile.dart';

enum _Filter { responded, expired }

class RespondedScreen extends ConsumerStatefulWidget {
  const RespondedScreen({super.key});

  @override
  ConsumerState<RespondedScreen> createState() => _RespondedScreenState();
}

class _RespondedScreenState extends ConsumerState<RespondedScreen> {
  _Filter _filter = _Filter.responded;

  String get _status => switch (_filter) {
        // Responded merges the old Accepted + Declined tabs; Expired = offers
        // the talent never responded to that were already given to someone
        // else. Both filters are resolved server-side.
        _Filter.responded => 'responded',
        _Filter.expired => 'expired',
      };

  @override
  Widget build(BuildContext context) {
    final provider = subscriptionListProvider(('subscription', _status));
    final cards = ref.watch(provider);

    return Scaffold(
      appBar: AppBar(title: const Text('Responded')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: SegmentedButton<_Filter>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: _Filter.responded, label: Text('Responded')),
                ButtonSegment(value: _Filter.expired, label: Text('Expired')),
              ],
              selected: {_filter},
              onSelectionChanged: (s) => setState(() => _filter = s.first),
            ),
          ),
          Expanded(
            child: cards.when(
              loading: () => const ShimmerCardList(),
              error: (e, _) => _ErrorState(onRetry: () => ref.invalidate(provider)),
              data: (items) {
                if (items.isEmpty) {
                  return EmptyState(
                    icon: _filter == _Filter.expired
                        ? Icons.timer_off_outlined
                        : Icons.check_circle_outline,
                    title: switch (_filter) {
                      _Filter.responded => 'No responses yet',
                      _Filter.expired => 'No expired offers',
                    },
                    subtitle: _filter == _Filter.expired
                        ? 'Offers that closed before you responded will show up here.'
                        : 'Once you accept or decline an offer, it will appear here.',
                  );
                }

                final groups = _groupByDay(items);
                return RefreshIndicator(
                  onRefresh: () async {
                    ref.invalidate(provider);
                    await ref.read(provider.future);
                  },
                  child: ListView.builder(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    itemCount: groups.length,
                    itemBuilder: (context, i) => _GroupSection(group: groups[i]),
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

// ─── Grouping ────────────────────────────────────────────────────────────────

class _DayGroup {
  final String key;
  final String label;
  final List<SubscriptionCardRecipient> items;
  _DayGroup(this.key, this.label, this.items);
}

String _sortKeyOf(SubscriptionCardRecipient r) =>
    // Expired rows were never responded to, so fall back to the card's publish
    // date to keep them sensibly dated.
    r.respondedAt ?? r.cancelledAt ?? r.card?.publishedAt ?? '';

List<_DayGroup> _groupByDay(List<SubscriptionCardRecipient> items) {
  final map = <String, _DayGroup>{};
  for (final item in items) {
    final iso = _sortKeyOf(item);
    final key = dayKey(iso);
    map.putIfAbsent(key, () => _DayGroup(key, dayLabel(iso), []));
    map[key]!.items.add(item);
  }
  for (final g in map.values) {
    g.items.sort((a, b) => _sortKeyOf(b).compareTo(_sortKeyOf(a)));
  }
  final groups = map.values.toList();
  groups.sort((a, b) => b.key.compareTo(a.key));
  return groups;
}

class _GroupSection extends StatelessWidget {
  final _DayGroup group;
  const _GroupSection({required this.group});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
          child: Text(
            group.label.toUpperCase(),
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
              for (int i = 0; i < group.items.length; i++) ...[
                if (i > 0)
                  const Divider(
                      height: 1, indent: 68, color: AppColors.divider),
                SubscriptionListTile(
                  recipient: group.items[i],
                  dimmed: group.items[i].isCancelled,
                  trailing: _Trailing(recipient: group.items[i]),
                  onTap: () =>
                      context.push('/subscription-detail', extra: group.items[i]),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

class _Trailing extends StatelessWidget {
  final SubscriptionCardRecipient recipient;
  const _Trailing({required this.recipient});

  StatusBadge? _badge() {
    if (recipient.isSelected) return StatusBadge.selected();
    if (recipient.isPassedOver) {
      return recipient.card?.status == 'assigned'
          ? StatusBadge.closed()
          : StatusBadge.passedOver();
    }
    if (recipient.isAccepted) return StatusBadge.accepted();
    if (recipient.isRejected) return StatusBadge.rejected();
    // Expired tab: never-responded rows whose card went to someone else.
    if (recipient.isPending) return StatusBadge.expired();
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final badge = _badge();
    final time = timeLabel(_sortKeyOf(recipient));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        ?badge,
        if (time.isNotEmpty) ...[
          const SizedBox(height: 3),
          Text(time,
              style: const TextStyle(color: AppColors.textTertiary, fontSize: 11)),
        ],
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  final VoidCallback onRetry;
  const _ErrorState({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text('Failed to load', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}
