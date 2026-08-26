import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../models/job_card.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/ui_kit.dart';

/// A single job in the feed. `new`-tab cards carry inline Apply / Decline;
/// funnel cards show their stage badge. Tapping opens the job detail.
/// Matches the web's `JobCard.tsx` component styling.
class JobListCard extends ConsumerStatefulWidget {
  final TalentJobFeedItem item;
  const JobListCard({super.key, required this.item});

  @override
  ConsumerState<JobListCard> createState() => _JobListCardState();
}

class _JobListCardState extends ConsumerState<JobListCard> {
  bool _busy = false;

  TalentJobFeedItem get item => widget.item;

  Future<void> _respond(String action) async {
    final recipientId = item.recipientId;
    if (recipientId == null || _busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(jobsServiceProvider).respond(recipientId, action);
      invalidateJobs(ref);
      if (mounted) {
        _toast(action == 'accept' ? 'Application sent!' : 'Job declined');
      }
    } catch (_) {
      if (mounted) _toast('Could not save your response');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _open() {
    final recipientId = item.recipientId;
    final profileId = item.jobProfileId;
    if (recipientId != null) {
      context.push('/job/$recipientId');
    } else if (profileId != null) {
      context.push('/job-profile/$profileId');
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = item.card?.content;
    final title = content?.jobTitle ?? 'Job opening';
    final business = content?.businessName ?? 'Business';
    final tint = tintFor(business);
    final logo = content?.businessProfile.logoUrl ??
        content?.brandProfile?.logoUrl;
    final description = content?.description ?? '';
    final isNew = item.isNew;
    final pkg = content?.packageLabel;
    final joiningDate = formatDateShort(content?.expectedJoiningDate);
    final openings = content?.openingsCount;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tinted top strip with business name
          Container(
            color: tint.bg,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: logo != null && logo.isNotEmpty
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.network(
                            logo,
                            width: 40,
                            height: 40,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) => Icon(
                              Icons.work_outline,
                              color: tint.fg,
                              size: 20,
                            ),
                          ),
                        )
                      : Icon(
                          Icons.work_outline,
                          color: tint.fg,
                          size: 20,
                        ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isNew ? 'New opening' : 'Job opening',
                        style: TextStyle(
                          color: tint.fg,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        business,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                if (!isNew && item.funnelStage != null) ...[
                  const SizedBox(width: 8),
                  Pill(
                    label: funnelStageLabel(item.funnelStage),
                    variant: funnelStageVariant(item.funnelStage),
                  ),
                ],
              ],
            ),
          ),
          // Body
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title and metadata
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  [content?.employmentType, content?.workMode, content?.locationLabel]
                      .where((s) => s != null && s.isNotEmpty)
                      .map((s) => humanize(s!))
                      .join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.textTertiary,
                    fontSize: 12,
                  ),
                ),
                // Chips row (package, joining date, openings)
                if (pkg != null || joiningDate.isNotEmpty || (openings != null && openings > 1)) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      if (pkg != null)
                        _BadgeChip(
                          label: pkg,
                          bgColor: const Color(0xFFFFFAC2),
                          fgColor: AppColors.textPrimary,
                        ),
                      if (joiningDate.isNotEmpty)
                        _BadgeChip(
                          label: 'Join by $joiningDate',
                          bgColor: AppColors.surface,
                          fgColor: AppColors.textPrimary,
                        ),
                      if (openings != null && openings > 1)
                        _BadgeChip(
                          label: '$openings openings',
                          bgColor: AppColors.surface,
                          fgColor: AppColors.textPrimary,
                        ),
                    ],
                  ),
                ],
                // Description (line-clamped)
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text(
                    description,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
                // Footer with View details link and Apply/Decline buttons
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (item.recipientId != null)
                      GestureDetector(
                        onTap: _open,
                        child: const Text(
                          'View details',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      )
                    else
                      const Spacer(),
                    if (isNew) ...[
                      const Spacer(),
                      OutlinedButton(
                        onPressed: _busy ? null : () => _respond('reject'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: const Text('Decline', style: TextStyle(fontSize: 12)),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: _busy ? null : () => _respond('accept'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        child: _busy
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Apply', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Small badge chip for package, joining date, openings count.
class _BadgeChip extends StatelessWidget {
  final String label;
  final Color bgColor;
  final Color fgColor;

  const _BadgeChip({
    required this.label,
    required this.bgColor,
    required this.fgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: fgColor,
        ),
      ),
    );
  }
}
