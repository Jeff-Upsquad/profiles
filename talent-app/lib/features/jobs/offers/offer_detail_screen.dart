import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../models/job_offer.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/shimmer_loading.dart';
import '../../../widgets/ui_kit.dart';
import 'offers_screen.dart' show offerStatusBadge;

class OfferDetailScreen extends ConsumerWidget {
  final String offerId;
  const OfferDetailScreen({super.key, required this.offerId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(offerDetailProvider(offerId));
    return Scaffold(
      appBar: AppBar(title: const Text('Offer')),
      body: detail.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(
          onRetry: () => ref.invalidate(offerDetailProvider(offerId)),
        ),
        data: (d) {
          final offer = d.offer;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(offerDetailProvider(offerId));
              await ref.read(offerDetailProvider(offerId).future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _header(context, offer),
                const SizedBox(height: 12),
                _CompensationCard(comp: offer.compensation),
                const SizedBox(height: 12),
                _dates(offer),
                ..._letter(offer),
                const SizedBox(height: 12),
                _OfferActions(offerId: offerId, offer: offer),
                const SizedBox(height: 12),
                _Thread(events: d.events, currency: offer.compensation.currency),
                const SizedBox(height: 12),
                _AskButton(offerId: offerId),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _header(BuildContext context, JobOffer offer) {
    final badge = offerStatusBadge(offer.status);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    offer.positionTitle,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Pill(label: badge.label, variant: badge.variant),
              ],
            ),
            if (offer.businessName != null) ...[
              const SizedBox(height: 4),
              Text(
                offer.businessName!,
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _dates(JobOffer offer) {
    final rows = <(String, String)>[
      if (formatDate(offer.effectiveDate).isNotEmpty)
        ('Effective', formatDate(offer.effectiveDate)),
      if (formatDate(offer.joinByDate).isNotEmpty)
        ('Join by', formatDate(offer.joinByDate)),
      if (formatDate(offer.expiresOn).isNotEmpty)
        ('Respond by', formatDate(offer.expiresOn)),
    ];
    if (rows.isEmpty) return const SizedBox.shrink();
    return TitledCard(
      title: 'Key dates',
      icon: Icons.event_outlined,
      child: Column(
        children: [
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(r.$1, style: const TextStyle(color: AppColors.textTertiary, fontSize: 13)),
                  Text(r.$2,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      )),
                ],
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _letter(JobOffer offer) {
    final sections = offer.letter?.sections ?? const [];
    if (sections.isEmpty) return const [];
    return [
      const SizedBox(height: 12),
      TitledCard(
        title: 'Offer letter',
        icon: Icons.article_outlined,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final s in sections) ...[
              if ((s.title ?? '').trim().isNotEmpty) ...[
                Text(
                  s.title!,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
              ],
              Text(
                htmlToText(s.bodyHtml),
                style: const TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13.5,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 14),
            ],
            if (offer.letter?.signatoryName != null)
              Text(
                '— ${offer.letter!.signatoryName}${offer.letter!.signatoryTitle != null ? ', ${offer.letter!.signatoryTitle}' : ''}',
                style: const TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 13,
                  fontStyle: FontStyle.italic,
                ),
              ),
          ],
        ),
      ),
    ];
  }
}

class _CompensationCard extends StatelessWidget {
  final OfferCompensation comp;
  const _CompensationCard({required this.comp});

  @override
  Widget build(BuildContext context) {
    final rows = <(String, CompensationSlot?)>[
      ('Training', comp.training),
      ('Probation', comp.probation),
      ('Confirmed', comp.confirmed),
    ].where((r) => r.$2 != null && !r.$2!.isEmpty).toList();

    if (rows.isEmpty) return const SizedBox.shrink();

    return TitledCard(
      title: 'Compensation',
      icon: Icons.payments_outlined,
      child: Column(
        children: [
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(r.$1,
                      style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                  Text(
                    '${formatMoney(r.$2!.amount, comp.currency)}${r.$2!.cadence != null ? ' / ${r.$2!.cadence}' : ''}',
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _OfferActions extends ConsumerStatefulWidget {
  final String offerId;
  final JobOffer offer;
  const _OfferActions({required this.offerId, required this.offer});

  @override
  ConsumerState<_OfferActions> createState() => _OfferActionsState();
}

class _OfferActionsState extends ConsumerState<_OfferActions> {
  bool _busy = false;

  JobOffer get offer => widget.offer;

  void _toast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _respond(String action, {num? amount, String? note}) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(offersServiceProvider)
          .respond(widget.offerId, action, amount: amount, note: note);
      ref.invalidate(offerDetailProvider(widget.offerId));
      ref.invalidate(offersListProvider);
      _toast(switch (action) {
        'accept' => 'Offer accepted — congratulations!',
        'decline' => 'Offer declined',
        _ => 'Negotiation request sent',
      });
    } catch (_) {
      _toast('Could not save your response');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmDecline() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Decline this offer?'),
        content: const Text('This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('Decline'),
          ),
        ],
      ),
    );
    if (ok == true) _respond('decline');
  }

  Future<void> _negotiate() async {
    final result = await showModalBottomSheet<({num amount, String note})>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _NegotiateSheet(currency: offer.compensation.currency),
    );
    if (result != null) {
      _respond('negotiate', amount: result.amount, note: result.note);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!offer.isOpen) {
      final badge = offerStatusBadge(offer.status);
      return _resultBanner(badge.label, offer.isAccepted);
    }

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : _confirmDecline,
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  side: const BorderSide(color: AppColors.danger),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: const Text('Decline'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _busy ? null : () => _respond('accept'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.success,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white),
                      )
                    : const Text('Accept offer'),
              ),
            ),
          ],
        ),
        if (offer.canNegotiate) ...[
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: _busy ? null : _negotiate,
              icon: const Icon(Icons.handshake_outlined, size: 18),
              label: const Text('Negotiate'),
            ),
          ),
        ] else if (offer.isFinalCounter) ...[
          const SizedBox(height: 8),
          const Text(
            'This is the final offer — negotiation is closed.',
            style: TextStyle(color: AppColors.textTertiary, fontSize: 12),
          ),
        ],
      ],
    );
  }

  Widget _resultBanner(String label, bool positive) {
    final c = positive ? (AppColors.success, AppColors.successBg) : (AppColors.textSecondary, AppColors.divider);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: c.$2, borderRadius: BorderRadius.circular(12)),
      child: Text(
        positive ? 'You accepted this offer — congratulations!' : 'Offer $label',
        style: TextStyle(color: c.$1, fontSize: 14, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _NegotiateSheet extends StatefulWidget {
  final String? currency;
  const _NegotiateSheet({this.currency});

  @override
  State<_NegotiateSheet> createState() => _NegotiateSheetState();
}

class _NegotiateSheetState extends State<_NegotiateSheet> {
  final _amount = TextEditingController();
  final _note = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  void _submit() {
    final amount = num.tryParse(_amount.text.trim().replaceAll(',', ''));
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Enter a valid monthly amount');
      return;
    }
    Navigator.of(context).pop((amount: amount, note: _note.text.trim()));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Propose a counter', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          const Text(
            'Suggest the monthly figure you have in mind. The business will review your request.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _amount,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Expected monthly (${currencySymbol(widget.currency).trim()})',
              hintText: 'e.g. 45000',
              errorText: _error,
              prefixIcon: const Icon(Icons.payments_outlined),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _note,
            maxLines: 3,
            minLines: 2,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Note (optional)',
              hintText: 'Add any context for your request',
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 48,
            child: ElevatedButton(onPressed: _submit, child: const Text('Send request')),
          ),
        ],
      ),
    );
  }
}

