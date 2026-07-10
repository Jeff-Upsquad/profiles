import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/format.dart';
import '../../../core/launchers.dart';
import '../../../core/theme.dart';
import '../../../models/interview.dart';
import '../../../models/job_card.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/shimmer_loading.dart';
import '../../../widgets/ui_kit.dart';

class InterviewDetailScreen extends ConsumerWidget {
  final String inviteId;
  const InterviewDetailScreen({super.key, required this.inviteId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invites = ref.watch(interviewInvitesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Interview')),
      body: invites.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(interviewInvitesProvider),
        ),
        data: (list) {
          TalentInviteItem? item;
          for (final it in list) {
            if (it.invite.id == inviteId) {
              item = it;
              break;
            }
          }
          if (item == null) {
            return const Center(
              child: Text('This interview invite is no longer available.'),
            );
          }
          return _Body(item: item);
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  final TalentInviteItem item;
  const _Body({required this.item});

  @override
  Widget build(BuildContext context) {
    final round = item.round;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TitledCard(
          title: item.jobTitle,
          icon: Icons.event_available_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.businessName,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 14,
                runSpacing: 8,
                children: [
                  InfoChip(
                    icon: round.isVirtual ? Icons.videocam_outlined : Icons.place_outlined,
                    label: round.isVirtual ? 'Virtual' : 'In person',
                  ),
                  InfoChip(icon: Icons.tag, label: 'Round ${round.roundNo}'),
                  if (round.minutesPerInterview > 0)
                    InfoChip(icon: Icons.timer_outlined, label: '${round.minutesPerInterview} min'),
                ],
              ),
              if (formatDateTime(round.windowStart).isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  'Window',
                  style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
                ),
                Text(
                  '${formatDateTime(round.windowStart)} – ${formatTime(round.windowEnd)}',
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),
        _RsvpOrQueue(item: item),
      ],
    );
  }
}

class _RsvpOrQueue extends ConsumerStatefulWidget {
  final TalentInviteItem item;
  const _RsvpOrQueue({required this.item});

  @override
  ConsumerState<_RsvpOrQueue> createState() => _RsvpOrQueueState();
}

class _RsvpOrQueueState extends ConsumerState<_RsvpOrQueue> {
  bool _busy = false;

  TalentInviteItem get item => widget.item;

  Future<void> _rsvp(String action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(interviewsServiceProvider).respond(item.invite.id, action);
      ref.invalidate(interviewInvitesProvider);
      invalidateJobs(ref);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(action == 'accept'
                ? 'Interview accepted — see you there!'
                : 'Interview declined'),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save your response')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final invite = item.invite;

    if (invite.hasDeclined) {
      return _note('You declined this interview.', BadgeVariant.gray);
    }

    if (invite.isInvited) {
      return TitledCard(
        title: "You're invited",
        icon: Icons.how_to_reg_outlined,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Let the business know if you can attend. Nearer the time, join the live queue to confirm you are available.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5, height: 1.4),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _rsvp('decline'),
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
                    onPressed: _busy ? null : () => _rsvp('accept'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: const Text('Accept'),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    // Accepted → queue flow.
    if (!item.round.confirmWindowOpen) {
      return TitledCard(
        title: "You're confirmed to attend",
        icon: Icons.check_circle_outline,
        child: Text(
          'The live queue opens about 10 minutes before your interview window. '
          'Come back to "I\'m available" then — you\'ll get the ${item.round.isVirtual ? 'meeting link' : 'venue'} when it\'s your turn.',
          style: const TextStyle(color: AppColors.textSecondary, fontSize: 13.5, height: 1.4),
        ),
      );
    }

    return _QueuePanel(inviteId: invite.id);
  }

  Widget _note(String text, BadgeVariant variant) {
    return _note0(text, variant);
  }

  Widget _note0(String text, BadgeVariant variant) {
    final c = switch (variant) {
      BadgeVariant.green => (AppColors.success, AppColors.successBg),
      BadgeVariant.red => (AppColors.danger, AppColors.dangerBg),
      _ => (AppColors.textSecondary, AppColors.divider),
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.$2, borderRadius: BorderRadius.circular(12)),
      child: Text(text, style: TextStyle(color: c.$1, fontSize: 14, fontWeight: FontWeight.w600)),
    );
  }
}

/// Live FIFO queue for an accepted invite. Polls every 20s via the stream
/// provider; the meeting link / venue reveals only when the business starts
/// this talent's interview.
class _QueuePanel extends ConsumerStatefulWidget {
  final String inviteId;
  const _QueuePanel({required this.inviteId});

  @override
  ConsumerState<_QueuePanel> createState() => _QueuePanelState();
}

class _QueuePanelState extends ConsumerState<_QueuePanel> {
  bool _confirming = false;

