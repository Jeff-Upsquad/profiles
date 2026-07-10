import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme.dart';
import '../../core/tints.dart';
import '../../core/format.dart';
import '../../models/job_profile_view.dart';
import '../../providers/jobs_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import 'widgets/business_brand_section.dart';
import 'widgets/job_profile_sections.dart';
import 'widgets/job_qna_section.dart';

/// Standalone, recipient-gated job + business profile view with its Q&A.
class JobProfileScreen extends ConsumerWidget {
  final String jobProfileId;
  const JobProfileScreen({super.key, required this.jobProfileId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final view = ref.watch(jobProfileViewProvider(jobProfileId));

    return Scaffold(
      appBar: AppBar(title: const Text('Job profile')),
      body: view.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(jobProfileViewProvider(jobProfileId)),
        ),
        data: (v) {
          final business = v.profile.businessSnapshot.name ??
              v.profile.brandSnapshot?.name ??
              'Business';
          final tint = tintFor(business);
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(jobProfileViewProvider(jobProfileId));
              await ref.read(jobProfileViewProvider(jobProfileId).future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        LogoAvatar(
                          logoUrl: v.profile.businessSnapshot.logoUrl,
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
                                v.profile.title,
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
                  ),
                ),
                const SizedBox(height: 12),
                _ProfileActionBar(jobProfileId: jobProfileId, recipient: v.recipient),
                const SizedBox(height: 12),
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
                  cardId: v.recipient?.cardId,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _ProfileActionBar extends ConsumerStatefulWidget {
  final String jobProfileId;
  final JobProfileViewerRecipient? recipient;
  const _ProfileActionBar({required this.jobProfileId, this.recipient});

  @override
  ConsumerState<_ProfileActionBar> createState() => _ProfileActionBarState();
}

class _ProfileActionBarState extends ConsumerState<_ProfileActionBar> {
  bool _busy = false;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _run(Future<void> Function() action, String okMsg) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      ref.invalidate(jobProfileViewProvider(widget.jobProfileId));
      invalidateJobs(ref);
      _toast(okMsg);
    } catch (_) {
      _toast('Something went wrong. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.recipient;
    if (r == null) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 4),
        child: Text(
          "You haven't been matched to this role yet.",
          style: TextStyle(color: AppColors.textTertiary, fontSize: 13),
        ),
      );
    }

    final svc = ref.read(jobsServiceProvider);
    final stage = r.candidateStage;
    final negative = stage == 'rejected' || stage == 'withdrawn' || stage == 'declined';

    if (r.isPending) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _busy
                  ? null
                  : () => _run(() => svc.respond(r.id, 'reject'), 'Job declined'),
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
                  : () => _run(() => svc.respond(r.id, 'accept'), 'Application sent!'),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: const Text('Apply'),
            ),
          ),
        ],
      );
    }

    if (negative && r.cardLive) {
      return SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed:
              _busy ? null : () => _run(() => svc.reapply(r.id), 'Application sent!'),
          icon: const Icon(Icons.replay, size: 18),
          label: const Text('Apply again'),
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
      );
    }

    if (r.isAccepted && !negative && stage != 'hired' && stage != 'placed') {
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed:
              _busy ? null : () => _run(() => svc.withdraw(r.id), 'Application withdrawn'),
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

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        stage != null ? 'Status: ${humanize(stage)}' : 'Status: ${humanize(r.status)}',
        style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
      ),
    );
  }
}
