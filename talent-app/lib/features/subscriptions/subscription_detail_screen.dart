import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../core/tints.dart';
import '../../models/subscription_card.dart';
import '../../providers/providers.dart';
import 'widgets/status_badge.dart';
import 'widgets/subscription_detail_content.dart';

class SubscriptionDetailScreen extends ConsumerStatefulWidget {
  final SubscriptionCardRecipient recipient;

  const SubscriptionDetailScreen({super.key, required this.recipient});

  @override
  ConsumerState<SubscriptionDetailScreen> createState() =>
      _SubscriptionDetailScreenState();
}

class _SubscriptionDetailScreenState
    extends ConsumerState<SubscriptionDetailScreen> {
  bool _loading = false;

  SubscriptionCardRecipient get recipient => widget.recipient;

  bool get _showActions =>
      recipient.isPending && !recipient.isCancelled;

  Future<void> _respond(String action) async {
    setState(() => _loading = true);
    try {
      await ref.read(subscriptionServiceProvider).respond(recipient.id, action);
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(unreadCountProvider);
      if (!mounted) return;
      _snack(
        action == 'accept' ? 'Offer accepted!' : 'Offer declined',
        action == 'accept' ? AppColors.success : AppColors.textSecondary,
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack(_errorMessage(e), AppColors.danger);
    }
  }

  String _errorMessage(Object e) {
    try {
      // Surface a backend-provided message (e.g. "Already responded", "cancelled").
      final dynamic err = e;
      final data = err.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
    } catch (_) {}
    return 'Something went wrong. Please try again.';
  }

  void _snack(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final card = recipient.card;
    final brand = (card?.brandName ?? '').trim().isNotEmpty
        ? card!.brandName!.trim()
        : ((card?.title ?? '').trim().isNotEmpty ? card!.title!.trim() : 'Subscription');

    return Scaffold(
      appBar: AppBar(title: Text(brand)),
      body: card == null
          ? const Center(child: Text('Offer details unavailable'))
          : ListView(
              padding: EdgeInsets.zero,
              children: [
                _headerBand(brand),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!_showActions) ...[
                        _statusBadges(),
                        const SizedBox(height: 12),
                      ],
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: SubscriptionDetailContent(card: card),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
      bottomNavigationBar: _showActions ? _actionBar() : null,
    );
  }

  Widget _headerBand(String brand) {
    final tint = tintFor(brand);
    final eyebrow = recipient.isPending ? 'NEW OFFER' : 'OFFER';
    return Container(
      color: tint.bg,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.workspace_premium_outlined, color: tint.fg, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow,
                  style: TextStyle(
                    color: tint.fg,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  brand,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusBadges() {
    final badges = <Widget>[];
    if (recipient.isSelected) {
      badges.add(StatusBadge.selected());
    } else if (recipient.isPassedOver) {
      badges.add(recipient.card?.status == 'assigned'
          ? StatusBadge.closed()
          : StatusBadge.passedOver());
    } else if (recipient.isAccepted) {
      badges.add(StatusBadge.accepted());
    } else if (recipient.isRejected) {
      badges.add(StatusBadge.rejected());
    }
    if (recipient.isCancelled) badges.add(StatusBadge.cancelled());

    if (badges.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 8, runSpacing: 6, children: badges);
  }

  Widget _actionBar() {
    // Inactive-profile guard — mirrors the web app: an inactive talent can't
    // accept/decline until support reactivates them.
    final me = ref.watch(talentMeProvider);
    final isActive = me.value?.isActive ?? true;

    if (!isActive) {
      return SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.warningBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
          ),
          child: const Row(
            children: [
              Icon(Icons.lock_outline_rounded, color: AppColors.warning, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Your profile is inactive. Contact support to reactivate before responding.',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final ctaLabel = (recipient.card?.ctaLabel ?? '').trim().isNotEmpty
        ? recipient.card!.ctaLabel!.trim()
        : 'Accept';

    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _loading ? null : () => _respond('reject'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.danger,
                side: const BorderSide(color: AppColors.danger, width: 1.5),
              ),
              child: const Text('Decline'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _loading ? null : () => _respond('accept'),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(ctaLabel),
            ),
          ),
        ],
      ),
    );
  }
}
