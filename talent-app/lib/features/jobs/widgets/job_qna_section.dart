import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/format.dart';
import '../../../core/theme.dart';
import '../../../models/job_profile_view.dart';
import '../../../providers/jobs_providers.dart';
import '../../../widgets/ui_kit.dart';

/// Job Q&A: published answers + the viewer's own pending questions, with an
/// "Ask a question" action. Posting invalidates the profile view so the new
/// pending question appears immediately.
class JobQnASection extends ConsumerWidget {
  final String jobProfileId;
  final List<JobQuestion> questions;
  final String? cardId;

  const JobQnASection({
    super.key,
    required this.jobProfileId,
    required this.questions,
    this.cardId,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Answered + published first, then the viewer's own pending questions.
    final visible = questions
        .where((q) => (q.isAnswered && q.isPublished) || q.isMine)
        .toList();

    return TitledCard(
      title: 'Questions & answers',
      icon: Icons.forum_outlined,
      trailing: TextButton(
        onPressed: () => _showAskSheet(context, ref),
        style: TextButton.styleFrom(
          minimumSize: const Size(0, 32),
          padding: const EdgeInsets.symmetric(horizontal: 8),
        ),
        child: const Text('Ask'),
      ),
      child: visible.isEmpty
          ? const Text(
              'No questions yet. Ask the business anything about this role.',
              style: TextStyle(color: AppColors.textTertiary, fontSize: 13),
            )
          : Column(
              children: [
                for (int i = 0; i < visible.length; i++) ...[
                  if (i > 0)
                    const Divider(height: 20, color: AppColors.divider),
                  _QnaTile(q: visible[i]),
                ],
              ],
            ),
    );
  }

  Future<void> _showAskSheet(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    bool sending = false;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            Future<void> submit() async {
              final text = controller.text.trim();
              if (text.isEmpty || sending) return;
              setSheetState(() => sending = true);
              try {
                await ref
                    .read(jobsServiceProvider)
                    .askQuestion(jobProfileId, text, cardId: cardId);
                ref.invalidate(jobProfileViewProvider(jobProfileId));
                if (ctx.mounted) Navigator.of(ctx).pop();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          "Question sent — you'll be notified when it's answered."),
                    ),
                  );
                }
              } catch (_) {
                setSheetState(() => sending = false);
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(content: Text('Failed to send question')),
                  );
                }
              }
            }

            return Padding(
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
                  Text('Ask a question',
                      style: Theme.of(ctx).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  const Text(
                    'The business will be notified. Answers may be published for other applicants.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: controller,
                    autofocus: true,
                    maxLines: 4,
                    minLines: 3,
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(
                      hintText: 'e.g. Is there flexibility on the joining date?',
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      onPressed: sending ? null : submit,
                      child: sending
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2.4, color: Colors.white),
                            )
                          : const Text('Send question'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
    controller.dispose();
  }
}

class _QnaTile extends StatelessWidget {
  final JobQuestion q;
  const _QnaTile({required this.q});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                q.question,
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (q.isMine && !q.isAnswered)
              const Pill(label: 'Awaiting answer', variant: BadgeVariant.yellow)
            else if (q.isMine)
              const Pill(label: 'You asked', variant: BadgeVariant.indigo),
          ],
        ),
        if (q.isAnswered) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              q.answer!,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 13.5,
                height: 1.45,
              ),
            ),
          ),
          if (q.answeredAt != null) ...[
            const SizedBox(height: 4),
            Text(
              'Answered ${timeAgo(q.answeredAt)}',
              style: const TextStyle(color: AppColors.textTertiary, fontSize: 11),
            ),
          ],
        ],
      ],
    );
  }
}
