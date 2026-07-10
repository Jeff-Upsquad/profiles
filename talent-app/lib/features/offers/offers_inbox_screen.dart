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
import '../update/update_card.dart';

/// Which offer product line to show.
enum _OfferFilter { all, subscription, assignment }

/// The "Offers" tab — subscription retainers and one-off assignments the talent
/// has been matched with, split by product line, with Pending / Responded tabs.
class OffersInboxScreen extends ConsumerStatefulWidget {
  const OffersInboxScreen({super.key});

  @override
  ConsumerState<OffersInboxScreen> createState() => _OffersInboxScreenState();
}

class _OffersInboxScreenState extends ConsumerState<OffersInboxScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  _OfferFilter _filter = _OfferFilter.all;

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Offers'),
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [Tab(text: 'Pending'), Tab(text: 'Responded')],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Row(
              children: [
                for (final f in _OfferFilter.values) ...[
                  _Chip(
                    label: switch (f) {
                      _OfferFilter.all => 'All',
                      _OfferFilter.subscription => 'Subscriptions',
                      _OfferFilter.assignment => 'Assignments',
                    },
                    selected: _filter == f,
                    onTap: () => setState(() => _filter = f),
                  ),
                  const SizedBox(width: 8),
                ],
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _OffersList(status: 'pending', respondedOnly: false, filter: _filter),
                _OffersList(status: 'all', respondedOnly: true, filter: _filter),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _Chip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.white : AppColors.textSecondary,
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _OffersList extends ConsumerWidget {
  final String status;
  final bool respondedOnly;
  final _OfferFilter filter;
  const _OffersList({
    required this.status,
    required this.respondedOnly,
    required this.filter,
  });

  bool _matches(SubscriptionCardRecipient r) {
    if (respondedOnly && r.isPending) return false;
    final isAssignment = r.card?.isAssignment ?? false;
    return switch (filter) {
      _OfferFilter.all => true,
      _OfferFilter.subscription => !isAssignment,
      _OfferFilter.assignment => isAssignment,
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(subscriptionListProvider(status));
    return cards.when(
      loading: () => const ShimmerCardList(),
      error: (_, _) => AppErrorRetry(
        onRetry: () => ref.invalidate(subscriptionListProvider(status)),
      ),
      data: (all) {
        final items = all.where(_matches).toList();
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(subscriptionListProvider(status));
            ref.invalidate(unreadCountProvider);
            await ref.read(subscriptionListProvider(status).future);
          },
          child: items.isEmpty
              ? ListView(
                  children: [
                    const UpdateCard(),
                    Padding(
                      padding: const EdgeInsets.only(top: 56),
                      child: EmptyState(
                        icon: respondedOnly ? Icons.history : Icons.inbox_outlined,
                        title: respondedOnly ? 'Nothing here yet' : 'All caught up',
                        subtitle: respondedOnly
                            ? 'Offers you respond to will appear here.'
                            : "You don't have any pending offers right now.",
                      ),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const UpdateCard(),
                    Card(
                      clipBehavior: Clip.antiAlias,
                      child: Column(
                        children: [
                          for (int i = 0; i < items.length; i++) ...[
                            if (i > 0)
                              const Divider(
                                  height: 1,
                                  indent: 68,
                                  color: AppColors.divider),
                            SubscriptionListTile(
                              recipient: items[i],
                              trailing: _price(items[i].card),
                              onTap: () => context.push('/subscription-detail',
                                  extra: items[i]),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }

  Widget? _price(SubscriptionCard? card) {
    if (card == null) return null;
    final label = (card.priceLabel ?? '').trim();
    final text = label.isNotEmpty ? label : formatPrice(card.monthlyPrice, card.currency);
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
