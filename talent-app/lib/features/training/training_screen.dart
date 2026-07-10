import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/launchers.dart';
import '../../core/theme.dart';
import '../../models/training.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/shimmer_loading.dart';
import '../../widgets/ui_kit.dart';
import '../subscriptions/widgets/empty_state.dart';

class TrainingScreen extends ConsumerWidget {
  const TrainingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final training = ref.watch(myTrainingProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Training program')),
      body: training.when(
        loading: () => const ShimmerCardList(),
        error: (_, _) => AppErrorRetry(onRetry: () => ref.invalidate(myTrainingProvider)),
        data: (t) {
          final courses = t.courses;
          final legacy = t.chapters;
          if (courses.isEmpty && legacy.isEmpty) {
            return const Padding(
              padding: EdgeInsets.only(top: 80),
              child: EmptyState(
                icon: Icons.school_outlined,
                title: 'No training yet',
                subtitle: 'Your courses and lessons will appear here.',
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(myTrainingProvider);
              ref.invalidate(moduleAccessProvider);
              await ref.read(myTrainingProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const _OnboardingBanner(),
                for (final c in courses) _CourseCard(course: c),
                _FinishOnboarding(
                  canFinish: courses.any((c) => c.isOnboarding && c.done),
                ),
                if (legacy.isNotEmpty) ...[
                  const SectionLabel('Other lessons', padding: EdgeInsets.fromLTRB(4, 8, 4, 10)),
                  for (final ch in legacy)
                    Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: _ChapterBlock(chapter: ch, language: 'en'),
                      ),
                    ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OnboardingBanner extends ConsumerWidget {
  const _OnboardingBanner();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(onboardingProgressProvider);
    return progress.maybeWhen(
      data: (p) {
        if (p.onboardingCompleted) return const SizedBox.shrink();
        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.infoBg,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.lock_open_outlined, color: AppColors.info, size: 20),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Finish your onboarding course to unlock the rest of the app.',
                  style: TextStyle(color: AppColors.info, fontSize: 13, height: 1.4),
                ),
              ),
            ],
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

class _FinishOnboarding extends ConsumerStatefulWidget {
  final bool canFinish;
  const _FinishOnboarding({required this.canFinish});

  @override
  ConsumerState<_FinishOnboarding> createState() => _FinishOnboardingState();
}

class _FinishOnboardingState extends ConsumerState<_FinishOnboarding> {
  bool _busy = false;

  Future<void> _finish() async {
    setState(() => _busy = true);
    try {
      await ref.read(trainingServiceProvider).completeOnboarding();
      ref.invalidate(onboardingProgressProvider);
      ref.invalidate(myTrainingProvider);
      ref.invalidate(moduleAccessProvider);
      await ref.read(authProvider.notifier).refreshUser();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Onboarding complete — the app is unlocked!')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not finish onboarding')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.canFinish) return const SizedBox.shrink();
    final progress = ref.watch(onboardingProgressProvider);
    return progress.maybeWhen(
      data: (p) {
        if (p.onboardingCompleted) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 12),
          child: SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: _busy ? null : _finish,
              icon: _busy
                  ? const SizedBox(
                      width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
                  : const Icon(Icons.lock_open),
              label: const Text('Finish onboarding & unlock the app'),
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
            ),
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}

String _remaining(String? expiresAt) {
  if (expiresAt == null) return '';
  final exp = DateTime.tryParse(expiresAt);
  if (exp == null) return '';
  final diff = exp.difference(DateTime.now());
  if (diff.isNegative) return 'Overdue';
  final d = diff.inDays;
  final h = diff.inHours % 24;
  final m = diff.inMinutes % 60;
  if (d > 0) return '${d}d ${h}h left';
  if (h > 0) return '${h}h ${m}m left';
  return '${m}m left';
}

class _CourseCard extends ConsumerStatefulWidget {
  final TrainingCourse course;
  const _CourseCard({required this.course});

  @override
  ConsumerState<_CourseCard> createState() => _CourseCardState();
}

class _CourseCardState extends ConsumerState<_CourseCard> {
  late String _language = widget.course.languages.first;
  bool _busy = false;

  TrainingCourse get c => widget.course;

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      await ref.read(trainingServiceProvider).startCourse(c.id);
      ref.invalidate(myTrainingProvider);
    } catch (_) {
      _snack('Could not start the course');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestReopen() async {
    try {
      await ref.read(trainingServiceProvider).requestReopen(c.id);
      _snack('Reopen requested — an admin will review it.');
    } catch (_) {
      _snack('Could not request a reopen');
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    final languages = c.languages;
    final remaining = c.countdownEnabled && c.started && !c.expired
        ? _remaining(c.expiresAt)
        : '';

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    c.title,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                if (c.done)
                  const Pill(label: 'Complete', variant: BadgeVariant.green, icon: Icons.check)
                else if (remaining.isNotEmpty)
                  Pill(
                    label: remaining,
                    variant: remaining == 'Overdue' ? BadgeVariant.red : BadgeVariant.yellow,
                  ),
              ],
            ),
            if ((c.description ?? '').isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(c.description!,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            ],
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: c.totalCount == 0 ? 0 : c.completedCount / c.totalCount,
                minHeight: 7,
                backgroundColor: AppColors.divider,
                valueColor: const AlwaysStoppedAnimation(AppColors.primary),
              ),
            ),
            const SizedBox(height: 6),
            Text('${c.completedCount} of ${c.totalCount} lessons done',
                style: const TextStyle(color: AppColors.textTertiary, fontSize: 12)),
            if (languages.length > 1) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const Icon(Icons.language, size: 18, color: AppColors.textSecondary),
                  const SizedBox(width: 8),
                  DropdownButton<String>(
                    value: _language,
                    underline: const SizedBox.shrink(),
                    items: [
                      for (final l in languages)
                        DropdownMenuItem(value: l, child: Text(languageLabel(l))),
                    ],
                    onChanged: (v) => setState(() => _language = v ?? _language),
                  ),
                ],
              ),
            ],
            if (c.countdownEnabled && !c.started) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _busy ? null : _start,
                  child: const Text('Start course'),
                ),
              ),
            ],
            if (c.expired) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _requestReopen,
                  child: const Text('Request to reopen'),
                ),
              ),
            ],
            const SizedBox(height: 8),
            for (final ch in c.chapters)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: _ChapterBlock(chapter: ch, language: _language),
              ),
          ],
        ),
      ),
    );
  }
}

