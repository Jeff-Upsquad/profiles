import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/subscription_utils.dart';
import '../../core/theme.dart';
import '../../models/subscription_card.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';
import '../subscriptions/widgets/subscription_list_tile.dart';

/// Subscriptions or Assignments feed. Matches `TalentOffersView` (embedded):
/// renders shrink-wrapped content — the parent page scroll view owns
/// scrolling and pull-to-refresh.
class TalentOffersView extends ConsumerStatefulWidget {
  final bool assignments;
  const TalentOffersView({super.key, this.assignments = false});

  @override
  ConsumerState<TalentOffersView> createState() => _TalentOffersViewState();
}

class _TalentOffersViewState extends ConsumerState<TalentOffersView> {
  String _tab = 'pending';

  /// The backend filters server-side on card_type (defaulting to
  /// 'subscription'), so each product line must request its own feed.
  String get _cardType => widget.assignments ? 'assignment' : 'subscription';

  bool _matches(SubscriptionCardRecipient r) {
    final isAssignment = r.card?.isAssignment ?? false;
    return widget.assignments ? isAssignment : !isAssignment;
  }

  @override
  Widget build(BuildContext context) {
    final pending =
        ref.watch(subscriptionListProvider((_cardType, 'pending'))).value ??
        const [];
    final pendingCount = pending.where(_matches).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SoftSegmentedTabs(
          expanded: true,
          tabs: [
            SegmentTab(key: 'pending', label: 'Pending', count: pendingCount),
            const SegmentTab(key: 'responded', label: 'Responded'),
            const SegmentTab(key: 'expired', label: 'Expired'),
          ],
          activeKey: _tab,
          onChange: (k) => setState(() => _tab = k),
        ),
        const SizedBox(height: 16),
        _OffersList(status: _tab, match: _matches, cardType: _cardType),
      ],
    );
  }
}

class _OffersList extends ConsumerWidget {
  final String status;
  final bool Function(SubscriptionCardRecipient) match;
  final String cardType;
  const _OffersList({
    required this.status,
    required this.match,
    required this.cardType,
  });

  String get _queryStatus => switch (status) {
    'responded' => 'all',
    _ => status,
  };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = (cardType, _queryStatus);
    final cards = ref.watch(subscriptionListProvider(query));
    return cards.when(
      loading: () => const ShimmerCardList.embedded(),
      error: (_, _) => AppErrorRetry(
        onRetry: () => ref.invalidate(subscriptionListProvider(query)),
      ),
      data: (all) {
        var items = all.where(match).toList();
        if (status == 'responded') {
          items = items.where((r) => !r.isPending).toList();
        }
        if (items.isEmpty) {
          return Padding(
            padding: const EdgeInsets.only(top: 56),
            child: EmptyState(
              icon: status == 'pending' ? Icons.inbox_outlined : Icons.history,
              title: status == 'pending' ? 'All caught up' : 'Nothing here yet',
              subtitle: status == 'pending'
                  ? "You don't have any pending offers right now."
                  : 'Offers you respond to will appear here.',
            ),
          );
        }
        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.soft,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (int i = 0; i < items.length; i++) ...[
                if (i > 0)
                  const Divider(height: 1, indent: 68, color: AppColors.border),
                SubscriptionListTile(
                  recipient: items[i],
                  trailing: _price(items[i].card),
                  onTap: () =>
                      context.push('/subscription-detail', extra: items[i]),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget? _price(SubscriptionCard? card) {
    if (card == null) return null;
    final label = (card.priceLabel ?? '').trim();
    final text = label.isNotEmpty
        ? label
        : formatPrice(card.monthlyPrice, card.currency);
    if (text.isEmpty) return null;
    return Text(
      text,
      style: const TextStyle(
        color: AppColors.textPrimary,
        fontSize: 13,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}
