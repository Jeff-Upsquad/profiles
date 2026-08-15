import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/format.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../models/conversation.dart';
import '../../providers/conversations_providers.dart';
import '../../providers/providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';

const _freezeCopy = {
  'assigned': 'This card is assigned. Chat has moved to SquadHub.',
  'placed': 'This hire is placed. Chat has moved to SquadHub.',
  'cancelled': 'This card was cancelled. The conversation is read-only.',
  'closed': 'This job is closed. The conversation is read-only.',
  'archived': 'This card was archived. The conversation is read-only.',
  'admin_closed': 'This conversation was closed by UpSquad.',
};

const _providers = [
  ('meet', 'Google Meet'),
  ('zoom', 'Zoom'),
  ('teams', 'Microsoft Teams'),
  ('other', 'Other'),
];

class ConversationScreen extends ConsumerStatefulWidget {
  final String conversationId;
  const ConversationScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  final _draft = TextEditingController();
  final _scroll = ScrollController();
  bool _sending = false;

  @override
  void dispose() {
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String get _id => widget.conversationId;

  Future<void> _refresh() async {
    ref.invalidate(conversationDetailProvider(_id));
    ref.invalidate(conversationMessagesProvider(_id));
    ref.invalidate(conversationsListProvider);
    ref.invalidate(conversationsUnreadProvider);
    await ref.read(conversationMessagesProvider(_id).future);
  }

  Future<void> _send() async {
    final body = _draft.text.trim();
    if (body.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(conversationsServiceProvider).send(_id, body);
      _draft.clear();
      await _refresh();
      _jumpToEnd();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_err(e, 'Message failed to send'))),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _jumpToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
    });
  }

  String _err(Object e, String fallback) {
    final msg = e.toString();
    return msg.contains('message') ? fallback : fallback;
  }

  Future<void> _propose() async {
    final result = await showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ProposeMeetingSheet(),
    );
    if (result == null || !mounted) return;
    try {
      await ref.read(conversationsServiceProvider).proposeMeeting(
            _id,
            startsAt: result['starts_at']!,
            endsAt: result['ends_at'],
            timezone: result['timezone'],
            provider: result['provider']!,
            meetingLink: result['meeting_link']!,
          );
      await _refresh();
      _jumpToEnd();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not propose the meeting')),
        );
      }
    }
  }

  Future<void> _respond(String meetingId, String action) async {
    try {
      await ref.read(conversationsServiceProvider).respond(_id, meetingId, action);
      await _refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update the meeting')),
        );
      }
    }
  }

  Future<void> _cancel(String meetingId) async {
    try {
      await ref.read(conversationsServiceProvider).cancel(_id, meetingId);
      await _refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not cancel the meeting')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(authProvider).user;
    final detail = ref.watch(conversationDetailProvider(_id));
    final messages = ref.watch(conversationMessagesProvider(_id));

    return Scaffold(
      appBar: AppBar(
        title: detail.maybeWhen(
          data: (c) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(c.business.name, style: const TextStyle(fontSize: 16)),
              Text(
                [
                  c.cardTitle ?? 'Intro room',
                  c.salesperson?.name ?? 'UpSquad will join shortly',
                ].join(' · '),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w400,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          orElse: () => const Text('Messages'),
        ),
      ),
      body: detail.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(conversationDetailProvider(_id)),
        ),
        data: (conversation) {
          final frozenNote = conversation.frozen
              ? (_freezeCopy[conversation.frozenReason] ??
                  'This conversation is read-only.')
              : null;
          return Column(
            children: [
              if (frozenNote != null)
                Container(
                  width: double.infinity,
                  color: AppColors.warningBg,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Text(
                    frozenNote,
                    style: const TextStyle(
                      color: AppColors.selectedGold,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              Expanded(
                child: messages.when(
                  loading: () => const ShimmerCardList(),
                  error: (_, _) => AppErrorRetry(
                    onRetry: () =>
                        ref.invalidate(conversationMessagesProvider(_id)),
                  ),
                  data: (items) {
                    WidgetsBinding.instance.addPostFrameCallback((_) => _jumpToEnd());
                    return RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        itemCount: items.length,
                        itemBuilder: (_, i) => _MessageBubble(
                          message: items[i],
                          mine: items[i].senderId == me?.id &&
                              items[i].senderType == 'talent',
                          canAct: conversation.canSend,
                          onAccept: (mid) => _respond(mid, 'accept'),
                          onDecline: (mid) => _respond(mid, 'decline'),
                          onCancel: _cancel,
                        ),
                      ),
                    );
                  },
                ),
              ),
              if (conversation.canSend)
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        IconButton(
                          onPressed: _propose,
                          icon: const Icon(Icons.event_available_outlined),
                          tooltip: 'Propose a meeting',
                        ),
                        Expanded(
                          child: TextField(
                            controller: _draft,
                            minLines: 1,
                            maxLines: 4,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _send(),
                            decoration: InputDecoration(
                              hintText: 'Write a message…',
                              filled: true,
                              fillColor: Colors.white,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 10,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(16),
                                borderSide: const BorderSide(color: AppColors.border),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          onPressed: _sending ? null : _send,
                          icon: _sending
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.send),
                        ),
                      ],
                    ),
                  ),
                )
              else
                const SafeArea(
                  top: false,
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Messaging is paused on this room.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textTertiary, fontSize: 12),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final IntroMessage message;
  final bool mine;
  final bool canAct;
  final void Function(String meetingId) onAccept;
  final void Function(String meetingId) onDecline;
  final void Function(String meetingId) onCancel;

  const _MessageBubble({
    required this.message,
    required this.mine,
    required this.canAct,
    required this.onAccept,
    required this.onDecline,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    if (message.isDeleted) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 6),
        child: Center(
          child: Text(
            'Message removed',
            style: TextStyle(
              color: AppColors.textTertiary,
              fontSize: 12,
              fontStyle: FontStyle.italic,
            ),
          ),
        ),
      );
    }
    if (message.isSystem) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Center(
          child: Text(
            message.body ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.textTertiary, fontSize: 12),
          ),
        ),
      );
    }

    final label = mine
        ? 'You'
        : [
            message.senderName ?? 'UpSquad',
            if (message.senderType == 'salesperson' ||
                message.senderType == 'staff' ||
                message.senderType == 'admin')
              'UpSquad',
          ].join(' · ');

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 320),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment:
                mine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 11),
              ),
              const SizedBox(height: 3),
              if (message.isMeeting && message.meeting != null)
                _MeetingCard(
                  meeting: message.meeting!,
                  mine: mine,
                  canAct: canAct,
                  onAccept: () => onAccept(message.meeting!.id),
                  onDecline: () => onDecline(message.meeting!.id),
                  onCancel: () => onCancel(message.meeting!.id),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: mine ? AppColors.textPrimary : Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: mine ? null : Border.all(color: AppColors.border),
                  ),
                  child: Text(
                    message.body ?? '',
                    style: TextStyle(
                      color: mine ? Colors.white : AppColors.textPrimary,
                      fontSize: 14,
                      height: 1.35,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MeetingCard extends StatelessWidget {
  final IntroMeeting meeting;
  final bool mine;
  final bool canAct;
  final VoidCallback onAccept;
  final VoidCallback onDecline;
  final VoidCallback onCancel;

  const _MeetingCard({
    required this.meeting,
    required this.mine,
    required this.canAct,
    required this.onAccept,
    required this.onDecline,
    required this.onCancel,
  });

  String get _providerLabel {
    for (final p in _providers) {
      if (p.$1 == meeting.provider) return p.$2;
    }
    return 'Meeting';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _providerLabel.toUpperCase(),
            style: const TextStyle(
              color: AppColors.textTertiary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            formatDateTime(meeting.startsAt),
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (meeting.endsAt != null)
            Text(
              'Until ${formatDateTime(meeting.endsAt)}',
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          const SizedBox(height: 6),
          Pill(
            label: meeting.status,
            variant: meeting.isAccepted
                ? BadgeVariant.green
                : meeting.isProposed
                    ? BadgeVariant.yellow
                    : BadgeVariant.gray,
          ),
          if (meeting.isLive && (meeting.meetingLink ?? '').isNotEmpty) ...[
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => openExternalUrl(meeting.meetingLink),
              child: const Text('Join meeting'),
            ),
          ],
          if (canAct && meeting.isProposed && !mine) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                FilledButton(onPressed: onAccept, child: const Text('Accept')),
                const SizedBox(width: 8),
                OutlinedButton(onPressed: onDecline, child: const Text('Decline')),
              ],
            ),
          ],
          if (canAct && meeting.isProposed && mine)
            TextButton(onPressed: onCancel, child: const Text('Cancel proposal')),
        ],
      ),
    );
  }
}