  Future<void> _confirm() async {
    if (_confirming) return;
    setState(() => _confirming = true);
    try {
      await ref.read(interviewsServiceProvider).confirm(widget.inviteId);
      ref.invalidate(inviteQueueProvider(widget.inviteId));
      ref.invalidate(interviewInvitesProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("You're in the queue!")),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not confirm — please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final snap = ref.watch(inviteQueueProvider(widget.inviteId));
    return snap.when(
      loading: () => const TitledCard(
        title: 'Live queue',
        icon: Icons.timelapse,
        child: Center(child: Padding(
          padding: EdgeInsets.all(8),
          child: CircularProgressIndicator(),
        )),
      ),
      error: (_, _) => AppErrorRetry(
        onRetry: () => ref.invalidate(inviteQueueProvider(widget.inviteId)),
      ),
      data: (s) => _content(s),
    );
  }

  Widget _content(InviteQueueSnapshot s) {
    final invite = s.invite;
    final round = s.round;
    final q = s.queue;

    // It's your turn — the link/venue is unlocked.
    if (invite.isInProgress || !round.linkLocked) {
      return TitledCard(
        title: "It's your turn!",
        icon: Icons.play_circle_outline,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'The business is ready for you now.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13.5),
            ),
            const SizedBox(height: 14),
            if (round.isVirtual && (round.meetingLink ?? '').isNotEmpty)
              SizedBox(
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final ok = await openExternalUrl(round.meetingLink);
                    if (!ok && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not open the meeting link')),
                      );
                    }
                  },
                  icon: const Icon(Icons.videocam),
                  label: const Text('Join the interview'),
                ),
              )
            else if (!round.isVirtual && round.location != null)
              _Venue(location: round.location!),
          ],
        ),
      );
    }

    if (invite.isDone) {
      final outcome = invite.outcome;
      return _statusCard(
        outcome == 'selected'
            ? 'Interview complete — you were selected!'
            : outcome == 'rejected'
                ? 'Interview complete'
                : 'Interview complete — awaiting the outcome.',
        outcome == 'selected' ? BadgeVariant.green : BadgeVariant.gray,
        Icons.done_all,
      );
    }

    // In queue / waitlisted.
    if (invite.isInQueue) {
      final waitlisted = invite.queueStatus == 'waitlisted';
      return TitledCard(
        title: waitlisted ? 'On the waitlist' : "You're in the queue",
        icon: Icons.groups_2_outlined,
        trailing: const _LiveDot(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!waitlisted && q.position != null)
              _bigStat('#${q.position}', 'Your position'),
            if (waitlisted && q.waitlistPosition != null)
              _bigStat('#${q.waitlistPosition}', 'Waitlist position'),
            if (q.approxTime != null) ...[
              const SizedBox(height: 8),
              Center(
                child: Text(
                  'Approx. ${formatTime(q.approxTime)}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                ),
              ),
            ],
            const SizedBox(height: 12),
            const Text(
              'Keep this screen open. The link or venue appears the moment the business starts your interview.',
              style: TextStyle(color: AppColors.textTertiary, fontSize: 12.5, height: 1.4),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    // Confirm window open, not yet joined.
    return TitledCard(
      title: 'Join the live queue',
      icon: Icons.bolt_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${q.queuedCount} in the queue · ${q.capacity} interviewer${q.capacity == 1 ? '' : 's'}',
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 14),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: _confirming ? null : _confirm,
              icon: _confirming
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                    )
                  : const Icon(Icons.pan_tool_alt_outlined),
              label: const Text("I'm available — join the queue"),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bigStat(String value, String label) => Column(
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppColors.primary,
              fontSize: 40,
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        ],
      );

  Widget _statusCard(String text, BadgeVariant variant, IconData icon) {
    final c = switch (variant) {
      BadgeVariant.green => (AppColors.success, AppColors.successBg),
      _ => (AppColors.textSecondary, AppColors.divider),
    };
    return TitledCard(
      title: 'Interview',
      icon: icon,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: c.$2, borderRadius: BorderRadius.circular(10)),
        child: Text(text, style: TextStyle(color: c.$1, fontSize: 14, fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class _Venue extends StatelessWidget {
  final JobLocationSnapshot location;
  const _Venue({required this.location});

  @override
  Widget build(BuildContext context) {
    final line = [location.address, location.city, location.region]
        .whereType<String>()
        .where((s) => s.isNotEmpty)
        .join(', ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          line.isNotEmpty ? line : (location.label ?? 'Venue'),
          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, height: 1.4),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => openMaps(url: location.googleMapsUrl, query: line),
          icon: const Icon(Icons.map_outlined, size: 18),
          label: const Text('Open in Maps'),
        ),
      ],
    );
  }
}

class _LiveDot extends StatelessWidget {
  const _LiveDot();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        const Text('Live', style: TextStyle(color: AppColors.success, fontSize: 12, fontWeight: FontWeight.w600)),
      ],
    );
  }
}
