import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/format.dart';
import '../../core/theme.dart';
import '../../core/tints.dart';
import '../../models/job_card.dart';
import '../../providers/jobs_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import 'widgets/business_brand_section.dart';
import 'widgets/job_profile_sections.dart';
import 'widgets/job_qna_section.dart';

/// Positive funnel ladder for the "Your progress" timeline.
const List<String> _ladder = [
  'applied',
  'screening',
  'shortlisted',
  'interview_invited',
  'interview',
  'selected',
  'offer',
  'hired',
  'placed',
];

class JobDetailScreen extends ConsumerWidget {
  final String recipientId;
  const JobDetailScreen({super.key, required this.recipientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(jobDetailProvider(recipientId));

    return Scaffold(
      appBar: AppBar(title: const Text('Job')),
      body: detail.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(jobDetailProvider(recipientId)),
        ),
        data: (d) {
          final content = d.card?.content;
          final jobProfileId = d.jobProfileId ?? d.candidate?.jobProfileId;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(jobDetailProvider(recipientId));
              if (jobProfileId != null) {
                ref.invalidate(jobProfileViewProvider(jobProfileId));
              }
              await ref.read(jobDetailProvider(recipientId).future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (content != null) _JobHeader(content: content),
                const SizedBox(height: 12),
                _JobActionBar(detail: d),
                if (d.hasApplied) ...[
                  const SizedBox(height: 12),
                  _StageTimeline(candidate: d.candidate!),
                ],
                _CrossLinks(detail: d),
                if (jobProfileId != null) ...[
                  const SizedBox(height: 12),
                  _InlineProfile(jobProfileId: jobProfileId, cardId: d.card?.id),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _JobHeader extends StatelessWidget {
  final JobCardContent content;
  const _JobHeader({required this.content});

  @override
  Widget build(BuildContext context) {
    final business = content.businessName;
    final tint = tintFor(business);
    final chips = <Widget>[
      if (content.employmentType != null)
        InfoChip(icon: Icons.work_outline, label: humanize(content.employmentType)),
      if (content.workMode != null)
        InfoChip(icon: Icons.laptop_mac_outlined, label: humanize(content.workMode)),
      if (content.locationLabel != null)
        InfoChip(icon: Icons.place_outlined, label: content.locationLabel!),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LogoAvatar(
                  logoUrl: content.businessProfile.logoUrl ??
                      content.brandProfile?.logoUrl,
                  initials: initialsFor(business),
                  bg: tint.bg,
                  fg: tint.fg,
                  size: 52,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        content.jobTitle,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        business,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (chips.isNotEmpty) ...[
              const SizedBox(height: 14),
              Wrap(spacing: 14, runSpacing: 8, children: chips),
            ],
            if (content.packageLabel != null) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(Icons.payments_outlined, size: 18, color: AppColors.success),
                  const SizedBox(width: 6),
                  Text(
                    content.packageLabel!,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ],
            if (formatDateShort(content.expectedJoiningDate).isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                'Expected joining · ${formatDate(content.expectedJoiningDate)}',
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 12.5),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _JobActionBar extends ConsumerStatefulWidget {
  final TalentJobDetail detail;
  const _JobActionBar({required this.detail});

  @override
  ConsumerState<_JobActionBar> createState() => _JobActionBarState();
}

class _JobActionBarState extends ConsumerState<_JobActionBar> {
  bool _busy = false;

  TalentJobDetail get d => widget.detail;
  bool get _cardLive => d.card?.status == 'published';

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _run(Future<void> Function() action, String okMsg) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      invalidateJobs(ref);
      ref.invalidate(jobDetailProvider(d.recipient.id));
      _toast(okMsg);
    } catch (_) {
      _toast('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmWithdraw() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Withdraw application?'),
        content: const Text(
          'The business will no longer consider you for this role. You can re-apply later while the job is still open.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (ok == true) {
      final svc = ref.read(jobsServiceProvider);
      await _run(() => svc.withdraw(d.recipient.id), 'Application withdrawn');
    }
  }

  @override
  Widget build(BuildContext context) {
    final svc = ref.read(jobsServiceProvider);
    final candidate = d.candidate;
    final stage = candidate?.funnelStage;

    // Pending, never applied → Apply / Decline.
    if (d.recipient.isPending && candidate == null) {
      if (!_cardLive) return _closedNote();
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _busy
                  ? null
                  : () => _run(
                        () => svc.respond(d.recipient.id, 'reject'),
                        'Job declined',
                      ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textSecondary,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Decline'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ElevatedButton(
              onPressed: _busy
                  ? null
                  : () => _run(
                        () => svc.respond(d.recipient.id, 'accept'),
                        'Application sent!',
                      ),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _busyChild(const Text('Apply')),
            ),
          ),
        ],
      );
    }

    // Terminal-negative (self or business) → re-apply while the card is live.
    final negative = stage == 'rejected' ||
        stage == 'withdrawn' ||
        stage == 'declined' ||
        (candidate == null && d.recipient.isRejected);
    if (negative) {
      final selfExit = stage == 'withdrawn' ||
          d.recipient.isWithdrawnBySelf ||
          (candidate == null && d.recipient.isRejected);
      if (selfExit && _cardLive) {
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _busy
                ? null
                : () => _run(
                      () => svc.reapply(d.recipient.id),
                      'Application sent!',
                    ),
            icon: const Icon(Icons.replay, size: 18),
            label: const Text('Apply again'),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        );
      }
      return _banner(
        stage == 'rejected' && !selfExit ? 'Not selected for this role' : 'You are no longer applied',
        candidate?.rejectedReason,
        BadgeVariant.red,
      );
    }

    // Won → celebratory, locked.
    if (stage == 'hired' || stage == 'placed') {
      return _banner(
        stage == 'placed' ? "You're placed — congratulations!" : "You're hired — congratulations!",
        null,
        BadgeVariant.green,
      );
    }

    // On hold.
    if (stage == 'on_hold') {
      return _banner('Your application is on hold', null, BadgeVariant.yellow);
    }

    // Active → allow withdraw.
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: _busy ? null : _confirmWithdraw,
        icon: const Icon(Icons.logout, size: 18),
        label: const Text('Withdraw application'),
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.danger,
          side: const BorderSide(color: AppColors.danger),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }

  Widget _busyChild(Widget child) => _busy
      ? const SizedBox(
          width: 18,
          height: 18,
          child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
        )
      : child;

  Widget _closedNote() => _banner('This job is no longer accepting applications', null, BadgeVariant.gray);

  Widget _banner(String title, String? subtitle, BadgeVariant variant) {
    final c = switch (variant) {
      BadgeVariant.green => (AppColors.success, AppColors.successBg),
      BadgeVariant.red => (AppColors.danger, AppColors.dangerBg),
      BadgeVariant.yellow => (AppColors.selectedGold, AppColors.selectedBg),
      _ => (AppColors.textSecondary, AppColors.divider),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.$2,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(color: c.$1, fontSize: 14, fontWeight: FontWeight.w700),
          ),
          if (subtitle != null && subtitle.trim().isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(subtitle, style: TextStyle(color: c.$1, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

class _StageTimeline extends StatelessWidget {
  final JobCandidate candidate;
  const _StageTimeline({required this.candidate});

  @override
  Widget build(BuildContext context) {
    final stage = candidate.funnelStage;
    final idx = _ladder.indexOf(stage);
    // Non-ladder stages (rejected/withdrawn/on_hold) are surfaced by the action
    // bar banner; only draw the ladder for positive progress.
    if (idx < 0) return const SizedBox.shrink();

    return TitledCard(
      title: 'Your progress',
      icon: Icons.timeline_outlined,
      child: Column(
        children: [
          for (int i = 0; i < _ladder.length; i++)
            _Step(
              label: funnelStageLabel(_ladder[i]),
              done: i < idx,
              current: i == idx,
              last: i == _ladder.length - 1,
            ),
        ],
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final String label;
  final bool done;
  final bool current;
  final bool last;
  const _Step({
    required this.label,
    required this.done,
    required this.current,
    required this.last,
  });

  @override
  Widget build(BuildContext context) {
    final active = done || current;
    final color = current
        ? AppColors.primary
        : (done ? AppColors.success : AppColors.textTertiary);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: active ? color : Colors.transparent,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: active ? color : AppColors.border,
                    width: 2,
                  ),
                ),
                child: done
                    ? const Icon(Icons.check, size: 11, color: Colors.white)
                    : null,
              ),
              if (!last)
                Expanded(
                  child: Container(
                    width: 2,
                    color: done ? AppColors.success : AppColors.border,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),
          Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 14, top: 0),
            child: Text(
              label,
              style: TextStyle(
                color: current ? AppColors.textPrimary : AppColors.textSecondary,
                fontSize: 14,
                fontWeight: current ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Interview-call and offer cross-links for this card.
class _CrossLinks extends ConsumerWidget {
  final TalentJobDetail detail;
  const _CrossLinks({required this.detail});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardId = detail.candidate?.cardId ?? detail.card?.id;
    if (cardId == null) return const SizedBox.shrink();

    final invites = ref.watch(interviewInvitesProvider).value ?? const [];
    final offers = ref.watch(offersListProvider).value ?? const [];
    final myInvites =
        invites.where((it) => it.round.cardId == cardId).toList();
    final myOffers = offers.where((o) => o.cardId == cardId).toList();

    if (myInvites.isEmpty && myOffers.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        children: [
          for (final it in myInvites)
            _LinkTile(
              icon: Icons.event_available_outlined,
              title: it.round.title ?? 'Interview round ${it.round.roundNo}',
              subtitle: formatDateTime(it.round.windowStart),
              onTap: () => context.push('/interview/${it.invite.id}'),
            ),
          for (final o in myOffers)
            _LinkTile(
              icon: Icons.mail_outline,
              title: 'Offer · ${o.positionTitle}',
              subtitle: o.status == 'sent' ? 'Awaiting your response' : humanize(o.status),
              onTap: () => context.push('/offer/${o.id}'),
            ),
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  const _LinkTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(title,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        subtitle: subtitle.isEmpty ? null : Text(subtitle),
        trailing: const Icon(Icons.chevron_right, color: AppColors.textTertiary),
        onTap: onTap,
      ),
    );
  }
}

class _InlineProfile extends ConsumerWidget {
  final String jobProfileId;
  final String? cardId;
  const _InlineProfile({required this.jobProfileId, this.cardId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(jobProfileViewProvider(jobProfileId));
    return view.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (v) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          JobProfileSections(
            details: v.profile.details,
            description: v.profile.description,
          ),
          BusinessBrandSection(
            business: v.profile.businessSnapshot,
            brand: v.profile.brandSnapshot,
          ),
          const SizedBox(height: 12),
          JobQnASection(
            jobProfileId: jobProfileId,
            questions: v.questions,
            cardId: cardId,
          ),
        ],
      ),
    );
  }
}
