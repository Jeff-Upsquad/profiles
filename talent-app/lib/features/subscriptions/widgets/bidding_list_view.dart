import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../core/subscription_utils.dart';
import '../../../models/subscription_card.dart';
import '../../../providers/providers.dart';
import 'empty_state.dart';
import 'status_badge.dart';

const _openStatuses = {'pending_business', 'pending_talent'};

const _statusMeta = {
  'pending_business': ('Awaiting business', AppColors.warningBg, AppColors.warning),
  'pending_talent': ('Offer received', Color(0xFFE0E7FF), Color(0xFF4F46E5)),
  'accepted': ('Accepted', Color(0xFFEAF7EE), AppColors.success),
  'declined': ('Declined', Color(0xFFFDECEE), AppColors.danger),
  'withdrawn': ('Withdrawn', AppColors.surface, AppColors.textSecondary),
  'expired': ('Expired', AppColors.surface, AppColors.textTertiary),
};

/// Bidding tab — shows all active bids/offers across cards.
/// Matches the web's `BiddingListView` component.
class BiddingListView extends ConsumerWidget {
  const BiddingListView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offersAsync = ref.watch(talentCardOffersProvider);

    return offersAsync.when(
      loading: () => const _LoadingSkeleton(),
      error: (_, _) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: const Center(
          child: Text(
            'Could not load your bids. Please try again.',
            style: TextStyle(color: AppColors.danger, fontSize: 14),
          ),
        ),
      ),
      data: (offers) {
        if (offers.isEmpty) {
          return const Padding(
            padding: EdgeInsets.only(top: 56),
            child: EmptyState(
              icon: Icons.request_quote_outlined,
              title: 'No bids yet',
              subtitle:
                  'When you bid on a subscription or a business sends you an offer, it will show up here.',
            ),
          );
        }

        final businessOffers = offers
            .where((o) => o['status'] == 'pending_talent')
            .toList();
        final yourBids = offers
            .where((o) => o['status'] == 'pending_business')
            .toList();
        final closed = offers
            .where((o) => !_openStatuses.contains(o['status']))
            .toList();

        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (businessOffers.isNotEmpty) ...[
                _Section(
                  title: 'New offers for you',
                  subtitle:
                      'Business sent a figure — tap to counter, accept, or decline.',
                  children: businessOffers
                      .map((o) => _BiddingRow(offer: o, emphasize: true))
                      .toList(),
                ),
                const SizedBox(height: 20),
              ],
              if (yourBids.isNotEmpty) ...[
                _Section(
                  title: 'Your bids',
                  subtitle:
                      'Waiting on the business. Tap for full details and actions.',
                  children: yourBids
                      .map((o) => _BiddingRow(offer: o))
                      .toList(),
                ),
                const SizedBox(height: 20),
              ],
              if (closed.isNotEmpty) ...[
                _Section(
                  title: 'Closed',
                  subtitle:
                      'Accepted, declined, withdrawn, or expired negotiations.',
                  children: closed
                      .map((o) => _BiddingRow(offer: o))
                      .toList(),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String? subtitle;
  final List<Widget> children;

  const _Section({
    required this.title,
    this.subtitle,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.textPrimary,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle!,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textTertiary,
            ),
          ),
        ],
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: AppShadows.soft,
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _BiddingRow extends StatelessWidget {
  final Map<String, dynamic> offer;
  final bool emphasize;

  const _BiddingRow({required this.offer, this.emphasize = false});

  @override
  Widget build(BuildContext context) {
    final status = offer['status'] as String? ?? '';
    final meta = _statusMeta[status] ?? ('Unknown', AppColors.surface, AppColors.textTertiary);
    final cardType = offer['card_type'] as String? ?? 'subscription';
    final brandName = offer['brand_name'] as String? ?? '';
    final cardTitle = offer['card_title'] as String? ?? '';
    final cardContent = offer['card_content'] as Map<String, dynamic>? ?? {};

    // Build display name (matches web's cardDisplayName)
    final title = cardContent['title'] as String? ?? '';
    final sub = cardContent['subscription_name'] as String? ?? '';
    final plan = cardContent['plan_name'] as String? ?? '';
    final displayName = title.isNotEmpty
        ? title
        : [brandName, sub, plan].where((s) => s.isNotEmpty).join(' · ');
    final subheading = [sub, plan].where((s) => s.isNotEmpty).join(' · ');

    // Format amount
    final currentAmount = offer['current_amount'] as Map<String, dynamic>?;
    final amount = _formatAmount(currentAmount);

    // Bid label
    String bidLabel;
    if (status == 'pending_talent') {
      bidLabel = 'They offered';
    } else if (status == 'pending_business') {
      bidLabel = 'Your bid';
    } else {
      bidLabel = 'Latest';
    }

    final tint = tintFor(displayName.isNotEmpty ? displayName : 'Subscription');

    return Container(
      color: emphasize ? const Color(0xFFF5F3FF) : null,
      child: InkWell(
        onTap: () => context.push('/subscription-detail', extra: _toRecipient()),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: tint.bg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  Icons.request_quote_outlined,
                  color: tint.fg,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            displayName.isNotEmpty ? displayName : (cardType == 'assignment' ? 'Assignment' : 'Subscription'),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _StatusBadge(label: meta.$1, bgColor: meta.$2, fgColor: meta.$3),
                      ],
                    ),
                    if (subheading.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subheading,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textTertiary,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '$bidLabel: ',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          TextSpan(
                            text: amount,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                size: 20,
                color: AppColors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatAmount(Map<String, dynamic>? amount) {
    if (amount == null) return '—';
    final value = amount['amount'];
    if (value == null) return '—';
    final numValue = value is num ? value : num.tryParse(value.toString());
    if (numValue == null) return '—';

    final currency = amount['currency'] as String? ?? 'INR';
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

  /// Convert offer map back to a SubscriptionCardRecipient for navigation.
  SubscriptionCardRecipient _toRecipient() {
    final cardContent = offer['card_content'] as Map<String, dynamic>? ?? {};
    return SubscriptionCardRecipient(
      id: offer['recipient_id'] as String? ?? offer['id'] as String? ?? '',
      status: 'pending',
      respondedAt: offer['responded_at'] as String?,
      card: SubscriptionCard(
        id: offer['card_id'] as String? ?? '',
        externalId: offer['card_external_id'] as String? ?? '',
        content: cardContent,
        status: offer['card_status'] as String? ?? 'active',
        publishedAt: offer['card_published_at'] as String? ?? offer['created_at'] as String? ?? '',
        expiresAt: offer['card_expires_at'] as String?,
        cardType: offer['card_type'] as String? ?? 'subscription',
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String label;
  final Color bgColor;
  final Color fgColor;

  const _StatusBadge({
    required this.label,
    required this.bgColor,
    required this.fgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fgColor,
        ),
      ),
    );
  }
}

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (i) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          height: 80,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: const Center(
            child: SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        ),
      ),
    );
  }
}
