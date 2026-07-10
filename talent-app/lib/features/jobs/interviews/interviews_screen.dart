import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../core/tints.dart';
import '../../../models/interview.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/shimmer_loading.dart';
import '../../../widgets/ui_kit.dart';
import '../../subscriptions/widgets/empty_state.dart';

/// List of the talent's interview invites across all jobs.
class InterviewsScreen extends ConsumerWidget {
  const InterviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invites = ref.watch(interviewInvitesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Interviews')),
      body: invites.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(interviewInvitesProvider),
        ),
        data: (items) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(interviewInvitesProvider);
            await ref.read(interviewInvitesProvider.future);
          },
          child: items.isEmpty
              ? ListView(
                  children: const [
                    Padding(
                      padding: EdgeInsets.only(top: 80),
                      child: EmptyState(
                        icon: Icons.event_outlined,
                        title: 'No interviews yet',
                        subtitle:
                            "When a business invites you to interview, it'll appear here.",
                      ),
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _InviteCard(item: items[i]),
                ),
        ),
      ),
    );
  }
}

class _InviteCard extends StatelessWidget {
  final TalentInviteItem item;
  const _InviteCard({required this.item});

  ({String label, BadgeVariant variant}) get _status {
    final inv = item.invite;
    if (inv.isInProgress) return (label: 'In progress', variant: BadgeVariant.indigo);
    if (inv.isInQueue) return (label: 'In queue', variant: BadgeVariant.blue);
    if (inv.outcome == 'selected') return (label: 'Selected', variant: BadgeVariant.green);
    if (inv.outcome == 'rejected') return (label: 'Not selected', variant: BadgeVariant.red);
    if (inv.hasDeclined) return (label: 'Declined', variant: BadgeVariant.gray);
    if (inv.hasAccepted) return (label: 'Accepted', variant: BadgeVariant.green);
    return (label: 'Invited', variant: BadgeVariant.yellow);
  }

  @override
  Widget build(BuildContext context) {
    final tint = tintFor(item.businessName);
    final status = _status;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/interview/${item.invite.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  LogoAvatar(
                    initials: initialsFor(item.businessName),
                    bg: tint.bg,
                    fg: tint.fg,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.jobTitle,
                          style: const TextStyle(
                            color: AppColors.textPrimary,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          item.businessName,
                          style: const TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Pill(label: status.label, variant: status.variant),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  InfoChip(
                    icon: item.round.isVirtual
                        ? Icons.videocam_outlined
                        : Icons.place_outlined,
                    label: item.round.isVirtual ? 'Virtual' : 'In person',
                  ),
                  if (formatDateTime(item.round.windowStart).isNotEmpty)
                    InfoChip(
                      icon: Icons.schedule,
                      label: formatDateTime(item.round.windowStart),
                    ),
                  if (item.round.title != null)
                    InfoChip(icon: Icons.tag, label: item.round.title!),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