class _ChapterBlock extends StatelessWidget {
  final TrainingChapter chapter;
  final String language;
  const _ChapterBlock({required this.chapter, required this.language});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          chapter.title,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        for (final lesson in chapter.lessons)
          _LessonRow(lesson: lesson, language: language),
      ],
    );
  }
}

class _LessonRow extends ConsumerStatefulWidget {
  final TrainingLesson lesson;
  final String language;
  const _LessonRow({required this.lesson, required this.language});

  @override
  ConsumerState<_LessonRow> createState() => _LessonRowState();
}

class _LessonRowState extends ConsumerState<_LessonRow> {
  bool _busy = false;

  Future<void> _toggle(bool next) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final svc = ref.read(trainingServiceProvider);
      if (next) {
        await svc.markLessonComplete(widget.lesson.id);
      } else {
        await svc.markLessonIncomplete(widget.lesson.id);
      }
      ref.invalidate(myTrainingProvider);
      ref.invalidate(moduleAccessProvider);
      ref.invalidate(onboardingProgressProvider);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not update lesson')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _watch() async {
    final url = widget.lesson.urlFor(widget.language);
    final ok = await openExternalUrl(url);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No video available for this lesson')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lesson = widget.lesson;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          _busy
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: Padding(
                    padding: EdgeInsets.all(4),
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : Checkbox(
                  value: lesson.completed,
                  onChanged: (v) => _toggle(v ?? false),
                  visualDensity: VisualDensity.compact,
                ),
          Expanded(
            child: Text(
              lesson.title,
              style: TextStyle(
                fontSize: 14,
                color: lesson.completed ? AppColors.textTertiary : AppColors.textPrimary,
                decoration: lesson.completed ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
          TextButton.icon(
            onPressed: _watch,
            icon: const Icon(Icons.play_circle_outline, size: 18),
            label: const Text('Watch'),
            style: TextButton.styleFrom(
              minimumSize: const Size(0, 36),
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
          ),
        ],
      ),
    );
  }
}
