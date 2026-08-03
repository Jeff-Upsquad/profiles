import 'package:flutter/material.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../core/subscription_utils.dart';
import '../../../models/subscription_card.dart';

/// Full subscription detail — a Flutter port of the web app's
/// `SubscriptionCardContent`. Renders every field SquadHub forwards:
/// header, work commitment (hours + deliverables), payment, working days,
/// client brief, countries, languages, popular ribbon, image and expiry.
class SubscriptionDetailContent extends StatelessWidget {
  final SubscriptionCard card;

  const SubscriptionDetailContent({super.key, required this.card});

  // ─── Derived data ──────────────────────────────────────────────────────────

  String get _title => (card.title ?? '').trim();
  String get _planLine => [
        (card.subscriptionName ?? '').trim(),
        (card.planName ?? '').trim(),
      ].where((s) => s.isNotEmpty).join(' · ');

  String get _hoursLabel => (card.hoursLabel ?? '').trim();
  String get _capacityLabel => (card.capacityLabel ?? '').trim();
  String get _deliverablesLabel => (card.deliverablesLabel ?? '').trim();

  List<_Deliverable> get _deliverables {
    final raw = card.customDeliverables;
    if (raw == null) return [];
    final out = <_Deliverable>[];
    for (final item in raw) {
      if (item is String) {
        final label = item.trim();
        if (label.isNotEmpty) out.add(_Deliverable(label));
      } else if (item is Map<String, dynamic>) {
        if ((item['kind'] as String?)?.trim() == 'hours') continue;
        final label = ((item['label'] as String?) ??
                (item['name'] as String?) ??
                (item['title'] as String?) ??
                '')
            .trim();
        final desc = ((item['description'] as String?)?.trim().isNotEmpty == true
                ? (item['description'] as String).trim()
                : _cadence(item))
            .trim();
        if (label.isNotEmpty || desc.isNotEmpty) {
          out.add(_Deliverable(label.isEmpty ? '—' : label,
              desc.isEmpty ? null : desc));
        }
      }
    }
    return out;
  }

  String _cadence(Map<String, dynamic> d) {
    final parts = <String>[];
    final perDay = (d['per_day'] as num?) ?? 0;
    final perWeek = (d['per_week'] as num?) ?? 0;
    final perMonth = (d['per_month'] as num?) ?? 0;
    if (perDay > 0) parts.add('$perDay/day');
    if (perWeek > 0) parts.add('$perWeek/week');
    if (perMonth > 0) parts.add('$perMonth/month');
    return parts.join(' · ');
  }

  String? get _priceFormatted {
    final label = (card.priceLabel ?? '').trim();
    if (label.isNotEmpty) return label;
    final p = formatPrice(card.monthlyPrice, card.currency);
    return p.isEmpty ? null : p;
  }

  List<String> get _workingDaysSorted {
    // Assignments don't use working days — drop them so the section self-hides.
    if (card.isAssignment) return [];
    final raw = card.workingDays;
    if (raw == null) return [];
    final days = raw.map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
    days.sort((a, b) => weekIndex(a).compareTo(weekIndex(b)));
    return days;
  }

  String get _brandName => (card.brandName ?? '').trim();
  String get _subscriptionName => (card.subscriptionName ?? '').trim();
  String get _planName => (card.planName ?? '').trim();
  String get _businessNature => (card.businessNature ?? '').trim();
  String get _customerLocation => (card.customerLocation ?? '').trim();
  String get _notes => (card.notes ?? '').trim();
  List<String> get _countries =>
      (card.targetCountryNames ?? []).map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();
  List<String> get _languages =>
      (card.targetLanguages ?? []).map((e) => e.toString().trim()).where((s) => s.isNotEmpty).toList();

  // Client brief = engagement identity only (brand / role / plan).
  // About the client = company context under a toggle (nature, location, notes).
  // Requirement is only under Deliverables — never repeated here.
  bool get _hasClientBrief =>
      _brandName.isNotEmpty ||
      _subscriptionName.isNotEmpty ||
      _planName.isNotEmpty;
  bool get _hasAboutClient =>
      _businessNature.isNotEmpty ||
      _customerLocation.isNotEmpty ||
      _notes.isNotEmpty;