class _ProposeMeetingSheet extends StatefulWidget {
  const _ProposeMeetingSheet();

  @override
  State<_ProposeMeetingSheet> createState() => _ProposeMeetingSheetState();
}

class _ProposeMeetingSheetState extends State<_ProposeMeetingSheet> {
  DateTime _starts = DateTime.now().add(const Duration(hours: 1));
  DateTime? _ends;
  String _provider = 'meet';
  final _link = TextEditingController();

  @override
  void dispose() {
    _link.dispose();
    super.dispose();
  }

  Future<void> _pickStart() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _starts,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_starts),
    );
    if (time == null) return;
    setState(() {
      _starts = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pad = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + pad),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Propose a meeting',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Starts'),
            subtitle: Text(formatDateTime(_starts.toIso8601String())),
            trailing: const Icon(Icons.schedule),
            onTap: _pickStart,
          ),
          DropdownButtonFormField<String>(
            // ignore: deprecated_member_use
            value: _provider,
            decoration: const InputDecoration(labelText: 'Provider'),
            items: [
              for (final p in _providers)
                DropdownMenuItem(value: p.$1, child: Text(p.$2)),
            ],
            onChanged: (v) => setState(() => _provider = v ?? 'meet'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _link,
            keyboardType: TextInputType.url,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Meeting link',
              hintText: 'https://meet.google.com/…',
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _link.text.trim().isEmpty
                ? null
                : () => Navigator.of(context).pop({
                      'starts_at': _starts.toUtc().toIso8601String(),
                      'timezone': _starts.timeZoneName,
                      'provider': _provider,
                      'meeting_link': _link.text.trim(),
                      if (_ends != null) 'ends_at': _ends!.toUtc().toIso8601String(),
                    }),
            child: const Text('Send invite'),
          ),
        ],
      ),
    );
  }
}
