import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../models/subscription_card.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import 'widgets/empty_state.dart';
import 'widgets/status_badge.dart';
import 'widgets/subscription_card_tile.dart';

class RespondedScreen extends ConsumerWidget {
  const RespondedScreen({super.key});

  Widget _buildBadges(SubscriptionCardRecipient recipient) {
    final badges = <Widget>[];

    if (recipient.isSelected) {
      badges.add(StatusBadge.selected());
    } else if (recipient.isPassedOver) {
      badges.add(StatusBadge.passedOver());
    } else if (recipient.isAccepted) {
      badges.add(StatusBadge.accepted());
    } else if (recipient.isRejected) {
      badges.add(StatusBadge.rejected());
    }

    if (recipient.isCancelled) {
      badges.add(StatusBadge.cancelled());
    }

    return Wrap(spacing: 8, runSpacing: 6, children: badges);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(respondedCardsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Responded'),
      ),
      body: cards.when(
        loading: () => const ShimmerCardList(),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.textTertiary),
              const SizedBox(height: 16),
              Text('Failed to load', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => ref.invalidate(respondedCardsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.check_circle_outline,
              title: 'No responses yet',
              subtitle: 'Once you accept or decline an offer, it will appear here.',
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(respondedCardsProvider);
              await ref.read(respondedCardsProvider.future);
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final recipient = items[index];
                return Opacity(
                  opacity: recipient.isCancelled ? 0.6 : 1.0,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _buildBadges(recipient),
                      ),
                      SubscriptionCardTile(card: recipient.card!),
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
