import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme.dart';
import '../../models/onboarding_progress.dart';
import '../../providers/jobs_providers.dart';
import '../../providers/providers.dart';
import '../../providers/talent_providers.dart';
import '../../widgets/ui_kit.dart';
import '../jobs/jobs_view.dart';
import '../offers/talent_offers_view.dart';
import '../update/update_card.dart';

const _tabModule = {
  'subscriptions': 'subscriptions',
  'assignments': 'assignments',
  'jobs': 'jobs',
};

const _tabLabel = {
  'subscriptions': 'Subscriptions',
  'assignments': 'Assignments',
  'jobs': 'Job Openings',
};

class HomeScreen extends ConsumerStatefulWidget {
  final String? initialTab;
  const HomeScreen({super.key, this.initialTab});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  late String _tab;

  @override
  void initState() {
    super.initState();
    _tab = _isHomeTab(widget.initialTab) ? widget.initialTab! : 'subscriptions';
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialTab != oldWidget.initialTab && _isHomeTab(widget.initialTab)) {
      _tab = widget.initialTab!;
    }
  }

  bool _isHomeTab(String? v) =>
      v == 'subscriptions' || v == 'assignments' || v == 'jobs';

  void _setTab(String next) {
    setState(() => _tab = next);
    final uri = next == 'subscriptions' ? '/home' : '/home?tab=$next';
    context.go(uri);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final me = ref.watch(talentMeProvider).value;
    final firstName = (user?.fullName ?? me?.fullName ?? '').trim().split(RegExp(r'\s+')).first;
    final onboarded = user?.isOnboarded ?? true;
    final approved = user?.isApproved == true || me?.approvalStatus == 'approved';
    final active = user?.isActive != false && me?.isActive != false;

    final progress = ref.watch(onboardingProgressProvider).value;
    final access = ref.watch(moduleAccessProvider).value;
    final accessLoading = ref.watch(moduleAccessProvider).isLoading;

    final subUnread = ref.watch(unreadSubscriptionFeedCountProvider).value ?? 0;
    final assignUnread = ref.watch(unreadAssignmentCountProvider).value ?? 0;
    final jobsUnread = ref.watch(jobsUnreadCountProvider).value ?? 0;

    if (!onboarded) {
      return const _TrainingGate();
    }

    final module = _tabModule[_tab]!;
    final lock = access?.lockedInfo(module);
    final unlocked = access?.unlocked.contains(module) ?? false;
    final tabLocked = !accessLoading && !unlocked && (lock != null || !onboarded);

    return ColoredBox(
      color: AppColors.surface,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              children: [
                const UpdateCard(),
                HeroCard(
                  eyebrow: approved ? 'Talent Workspace' : 'Pending Approval',
                  title: firstName.isEmpty ? 'Welcome back.' : 'Welcome back, ',
                  titleHighlight: firstName.isEmpty ? null : '$firstName.',
                  subtitle:
                      'Subscriptions, assignments, and job openings in one place.',
                  live: approved && active,
                  trailing: !active
                      ? const Pill(label: 'Profile Inactive', variant: BadgeVariant.red)
                      : null,
                ),
                if (progress != null && progress.showStrip) ...[
                  const SizedBox(height: 16),
                  _OnboardingJourney(progress: progress),
                ],
                const SizedBox(height: 16),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SoftSegmentedTabs(
              expanded: true,
              tabs: [
                SegmentTab(
                  key: 'subscriptions',
                  label: 'Subscriptions',
                  count: subUnread,
                ),
                SegmentTab(
                  key: 'assignments',
                  label: 'Assignments',
                  count: assignUnread,
                ),
                SegmentTab(key: 'jobs', label: 'Jobs', count: jobsUnread),
              ],
              activeKey: _tab,
              onChange: _setTab,
            ),
          ),
          Expanded(
            flex: 3,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: tabLocked
                  ? _ModuleLocked(
                      label: _tabLabel[_tab] ?? _tab,
                      chapterTitle: lock?.chapterTitle,
                    )
                  : switch (_tab) {
                      'jobs' => const JobsView(),
                      'assignments' => const TalentOffersView(assignments: true),
                      _ => const TalentOffersView(),
                    },
            ),
          ),
        ],
      ),
    );
  }
}

class _OnboardingJourney extends StatelessWidget {
  final OnboardingProgress progress;
  const _OnboardingJourney({required this.progress});

  @override
  Widget build(BuildContext context) {
    final stages = [
      (short: 'Sign-up', done: progress.signedUp),
      (short: 'Course', done: progress.onboardingCompleted),
      (short: 'Basic', done: progress.basicProfileCompleted),
      (short: 'Job', done: progress.jobProfileCompleted),
      (short: 'Portfolio', done: progress.portfolioCompleted),
    ];

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: AppShadows.soft,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Your onboarding journey',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.24,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            progress.allCompletedAt != null
                ? "You've completed every stage. Nice work!"
                : 'Complete each stage to unlock the full talent workspace.',
            style: const TextStyle(fontSize: 12, color: AppColors.textTertiary),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              for (int i = 0; i < stages.length; i++) ...[
                Expanded(
                  child: Column(
                    children: [
                      Icon(
                        stages[i].done ? Icons.check_circle : Icons.circle_outlined,
                        size: 22,
                        color: stages[i].done
                            ? AppColors.success
                            : const Color(0xFFD1D5DB),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        stages[i].short,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: stages[i].done
                              ? AppColors.textPrimary
                              : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _TrainingGate extends StatelessWidget {
  const _TrainingGate();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Container(
          constraints: const BoxConstraints(maxWidth: 420),
          padding: const EdgeInsets.fromLTRB(32, 48, 32, 48),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x14000000),
                blurRadius: 30,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.accentWash,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(Icons.play_circle_outline, size: 28, color: AppColors.primary),
              ),
              const SizedBox(height: 20),
              const Text(
                'Complete Your Training to Get Started',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.65,
                  height: 1.15,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Watch the onboarding video to unlock all modules and start building your profile.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.45),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => context.push('/more/training'),
                  child: const Text('Go to Training'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ModuleLocked extends StatelessWidget {
  final String label;
  final String? chapterTitle;
  const _ModuleLocked({required this.label, this.chapterTitle});

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.fromLTRB(20, 40, 20, 40),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            children: [
              const Icon(Icons.lock_outline, size: 28, color: AppColors.textMuted),
              const SizedBox(height: 12),
              Text(
                chapterTitle == null || chapterTitle!.isEmpty
                    ? 'Complete training to unlock $label.'
                    : 'Complete "$chapterTitle" to unlock $label.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.push('/more/training'),
                child: const Text('Go to Training'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
