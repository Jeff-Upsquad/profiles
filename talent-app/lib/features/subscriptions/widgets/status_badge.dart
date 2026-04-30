import 'package:flutter/material.dart';
import '../../../core/theme.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color color;
  final Color backgroundColor;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    required this.color,
    required this.backgroundColor,
    this.icon,
  });

  factory StatusBadge.accepted() => const StatusBadge(
        label: 'Accepted',
        color: AppColors.success,
        backgroundColor: AppColors.successBg,
        icon: Icons.check_circle_outline,
      );

  factory StatusBadge.rejected() => const StatusBadge(
        label: 'Declined',
        color: AppColors.danger,
        backgroundColor: AppColors.dangerBg,
        icon: Icons.cancel_outlined,
      );

  factory StatusBadge.cancelled() => const StatusBadge(
        label: 'Cancelled',
        color: AppColors.textTertiary,
        backgroundColor: AppColors.divider,
        icon: Icons.block_outlined,
      );

  factory StatusBadge.selected() => const StatusBadge(
        label: 'Selected',
        color: AppColors.selectedGold,
        backgroundColor: AppColors.selectedBg,
        icon: Icons.star_outline_rounded,
      );

  factory StatusBadge.passedOver() => const StatusBadge(
        label: 'Not Selected',
        color: AppColors.textTertiary,
        backgroundColor: AppColors.divider,
        icon: Icons.remove_circle_outline,
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
