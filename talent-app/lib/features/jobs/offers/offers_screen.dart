import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../models/job_offer.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/shimmer_loading.dart';
import '../../../widgets/ui_kit.dart';
import '../../subscriptions/widgets/empty_state.dart';

/// Maps an offer status to a display badge.
({String label, BadgeVariant variant}) offerStatusBadge(String status) {
  switch (status) {
    case 'sent':
      return (label: 'New offer', variant: BadgeVariant.blue);
    case 'negotiating':
      return (label: 'Negotiating', variant: BadgeVariant.yellow);
    case 'countered':
      return (label: 'Countered', variant: BadgeVariant.yellow);
    case 'accepted':
      return (label: 'Accepted', variant: BadgeVariant.green);
    case 'declined':
      return (label: 'Declined', variant: BadgeVariant.gray);
    case 'withdrawn':
      return (label: 'Withdrawn', variant: BadgeVariant.gray);
    case 'expired':
      return (label: 'Expired', variant: BadgeVariant.red);
    default:
      return (label: humanize(status), variant: BadgeVariant.gray);
  }
}

class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offers = ref.watch(offersListProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Offers')),
      body: offers.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(offersListProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(offersListProvider);
            await ref.read(offersListProvider.future);
          },
          child: items.isEmpty
              ? ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: EmptyState(
                        icon: Icons.mail_outline,
                        title: 'No offers yet',
                        subtitle:
                            "When a business extends you an offer, it'll show up here.",
                      ),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _OfferCard(offer: items[i]),
                ),
        ),
      ),
    );
  }
}

class _OfferCard extends StatelessWidget {
  final JobOffer offer;
  const _OfferCard({required this.offer});

  @override
  Widget build(BuildContext context) {
    final business = offer.businessName ?? 'Business';
    final tint = tintFor(business);
    final badge = offerStatusBadge(offer.status);
    final confirmed = offer.compensation.confirmed;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/offer/${offer.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  LogoAvatar(
                    initials: initialsFor(business),
                    bg: tint.bg,
                    fg: tint.fg,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          offer.positionTitle,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          business,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Pill(label: badge.label, variant: badge.variant),
                ],
              ),
              if (confirmed != null && confirmed.amount != null) ...[
                const SizedBox(height: 12),
                Text(
                  '${formatMoney(confirmed.amount, offer.compensation.currency)}${confirmed.cadence != null ? ' / ${confirmed.cadence}' : ''}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              if (formatDateShort(offer.expiresOn).isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  'Respond by ${formatDate(offer.expiresOn)}',
                  style: const TextStyle(color: AppColors.textTertiary, fontSize: 12.5),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
