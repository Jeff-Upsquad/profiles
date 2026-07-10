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

    final chips = <Widget>[
      if (content?.employmentType != null)
        InfoChip(icon: Icons.work_outline, label: humanize(content!.employmentType)),
      if (content?.workMode != null)
        InfoChip(icon: Icons.laptop_mac_outlined, label: humanize(content!.workMode)),
      if (content?.locationLabel != null)
        InfoChip(icon: Icons.place_outlined, label: content!.locationLabel!),
    ];

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: _open,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LogoAvatar(
                    logoUrl: logo,
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
                          title,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          business,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (!item.isNew && item.funnelStage != null) ...[
                    const SizedBox(width: 8),
                    Pill(
                      label: funnelStageLabel(item.funnelStage),
                      variant: funnelStageVariant(item.funnelStage),
                    ),
                  ],
                ],
              ),
              if (chips.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(spacing: 14, runSpacing: 8, children: chips),
              ],
              if (content?.packageLabel != null) ...[
                const SizedBox(height: 10),
                Text(
                  content!.packageLabel!,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
              _footer(content),
              if (item.isNew) ...[
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _busy ? null : () => _respond('reject'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.textSecondary,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: const Text('Decline'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: _busy ? null : () => _respond('accept'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        child: _busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Apply'),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _footer(JobCardContent? content) {
    if (content == null) return const SizedBox.shrink();
    final bits = <String>[];
    final openings = content.openingsCount;
    if (openings != null && openings > 0) {
      bits.add('$openings opening${openings == 1 ? '' : 's'}');
    }
    final joins = formatDateShort(content.expectedJoiningDate);
    if (joins.isNotEmpty) bits.add('Joins $joins');
    if (bits.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Text(
        bits.join('  ·  '),
        style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
      ),
    );
  }
}