class _Thread extends StatelessWidget {
  final List<OfferEvent> events;
  final String? currency;
  const _Thread({required this.events, this.currency});

  @override
  Widget build(BuildContext context) {
    if (events.isEmpty) return const SizedBox.shrink();
    return TitledCard(
      title: 'Activity',
      icon: Icons.history,
      child: Column(
        children: [
          for (int i = 0; i < events.length; i++) ...[
            if (i > 0) const Divider(height: 18, color: AppColors.divider),
            _EventRow(event: events[i], currency: currency),
          ],
        ],
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  final OfferEvent event;
  final String? currency;
  const _EventRow({required this.event, this.currency});

  @override
  Widget build(BuildContext context) {
    final who = switch (event.actorType) {
      'talent' => 'You',
      'business' => 'Business',
      'admin' => 'SquadHire',
      _ => 'System',
    };
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 4,
          backgroundColor: event.isMine ? AppColors.primary : AppColors.textTertiary,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$who · ${humanize(event.action)}${event.amount != null ? ' ${formatMoney(event.amount, currency)}' : ''}',
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              if ((event.note ?? '').trim().isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    event.note!,
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ),
              if (event.createdAt != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    timeAgo(event.createdAt),
                    style: const TextStyle(color: AppColors.textTertiary, fontSize: 11),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _AskButton extends ConsumerWidget {
  final String offerId;
  const _AskButton({required this.offerId});

  Future<void> _ask(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final question = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 8,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Ask about this offer', style: Theme.of(ctx).textTheme.titleMedium),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              autofocus: true,
              maxLines: 4,
              minLines: 3,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(hintText: 'Your question for the business'),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.of(ctx).pop(controller.text.trim()),
                child: const Text('Send'),
              ),
            ),
          ],
        ),
      ),
    );
    controller.dispose();
    if (question == null || question.isEmpty) return;
    try {
      await ref.read(offersServiceProvider).askQuestion(offerId, question);
      ref.invalidate(offerDetailProvider(offerId));
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Question sent — you'll be notified when it's answered.")),
        );
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to send question')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      onPressed: () => _ask(context, ref),
      icon: const Icon(Icons.help_outline, size: 18),
      label: const Text('Ask a question'),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(double.infinity, 48),
      ),
    );
  }
}
