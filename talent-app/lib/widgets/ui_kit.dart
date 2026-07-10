import 'package:flutter/material.dart';
import '../core/theme.dart';

/// Shared, low-level UI atoms used across the redesigned surfaces.

// ─── Badge pills ─────────────────────────────────────────────────────────────

/// Colour families matching the web's `BadgeVariantName`.
enum BadgeVariant { green, yellow, red, gray, indigo, blue }

({Color fg, Color bg}) _variantColors(BadgeVariant v) {
  switch (v) {
    case BadgeVariant.green:
      return (fg: AppColors.success, bg: AppColors.successBg);
    case BadgeVariant.yellow:
      return (fg: AppColors.selectedGold, bg: AppColors.selectedBg);
    case BadgeVariant.red:
      return (fg: AppColors.danger, bg: AppColors.dangerBg);
    case BadgeVariant.gray:
      return (fg: AppColors.textTertiary, bg: AppColors.divider);
    case BadgeVariant.indigo:
      return (fg: AppColors.primary, bg: Color(0x1A4F46E5));
    case BadgeVariant.blue:
      return (fg: AppColors.info, bg: AppColors.infoBg);
  }
}

/// Maps a job funnel stage to its badge colour (ported from shared.ts).
BadgeVariant funnelStageVariant(String? stage) {
  switch (stage) {
    case 'shortlisted':
    case 'selected':
    case 'hired':
    case 'placed':
      return BadgeVariant.green;
    case 'interview_invited':
    case 'interview':
    case 'offer':
      return BadgeVariant.indigo;
    case 'on_hold':
      return BadgeVariant.yellow;
    case 'rejected':
    case 'withdrawn':
    case 'declined':
      return BadgeVariant.red;
    default:
      return BadgeVariant.blue;
  }
}

class Pill extends StatelessWidget {
  final String label;
  final BadgeVariant variant;
  final IconData? icon;

  const Pill({
    super.key,
    required this.label,
    this.variant = BadgeVariant.gray,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final c = _variantColors(variant);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: c.fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: c.fg,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Info chip (icon + label) ────────────────────────────────────────────────

class InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const InfoChip({super.key, required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textSecondary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: c),
        const SizedBox(width: 5),
        Flexible(
          child: Text(
            label,
            style: TextStyle(color: c, fontSize: 13, fontWeight: FontWeight.w500),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ─── Section label (small caps heading) ──────────────────────────────────────

class SectionLabel extends StatelessWidget {
  final String text;
  final EdgeInsetsGeometry padding;

  const SectionLabel(
    this.text, {
    super.key,
    this.padding = const EdgeInsets.only(bottom: 8),
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding,
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          color: AppColors.textTertiary,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}

// ─── Error + retry ───────────────────────────────────────────────────────────

class AppErrorRetry extends StatelessWidget {
  final VoidCallback onRetry;
  final String message;

  const AppErrorRetry({
    super.key,
    required this.onRetry,
    this.message = 'Failed to load',
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_outlined, size: 48, color: AppColors.textTertiary),
          const SizedBox(height: 16),
          Text(message, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

// ─── Titled section card ─────────────────────────────────────────────────────

class TitledCard extends StatelessWidget {
  final String title;
  final IconData? icon;
  final Widget child;
  final Widget? trailing;

  const TitledCard({
    super.key,
    required this.title,
    this.icon,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: AppColors.primary),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                ?trailing,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

/// A vertical list of bulleted lines.
class BulletList extends StatelessWidget {
  final List<String> items;
  const BulletList(this.items, {super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 7, right: 10),
                  child: CircleAvatar(radius: 2.5, backgroundColor: AppColors.textTertiary),
                ),
                Expanded(
                  child: Text(
                    item,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// A wrap of small outlined "keyword" chips (skills, perks, benefits).
class KeywordChips extends StatelessWidget {
  final List<String> items;
  const KeywordChips(this.items, {super.key});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final item in items)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              item,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Business/brand avatar (logo or tinted initials) ─────────────────────────

class LogoAvatar extends StatelessWidget {
  final String? logoUrl;
  final String initials;
  final Color bg;
  final Color fg;
  final double size;

  const LogoAvatar({
    super.key,
    this.logoUrl,
    required this.initials,
    required this.bg,
    required this.fg,
    this.size = 44,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * 0.28);
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: radius,
        child: Image.network(
          logoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _initials(radius),
        ),
      );
    }
    return _initials(radius);
  }

  Widget _initials(BorderRadius radius) => Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(color: bg, borderRadius: radius),
        child: Text(
          initials,
          style: TextStyle(
            color: fg,
            fontSize: size * 0.36,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}
