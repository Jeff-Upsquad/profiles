import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import 'widgets/empty_state.dart';
import 'widgets/subscription_card_tile.dart';
import 'widgets/subscription_card_actions.dart';

class PendingScreen extends ConsumerStatefulWidget {
  const PendingScreen({super.key});

  @override
  ConsumerState<PendingScreen> createState() => _PendingScreenState();
}

class _PendingScreenState extends ConsumerState<PendingScreen> {
  String? _respondingId;

  Future<void> _handleRespond(String recipientId, String action) async {
    setState(() => _respondingId = recipientId);
    try {
      final service = ref.read(subscriptionServiceProvider);
      await service.respond(recipientId, action);
      ref.invalidate(pendingCardsProvider);
      ref.invalidate(respondedCardsProvider);
      ref.invalidate(unreadCountProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(action == 'accept' ? 'Offer accepted!' : 'Offer declined'),
            backgroundColor: action == 'accept' ? AppColors.success : AppColors.textSecondary,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Something went wrong. Please try again.'),
            backgroundColor: AppColors.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _respondingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cards = ref.watch(pendingCardsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pending Offers'),
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
                onPressed: () => ref.invalidate(pendingCardsProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (items) {
          if (items.isEmpty) {
            return const EmptyState(
              icon: Icons.inbox_outlined,
              title: 'All caught up',
              subtitle: "You don't have any pending offers right now. We'll notify you when new ones arrive.",
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(pendingCardsProvider);
              ref.invalidate(unreadCountProvider);
              await ref.read(pendingCardsProvider.future);
            },
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final recipient = items[index];
                return Column(
                  children: [
                    SubscriptionCardTile(card: recipient.card!),
                    const SizedBox(height: 12),
                    SubscriptionCardActions(
                      ctaLabel: recipient.card?.ctaLabel,
                      loading: _respondingId == recipient.id,
                      onAccept: () => _handleRespond(recipient.id, 'accept'),
                      onReject: () => _handleRespond(recipient.id, 'reject'),
                    ),
                  ],
                );
              },
            ),
          );
        },
      ),
    );
  }
}
