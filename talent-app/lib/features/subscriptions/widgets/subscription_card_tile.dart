import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme.dart';
import '../../../models/subscription_card.dart';

class SubscriptionCardTile extends StatelessWidget {
  final SubscriptionCard card;

  const SubscriptionCardTile({super.key, required this.card});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(context),
            if (_hasHours) ...[
              const SizedBox(height: 16),
              _buildHoursSection(context),
            ],
            if (_deliverables.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildDeliverablesSection(context),
            ],
            if (_hasPrice) ...[
              const SizedBox(height: 16),
              _buildPaymentSection(context),
            ],
            if (_hasSecondaryDetails) ...[
              const SizedBox(height: 16),
              _buildSecondaryDetails(context),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final title = card.title ?? card.subscriptionName ?? 'Subscription Offer';
    final planName = card.planName;
    final brandName = card.brandName;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (brandName != null && brandName.isNotEmpty) ...[
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  brandName,
                  style: const TextStyle(
                    color: AppColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        if (planName != null && planName.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            planName,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.textSecondary,
                ),
          ),
        ],
      ],
    );
  }

  bool get _hasHours =>
      (card.hoursLabel != null && card.hoursLabel!.isNotEmpty) ||
      (card.capacityLabel != null && card.capacityLabel!.isNotEmpty);

  Widget _buildHoursSection(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.infoBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.schedule_outlined, color: AppColors.info, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (card.hoursLabel != null && card.hoursLabel!.isNotEmpty)
                  Text(
                    card.hoursLabel!,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                if (card.capacityLabel != null && card.capacityLabel!.isNotEmpty)
                  Text(
                    card.capacityLabel!,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<_DeliverableItem> get _deliverables {
    final raw = card.customDeliverables;
    if (raw == null) return [];
    final items = <_DeliverableItem>[];
    for (final item in raw) {
      if (item is String) {
        final label = item.trim();
        if (label.isNotEmpty) items.add(_DeliverableItem(label: label));
      } else if (item is Map<String, dynamic>) {
        final kind = (item['kind'] as String?) ?? '';
        if (kind == 'hours') continue;
        final label = (item['label'] as String? ?? item['name'] as String? ?? item['title'] as String? ?? '').trim();
        final desc = (item['description'] as String? ?? _formatCadence(item)).trim();
        if (label.isNotEmpty || desc.isNotEmpty) {
          items.add(_DeliverableItem(label: label.isEmpty ? '—' : label, description: desc.isEmpty ? null : desc));
        }
      }
    }
    return items;
  }

  String _formatCadence(Map<String, dynamic> d) {
    final parts = <String>[];
    final perDay = (d['per_day'] as num?) ?? 0;
    final perWeek = (d['per_week'] as num?) ?? 0;
    final perMonth = (d['per_month'] as num?) ?? 0;
    if (perDay > 0) parts.add('$perDay/day');
    if (perWeek > 0) parts.add('$perWeek/week');
    if (perMonth > 0) parts.add('$perMonth/month');
    return parts.join(' · ');
  }

  Widget _buildDeliverablesSection(BuildContext context) {
    final items = _deliverables;
    final label = card.deliverablesLabel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.checklist_outlined, color: AppColors.textSecondary, size: 18),
            const SizedBox(width: 6),
            Text(
              label ?? 'Deliverables',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        ...items.map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 7),
                    width: 5,
                    height: 5,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.label,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        if (item.description != null)
                          Text(
                            item.description!,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 12,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  bool get _hasPrice =>
      card.priceLabel != null ||
      (card.monthlyPrice != null && card.monthlyPrice! > 0);

  Widget _buildPaymentSection(BuildContext context) {
    String priceText;
    if (card.priceLabel != null && card.priceLabel!.isNotEmpty) {
      priceText = card.priceLabel!;
    } else {
      priceText = _formatPrice(card.monthlyPrice, card.currency);
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.successBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.payments_outlined, color: AppColors.success, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Monthly',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                Text(
                  priceText,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 18,
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

  String _formatPrice(num? amount, String? currency) {
    if (amount == null) return '';
    final cur = (currency != null && currency.isNotEmpty) ? currency : 'INR';
    try {
      final format = NumberFormat.simpleCurrency(name: cur, decimalDigits: 0);
      return format.format(amount);
    } catch (_) {
      return '$cur ${amount.toStringAsFixed(0)}';
    }
  }

  bool get _hasSecondaryDetails =>
      (card.workingDays != null && card.workingDays!.isNotEmpty) ||
      (card.businessNature != null && card.businessNature!.isNotEmpty) ||
      (card.notes != null && card.notes!.isNotEmpty) ||
      (card.targetCountryNames != null && card.targetCountryNames!.isNotEmpty) ||
      (card.targetLanguages != null && card.targetLanguages!.isNotEmpty);

  Widget _buildSecondaryDetails(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Divider(color: AppColors.divider, height: 1),
        const SizedBox(height: 16),
        if (card.workingDays != null && card.workingDays!.isNotEmpty) ...[
          _buildDetailRow(
            Icons.calendar_today_outlined,
            'Working Days',
            card.workingDays!.cast<String>().join(', '),
          ),
          const SizedBox(height: 10),
        ],
        if (card.businessNature != null && card.businessNature!.isNotEmpty) ...[
          _buildDetailRow(
            Icons.business_outlined,
            'Business',
            card.businessNature!,
          ),
          const SizedBox(height: 10),
        ],
        if (card.notes != null && card.notes!.isNotEmpty) ...[
          _buildDetailRow(
            Icons.notes_outlined,
            'Notes',
            card.notes!,
          ),
          const SizedBox(height: 10),
        ],
        if (card.targetCountryNames != null && card.targetCountryNames!.isNotEmpty) ...[
          _buildDetailRow(
            Icons.public_outlined,
            'Countries',
            card.targetCountryNames!.cast<String>().join(', '),
          ),
          const SizedBox(height: 10),
        ],
        if (card.targetLanguages != null && card.targetLanguages!.isNotEmpty) ...[
          _buildDetailRow(
            Icons.translate_outlined,
            'Languages',
            card.targetLanguages!.cast<String>().join(', '),
          ),
        ],
      ],
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppColors.textTertiary),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DeliverableItem {
  final String label;
  final String? description;
  _DeliverableItem({required this.label, this.description});
}
