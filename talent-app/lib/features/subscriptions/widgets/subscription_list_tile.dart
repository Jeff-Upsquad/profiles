import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../models/subscription_card.dart';

/// Compact, tappable row for a subscription — used by both the Pending and
/// Responded lists. Tapping opens the full detail screen.
class SubscriptionListTile extends StatelessWidget {
  final SubscriptionCardRecipient recipient;
  final VoidCallback onTap;

  /// Optional trailing content (status badges, time) shown before the chevron.
  final Widget? trailing;

  /// Fades the row (e.g. cancelled offers).
  final bool dimmed;

  const SubscriptionListTile({
    super.key,
    required this.recipient,
    required this.onTap,
    this.trailing,
    this.dimmed = false,
  });

  String get _heading {
    final card = recipient.card;
    final brand = (card?.brandName ?? '').trim();
    if (brand.isNotEmpty) return brand;
    final title = (card?.title ?? '').trim();
    return title.isNotEmpty ? title : 'Subscription';
  }

  String get _subheading {
    final card = recipient.card;
    final line = [
      (card?.subscriptionName ?? '').trim(),
      (card?.planName ?? '').trim(),
    ].where((s) => s.isNotEmpty).join(' · ');
    return line.isNotEmpty ? line : '—';
  }

  @override
  Widget build(BuildContext context) {
    final tint = tintFor(_heading);

    return Material(
      color: Colors.white,
      child: InkWell(
        onTap: onTap,
        child: Opacity(
          opacity: dimmed ? 0.6 : 1.0,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: tint.bg,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.workspace_premium_outlined,
                      size: 20, color: tint.fg),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _heading,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _subheading,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 8),
                  trailing!,
                ],
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded,
                    color: AppColors.textTertiary, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
