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
      return (fg: AppColors.primary, bg: AppColors.accentWash);
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
                  Icon(icon, size: 18, color: AppColors.textPrimary),
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

// ─── Count badge (nav / inbox) ───────────────────────────────────────────────

class CountBadge extends StatelessWidget {
  final int count;
  const CountBadge(this.count, {super.key});

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();
    return Container(
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.all(Radius.circular(99)),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

// ─── Soft segmented tabs (Home, offers, jobs) ────────────────────────────────

class SegmentTab {
  final String key;
  final String label;
  final int count;
  const SegmentTab({required this.key, required this.label, this.count = 0});
}

class SoftSegmentedTabs extends StatelessWidget {
  final List<SegmentTab> tabs;
  final String activeKey;
  final ValueChanged<String> onChange;
  final bool expanded;

  const SoftSegmentedTabs({
    super.key,
    required this.tabs,
    required this.activeKey,
    required this.onChange,
    this.expanded = false,
  });

  @override
  Widget build(BuildContext context) {
    final row = Row(
      mainAxisSize: expanded ? MainAxisSize.max : MainAxisSize.min,
      children: [
        for (final t in tabs) ...[
          if (expanded)
            Expanded(child: _chip(t))
          else
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: _chip(t),
            ),
        ],
      ],
    );

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: expanded
          ? row
          : SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: row,
            ),
    );
  }

  Widget _chip(SegmentTab t) {
    final active = t.key == activeKey;
    return GestureDetector(
      onTap: () => onChange(t.key),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: active
              ? const [
                  BoxShadow(
                    color: Color(0x1A000000),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ]
              : null,
        ),
        // Scale-down fit: on narrow screens the whole label+badge shrinks
        // slightly instead of truncating or painting over the neighbouring
        // segment.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                t.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontFamily: 'Inter',
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color:
                      active ? AppColors.textPrimary : AppColors.textSecondary,
                ),
              ),
              if (t.count > 0) ...[
                const SizedBox(width: 4),
                Container(
                  constraints:
                      const BoxConstraints(minWidth: 18, minHeight: 18),
                  padding: const EdgeInsets.symmetric(horizontal: 5),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: active ? AppColors.accentWash : AppColors.border,
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    t.count > 99 ? '99+' : '${t.count}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color:
                          active ? AppColors.textPrimary : AppColors.textSecondary,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Equal-width ink tabs used by Notifications (Unread / All / Read).
class InkSegmentedTabs extends StatelessWidget {
  final List<SegmentTab> tabs;
  final String activeKey;
  final ValueChanged<String> onChange;

  const InkSegmentedTabs({
    super.key,
    required this.tabs,
    required this.activeKey,
    required this.onChange,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          for (final t in tabs)
            Expanded(
              child: GestureDetector(
                onTap: () => onChange(t.key),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: t.key == activeKey ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        t.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: t.key == activeKey ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                      if (t.count > 0) ...[
                        const SizedBox(width: 6),
                        Text(
                          t.count > 99 ? '99+' : '${t.count}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: t.key == activeKey
                                ? Colors.white70
                                : AppColors.textMuted,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Hero card (welcome / notifications) ─────────────────────────────────────

class HeroCard extends StatelessWidget {
  final String? eyebrow;
  final String title;
  final String? titleHighlight;
  final String? subtitle;
  final Widget? trailing;
  final bool live;

  const HeroCard({
    super.key,
    this.eyebrow,
    required this.title,
    this.titleHighlight,
    this.subtitle,
    this.trailing,
    this.live = false,
  });

  @override
  Widget build(BuildContext context) {
    final hasEyebrow = (eyebrow != null && eyebrow!.isNotEmpty) ||
        live ||
        trailing != null;
    final hasSubtitle = subtitle != null && subtitle!.isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Colors.white, Color(0xFFFFFEF5)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasEyebrow) ...[
            Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _EyebrowPill(label: eyebrow ?? ''),
                if (live) const _LivePill(),
                ?trailing,
              ],
            ),
            const SizedBox(height: 10),
          ],
          Text.rich(
            TextSpan(
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.6,
                height: 1.15,
                color: AppColors.textPrimary,
              ),
              children: [
                TextSpan(text: title),
                if (titleHighlight != null && titleHighlight!.isNotEmpty)
                  WidgetSpan(
                    alignment: PlaceholderAlignment.baseline,
                    baseline: TextBaseline.alphabetic,
                    child: Container(
                      margin: const EdgeInsets.only(left: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        titleHighlight!,
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.6,
                          height: 1.15,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (hasSubtitle) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _EyebrowPill extends StatelessWidget {
  final String label;
  const _EyebrowPill({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppColors.primary, width: 1.5),
        boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(2, 2))],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: AppColors.accent,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.black, width: 1),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _LivePill extends StatelessWidget {
  const _LivePill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.accent,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppColors.primary, width: 1.5),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.circle, size: 7, color: AppColors.primary),
          SizedBox(width: 6),
          Text(
            'Live',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── More list row ───────────────────────────────────────────────────────────

class MoreRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;
  final int badge;
  final bool locked;

  const MoreRow({
    super.key,
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
    this.badge = 0,
    this.locked = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 20, color: AppColors.textSecondary),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          label,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      if (badge > 0) ...[
                        const SizedBox(width: 8),
                        Pill(label: '$badge', variant: BadgeVariant.indigo),
                      ],
                      if (locked) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.lock_outline, size: 14, color: AppColors.textMuted),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 16, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class GroupedCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const GroupedCard({super.key, required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
                color: AppColors.textMuted,
              ),
            ),
          ),
          for (int i = 0; i < children.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.border),
            children[i],
          ],
        ],
      ),
    );
  }
}

// ─── Brand mark + brutal login CTA ───────────────────────────────────────────

class BrandMark extends StatelessWidget {
  final double size;
  final String letters;
  const BrandMark({super.key, this.size = 32, this.letters = 'SH'});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(size * 0.25),
      ),
      child: Text(
        letters,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.34,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

class BrutalPrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final Widget? trailing;

  const BrutalPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.accent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: loading ? null : onPressed,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          decoration: BoxDecoration(
            // Fill is required: without it the solid offset shadow paints
            // over the yellow Material and the button renders black-on-black.
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.primary, width: 2),
            boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(4, 4))],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading)
                const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.primary,
                  ),
                )
              else ...[
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 6),
                  trailing!,
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

