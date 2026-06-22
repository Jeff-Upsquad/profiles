import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/subscription_utils.dart';
import '../../models/subscription_card.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../update/update_card.dart';
import 'widgets/empty_state.dart';
import 'widgets/subscription_list_tile.dart';

class PendingScreen extends ConsumerWidget {
  const PendingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cards = ref.watch(pendingCardsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Pending Offers')),
      body: cards.when(
        loading: () => const ShimmerCardList(),
        error: (e, _) => _ErrorState(
          onRetry: () => ref.invalidate(pendingCardsProvider),
        ),
        data: (items) {
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(pendingCardsProvider);
              ref.invalidate(unreadCountProvider);
              ref.invalidate(talentMeProvider);
              await ref.read(pendingCardsProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const UpdateCard(),
                const _WhatsAppToggle(),
                const SizedBox(height: 16),
                if (items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: EmptyState(
                      icon: Icons.inbox_outlined,
                      title: 'All caught up',
                      subtitle:
                          "You don't have any pending offers right now. We'll notify you when new ones arrive.",
                    ),
                  )
                else
                  _ListCard(items: items),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ListCard extends StatelessWidget {
  final List<SubscriptionCardRecipient> items;
  const _ListCard({required this.items});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (int i = 0; i < items.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, indent: 68, endIndent: 0, color: AppColors.divider),
            SubscriptionListTile(
              recipient: items[i],
              trailing: _priceTag(items[i].card),
              onTap: () => context.push('/subscription-detail', extra: items[i]),
            ),
          ],
        ],
      ),
    );
  }

  Widget? _priceTag(SubscriptionCard? card) {
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

/// WhatsApp updates preference — mirrors the toggle on the web subscriptions page.
class _WhatsAppToggle extends ConsumerStatefulWidget {
  const _WhatsAppToggle();

  @override
  ConsumerState<_WhatsAppToggle> createState() => _WhatsAppToggleState();
}

class _WhatsAppToggleState extends ConsumerState<_WhatsAppToggle> {
  bool _saving = false;

  Future<void> _toggle(bool next) async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(talentServiceProvider).setWhatsappUpdates(next);
      ref.invalidate(talentMeProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next ? 'WhatsApp updates enabled' : 'WhatsApp updates disabled'),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update preference')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(talentMeProvider);
    // Hide entirely until we know the value, to avoid a flicker.
    if (me.value == null) return const SizedBox.shrink();
    final enabled = me.value!.whatsappUpdatesEnabled;

    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
        child: Row(
          children: [
            const Icon(Icons.chat_outlined, color: AppColors.success, size: 22),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('WhatsApp updates',
                      style: TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600)),
                  SizedBox(height: 2),
                  Text(
                    'Get a WhatsApp message when a new opportunity arrives.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
            ),
            Switch(
              value: enabled,
              onChanged: _saving ? null : _toggle,
            ),
          ],
        ),
      ),
    );
  }
}
