import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format.dart';
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
  bool _showThread = false;

  SubscriptionCardRecipient get recipient => widget.recipient;

  // Only a live offer is respondable. An expired/filled card — status != 'active'
  // (e.g. 'assigned' once another talent was selected) — is read-only: no
  // Accept/Decline, just like the web. Pending tab cards are always 'active'.
  bool get _showActions =>
      recipient.isPending &&
      !recipient.isCancelled &&
      recipient.card?.status == 'active';

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

  Future<void> _respondToOffer(String action) async {
    setState(() => _loading = true);
    try {
      await ref.read(subscriptionServiceProvider).respondToOffer(
            recipient.id,
            action: action,
          );
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(offerDetailProvider(recipient.id));
      if (!mounted) return;
      _snack(
        action == 'withdraw'
            ? 'Offer withdrawn'
            : action == 'accept'
                ? 'Offer accepted!'
                : 'Offer declined',
        action == 'accept' ? AppColors.success : AppColors.textSecondary,
      );
      if (action != 'withdraw') context.pop();
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _snack(_errorMessage(e), AppColors.danger);
    }
  }

  static const int _offerStep = 500;

  Future<void> _openBidSheet() async {
    final card = recipient.card;
    final base = (card?.monthlyPrice?.toInt() ?? _offerStep);
    final snapped = base <= 0
        ? _offerStep
        : ((base / _offerStep).round() * _offerStep).clamp(_offerStep, 1 << 30);
    var amount = snapped;
    final isAssignment = card?.isAssignment ?? false;
    final period = isAssignment ? 'project' : 'per_month';

    final submitted = await showModalBottomSheet<int>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModal) {
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                16,
                20,
                16 + MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    isAssignment ? 'Counter-offer' : 'Place your bid',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Adjust in steps of ₹$_offerStep',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton.outlined(
                        onPressed: amount <= _offerStep
                            ? null
                            : () => setModal(() => amount -= _offerStep),
                        icon: const Icon(Icons.remove),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          '₹${amount.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      IconButton.outlined(
                        onPressed: () => setModal(() => amount += _offerStep),
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(ctx).pop(amount),
                      child: Text(isAssignment ? 'Submit offer' : 'Submit bid'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    if (submitted == null || !mounted) return;
    setState(() => _loading = true);
    try {
      await ref.read(subscriptionServiceProvider).submitOffer(
            recipient.id,
            amount: submitted,
            currency: card?.currency ?? 'INR',
            period: period,
          );
      ref.invalidate(subscriptionListProvider);
      ref.invalidate(offerDetailProvider(recipient.id));
      if (!mounted) return;
      _snack('Bid submitted', AppColors.success);
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
                      if (_showActions) ...[
                        const SizedBox(height: 16),
                        _OfferDetailSection(recipientId: recipient.id),
                      ],
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
    } else if (recipient.isPending && recipient.card?.status == 'assigned') {
      // Never responded and the card went to someone else — read-only.
      badges.add(StatusBadge.expired());
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
              style: _actionButtonStyle(color: AppColors.danger),
              child: const Text(
                'Decline',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: OutlinedButton(
              onPressed: _loading ? null : _openBidSheet,
              style: _actionButtonStyle(),
              child: Text(
                (recipient.card?.isAssignment ?? false) ? 'Counter' : 'Bid',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _loading ? null : () => _respond('accept'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(0, 46),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
              ),
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      ctaLabel,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
            ),
          ),
        ],
      ),
    );
  }

  /// Bottom-bar variant of [OutlinedButton]: tight horizontal padding so short
  /// labels never wrap inside their Expanded cell, fixed height so all three
  /// actions line up.
  ButtonStyle _actionButtonStyle({Color? color}) => OutlinedButton.styleFrom(
        foregroundColor: color ?? AppColors.textPrimary,
        side: color == null
            ? null
            : BorderSide(color: color, width: 1.2),
        minimumSize: const Size(0, 46),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
      );
}

/// Shows the current negotiation state, bids remaining, and activity thread
/// when an offer exists for this recipient. Matches the web's
/// `AssignmentOfferActions` component.
class _OfferDetailSection extends ConsumerWidget {
  final String recipientId;
  const _OfferDetailSection({required this.recipientId});

  static const _actionLabels = {
    'submitted': 'submitted an offer',
    'countered': 'sent a counter-offer',
    'accepted': 'accepted the offer',
    'declined': 'declined the offer',
    'withdrawn': 'withdrew the offer',
    'expired': 'offer expired',
    'question_asked': 'asked a question',
    'question_answered': 'answered a question',
  };

  static const _openStatuses = {'pending_business', 'pending_talent', 'accepted'};

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(offerDetailProvider(recipientId));

    return offerAsync.when(
      loading: () => const SizedBox(
        height: 60,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (data) {
        if (data == null) return const SizedBox.shrink();

        final offer = data['offer'] as Map<String, dynamic>?;
        final events = (data['events'] as List<dynamic>?) ?? [];
        final bidsLeft = data['talent_bids_remaining'] as int? ?? 3;

        if (offer == null) {
          // No offer yet — just show bids remaining
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              'Bids left on this card: $bidsLeft/3',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textTertiary,
              ),
            ),
          );
        }

        final status = offer['status'] as String? ?? '';
        final isOpen = _openStatuses.contains(status);
        final currentAmount = offer['current_amount'] as Map<String, dynamic>?;
        final formattedAmount = _formatAmount(currentAmount);

        // Determine the label for the current figure
        String figureLabel;
        if (status == 'pending_talent') {
          figureLabel = 'Business offer';
        } else if (status == 'accepted') {
          figureLabel = 'Agreed';
        } else {
          figureLabel = 'Your bid';
        }

        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Current figure
              if (isOpen && formattedAmount.isNotEmpty) ...[
                Text(
                  figureLabel,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  formattedAmount,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (status == 'pending_business') ...[
                  const SizedBox(height: 4),
                  const Text(
                    'Waiting for the business to respond.',
                    style: TextStyle(fontSize: 12, color: AppColors.textTertiary),
                  ),
                ],
                const SizedBox(height: 8),
              ],
              // Bids remaining
              Text(
                'Bids left on this card: $bidsLeft/3',
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.textTertiary,
                ),
              ),
              // Activity thread toggle
              if (events.isNotEmpty) ...[
                const SizedBox(height: 12),
                GestureDetector(
                  onTap: () {
                    // Toggle thread visibility - using setState via parent
                    // For now, navigate to a detail view
                  },
                  child: Text(
                    'View activity (${events.length})',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textSecondary,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  String _formatAmount(Map<String, dynamic>? amount) {
    if (amount == null) return '';
    final value = amount['amount'];
    if (value == null) return '';
    final numValue = value is num ? value : num.tryParse(value.toString());
    if (numValue == null) return '';

    final period = amount['period'] as String?;
    final formatted = '₹${numValue.toInt().toStringAsFixed(0)}';
    final periodLabel = switch (period) {
      'per_month' => '/month',
      'per_week' => '/week',
      'per_day' => '/day',
      'per_hour' => '/hour',
      'project' => '',
      _ => '',
    };
    return '$formatted$periodLabel';
  }
}