  bool get _hasStructured =>
      _hoursLabel.isNotEmpty ||
      _capacityLabel.isNotEmpty ||
      _deliverablesLabel.isNotEmpty ||
      _deliverables.isNotEmpty ||
      _priceFormatted != null ||
      _workingDaysSorted.isNotEmpty ||
      _hasClientBrief ||
      _hasAboutClient ||
      _countries.isNotEmpty ||
      _languages.isNotEmpty;

  // ─── Build ───────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final description = (card.description ?? '').trim();
    final showDescription = description.isNotEmpty && !_hasStructured;
    final imageUrl = (card.imageUrl ?? '').trim();
    final expiresRelative =
        formatRelativeExpiry(card.contentExpiresAt ?? card.expiresAt);

    final children = <Widget>[];

    if (card.isPopular) {
      children.add(_popularRibbon());
      children.add(const SizedBox(height: 4));
    }

    if (imageUrl.startsWith('https://')) {
      children.add(
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            imageUrl,
            height: 150,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => const SizedBox.shrink(),
          ),
        ),
      );
      children.add(const SizedBox(height: 16));
    }

    // Header
    if (_title.isNotEmpty || _planLine.isNotEmpty) {
      children.add(_header(context));
      children.add(const SizedBox(height: 16));
    }

    if (showDescription) {
      children.add(Text(
        description,
        style: const TextStyle(
          color: AppColors.textSecondary,
          fontSize: 14,
          height: 1.5,
        ),
      ));
      children.add(const SizedBox(height: 16));
    }

    // Work commitment
    final hasHours = _hoursLabel.isNotEmpty || _capacityLabel.isNotEmpty;
    final hasDeliverables = _deliverablesLabel.isNotEmpty || _deliverables.isNotEmpty;
    if (hasHours || hasDeliverables) {
      children.add(_workCommitment(context, hasHours, hasDeliverables));
      children.add(const SizedBox(height: 16));
    }

    // Payment
    if (_priceFormatted != null) {
      children.add(_payment(context));
      children.add(const SizedBox(height: 16));
    }

    // Secondary details
    if (_workingDaysSorted.isNotEmpty ||
        _hasClientBrief ||
        _hasAboutClient ||
        _countries.isNotEmpty ||
        _languages.isNotEmpty) {
      children.add(_secondaryDetails(context));
      children.add(const SizedBox(height: 16));
    }

    if (expiresRelative != null) {
      children.add(_expiry(expiresRelative));
      children.add(const SizedBox(height: 4));
    }

    if (children.isNotEmpty && children.last is SizedBox) {
      children.removeLast();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
  }

  Widget _popularRibbon() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Text(
        'POPULAR',
        style: TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
        ),
      ),
    );
  }

  Widget _header(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_title.isNotEmpty)
          Text(
            _title,
            style: Theme.of(context).textTheme.titleLarge,
          ),
        if (_planLine.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            _planLine,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ],
    );
  }

  Widget _workCommitment(BuildContext context, bool hasHours, bool hasDeliverables) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(
          icon: Icons.work_outline_rounded,
          label: 'Work commitment',
          color: kWorkTint.fg,
        ),
        const SizedBox(height: 8),
        // Hours sub-card
        _subCard(
          icon: Icons.schedule_outlined,
          caption: 'Hours',
          child: hasHours
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_hoursLabel.isNotEmpty)
                      Text(_hoursLabel,
                          style: TextStyle(
                              color: kWorkTint.fg,
                              fontSize: 16,
                              fontWeight: FontWeight.w700)),
                    if (_capacityLabel.isNotEmpty)
                      Text(_capacityLabel,
                          style: TextStyle(
                              color: kWorkTint.fg.withValues(alpha: 0.7),
                              fontSize: 12)),
                  ],
                )
              : Text('No hourly commitment',
                  style: TextStyle(
                      color: kWorkTint.fg.withValues(alpha: 0.7),
                      fontSize: 14,
                      fontWeight: FontWeight.w500)),
        ),
        const SizedBox(height: 8),
        // Deliverables sub-card
        _subCard(
          icon: Icons.checklist_rounded,
          caption: 'Deliverables',
          child: hasDeliverables
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_deliverablesLabel.isNotEmpty)
                      Text(_deliverablesLabel,
                          style: TextStyle(
                              color: kWorkTint.fg, fontSize: 14, fontWeight: FontWeight.w500)),
                    if (_deliverables.isNotEmpty)
                      Padding(
                        padding: EdgeInsets.only(top: _deliverablesLabel.isNotEmpty ? 6 : 0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: _deliverables
                              .map((d) => Padding(
                                    padding: const EdgeInsets.only(bottom: 4),
                                    child: Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          margin: const EdgeInsets.only(top: 8),
                                          width: 5,
                                          height: 5,
                                          decoration: BoxDecoration(
                                              color: kWorkTint.fg,
                                              shape: BoxShape.circle),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Wrap(
                                            crossAxisAlignment: WrapCrossAlignment.center,
                                            spacing: 6,
                                            children: [
                                              Text(d.label,
                                                  style: TextStyle(
                                                      color: kWorkTint.fg,
                                                      fontSize: 15,
                                                      fontWeight: FontWeight.w700)),
                                              if (d.description != null)
                                                Text(d.description!,
                                                    style: TextStyle(
                                                        color: kWorkTint.fg
                                                            .withValues(alpha: 0.7),
                                                        fontSize: 12)),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ))
                              .toList(),
                        ),
                      ),
                  ],
                )
              : Text('No specific deliverables',
                  style: TextStyle(
                      color: kWorkTint.fg.withValues(alpha: 0.7),
                      fontSize: 14,
                      fontWeight: FontWeight.w500)),
        ),
      ],
    );
  }

  Widget _subCard({
    required IconData icon,
    required String caption,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kWorkTint.bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: kWorkTint.fg.withValues(alpha: 0.7)),
              const SizedBox(width: 6),
              Text(
                caption.toUpperCase(),
                style: TextStyle(
                  color: kWorkTint.fg.withValues(alpha: 0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          child,
        ],
      ),
    );
  }

  Widget _payment(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionLabel(
          icon: Icons.payments_outlined,
          // Assignments reuse monthly_price as a one-off project budget.
          label: card.isAssignment ? 'Project budget' : 'Payment',
          color: kPaymentColor,
        ),
        const SizedBox(height: 6),
        RichText(
          text: TextSpan(
            text: _priceFormatted,
            style: const TextStyle(
              color: kPaymentColor,
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
            ),
            children: card.isAssignment
                ? const <TextSpan>[]
                : [
                    TextSpan(
                      text: ' /month',
                      style: TextStyle(
                        color: kPaymentColor.withValues(alpha: 0.7),
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ],
          ),
        ),
        if (card.isAssignment &&
            ((card.assignmentDuration ?? '').trim().isNotEmpty ||
                (card.assignmentStartDate ?? '').trim().isNotEmpty ||
                (card.assignmentDeadline ?? '').trim().isNotEmpty)) ...[
          const SizedBox(height: 4),
          Text(
            [
              if ((card.assignmentDuration ?? '').trim().isNotEmpty)
                'Duration: ${card.assignmentDuration!.trim()}',
              if ((card.assignmentStartDate ?? '').trim().isNotEmpty)
                'Starts ${card.assignmentStartDate!.trim()}',
              if ((card.assignmentDeadline ?? '').trim().isNotEmpty)
                'Due ${card.assignmentDeadline!.trim()}',
            ].join('  ·  '),
            style: TextStyle(
              color: kPaymentColor.withValues(alpha: 0.7),
              fontSize: 12,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ],
    );
  }

  Widget _secondaryDetails(BuildContext context) {
    final weekdayDays = _workingDaysSorted.where((d) => !isWeekend(d)).toList();
    final weekendDays = _workingDaysSorted.where(isWeekend).toList();

    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_workingDaysSorted.isNotEmpty) ...[
            _SectionLabel(icon: Icons.calendar_today_outlined, label: 'Working Days'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                ...weekdayDays.map((d) => _Chip(d, highlighted: true)),
                if (weekendDays.isNotEmpty) ...[
                  if (weekdayDays.isNotEmpty)
                    Container(width: 1, height: 14, color: AppColors.border),
                  const Text(
                    'WEEKEND',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.6,
                    ),
                  ),
                  ...weekendDays.map((d) => _Chip(d, highlighted: true)),
                ],
              ],
            ),
            const SizedBox(height: 16),
          ],
          if (_hasClientBrief) ...[
            _SectionLabel(icon: Icons.description_outlined, label: 'Client Brief'),
            const SizedBox(height: 6),
            if (_brandName.isNotEmpty)
              _briefLine('Brand', _brandName, valueBold: true),
            if (_subscriptionName.isNotEmpty)
              _briefLine('Role', _subscriptionName),
            if (_planName.isNotEmpty) _briefLine('Plan', _planName),
            const SizedBox(height: 16),
          ],
          if (_hasAboutClient) ...[
            _AboutClientToggle(
              businessNature: _businessNature,
              customerLocation: _customerLocation,
              notes: _notes,
            ),
            const SizedBox(height: 16),
          ],
          if (_countries.isNotEmpty) ...[
            _SectionLabel(
                icon: Icons.public_outlined,
                label: _countries.length == 1 ? 'Country' : 'Countries'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _countries.map((c) => _Chip(c)).toList(),
            ),
            const SizedBox(height: 16),
          ],
          if (_languages.isNotEmpty) ...[
            _SectionLabel(
                icon: Icons.translate_outlined,
                label: _languages.length == 1 ? 'Language' : 'Languages'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _languages.map((l) => _Chip(l)).toList(),
            ),
            const SizedBox(height: 16),
          ],
        ],
      ),
    );
  }

  Widget _briefLine(String label, String value, {bool valueBold = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: RichText(
        text: TextSpan(
          text: '$label: ',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
          children: [
            TextSpan(
              text: value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: valueBold ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _expiry(String relative) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.timer_outlined, size: 13, color: AppColors.textTertiary),
        const SizedBox(width: 5),
        Text(
          'Expires $relative',
          style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
        ),
      ],
    );
  }
}

// ─── Small primitives ────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color? color;

  const _SectionLabel({required this.icon, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.textTertiary;
    return Row(
      children: [
        Icon(icon, size: 13, color: c),
        const SizedBox(width: 6),
        Text(
          label.toUpperCase(),
          style: TextStyle(
            color: c,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
          ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final bool highlighted;

  const _Chip(this.label, {this.highlighted = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: highlighted
            ? AppColors.primary.withValues(alpha: 0.08)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: highlighted
              ? AppColors.primary.withValues(alpha: 0.25)
              : AppColors.border,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: highlighted ? AppColors.primaryDark : AppColors.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

class _Deliverable {
  final String label;
  final String? description;
  _Deliverable(this.label, [this.description]);
}

/// Collapsible "About the client" — same visual language as Client Brief
/// (section label + Brand: value rows). Body toggles; no extra card chrome.
class _AboutClientToggle extends StatefulWidget {
  final String businessNature;
  final String customerLocation;
  final String notes;

  const _AboutClientToggle({
    required this.businessNature,
    required this.customerLocation,
    required this.notes,
  });

  @override
  State<_AboutClientToggle> createState() => _AboutClientToggleState();
}

class _AboutClientToggleState extends State<_AboutClientToggle> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          borderRadius: BorderRadius.circular(4),
          child: Row(
            children: [
              const Expanded(
                child: _SectionLabel(
                  icon: Icons.business_outlined,
                  label: 'About the client',
                ),
              ),
              AnimatedRotation(
                turns: _open ? 0.5 : 0,
                duration: const Duration(milliseconds: 180),
                child: const Icon(
                  Icons.keyboard_arrow_down,
                  size: 18,
                  color: AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
        if (_open) ...[
          const SizedBox(height: 6),
          if (widget.businessNature.isNotEmpty)
            _briefLine('Nature of business', widget.businessNature),
          if (widget.customerLocation.isNotEmpty)
            _briefLine('Location of business', widget.customerLocation),
          if (widget.notes.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                widget.notes,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                  height: 1.4,
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _briefLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: RichText(
        text: TextSpan(
          text: '$label: ',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
          children: [
            TextSpan(
              text: value,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
