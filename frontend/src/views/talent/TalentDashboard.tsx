import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMyOnboardingProgress, type OnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useModuleAccess } from '@/hooks/useTraining';
import Badge from '@/components/ui/Badge';
import TalentHomeTabs, { type TalentHomeTab } from '@/components/layout/TalentHomeTabs';
import TalentOffersView from '@/components/subscriptions/TalentOffersView';
import TalentJobsView from '@/components/jobs/talent/TalentJobsView';
import ModuleUnlockGate from '@/components/training/ModuleUnlockGate';

type OnboardingStageKey = keyof OnboardingProgress;

const ONBOARDING_STAGES: { key: OnboardingStageKey; label: string; short: string; pendingHint: string }[] = [
  { key: 'signed_up', label: 'Sign-up', short: 'Sign-up', pendingHint: 'Sign up to get started' },
  { key: 'onboarding_completed', label: 'Onboarding Course', short: 'Course', pendingHint: 'Complete the onboarding course' },
  { key: 'basic_profile_completed', label: 'Basic Profile', short: 'Basic', pendingHint: 'Fill in every required section of your basic profile' },
  { key: 'job_profile_completed', label: 'Job Profile', short: 'Job', pendingHint: 'Create a job profile and submit it for review' },
  { key: 'portfolio_completed', label: 'Portfolio', short: 'Portfolio', pendingHint: 'Add at least one item to a job profile' },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function OnboardingStageStrip({ progress }: { progress: OnboardingProgress }) {
  return (
    <div className="flex items-start justify-between gap-2 sm:justify-start sm:gap-4">
      {ONBOARDING_STAGES.map((stage, i) => {
        const done = progress[stage.key];
        const isLast = i === ONBOARDING_STAGES.length - 1;
        return (
          <div
            key={stage.key}
            className="flex items-start gap-2 sm:gap-4"
            title={done ? `${stage.label}: Done` : `${stage.label}: ${stage.pendingHint}`}
          >
            <div className="flex flex-col items-center gap-1.5">
              <span className="relative z-10 flex h-6 w-6 items-center justify-center">
                {done ? (
                  <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </span>
              <span
                className={`font-[family-name:var(--font-inter)] text-[11px] font-medium leading-none ${
                  done ? 'text-[#0a0a0a]' : 'text-[#a3a3a3]'
                }`}
              >
                {stage.short}
              </span>
            </div>
            {!isLast && (
              <span
                className={`mt-3 h-0.5 w-6 sm:w-10 ${done ? 'bg-green-300' : 'bg-gray-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const TAB_MODULE: Record<TalentHomeTab, string> = {
  subscriptions: 'subscriptions',
  assignments: 'assignments',
  jobs: 'jobs',
};

const TAB_LABEL: Record<TalentHomeTab, string> = {
  subscriptions: 'Subscriptions',
  assignments: 'Assignments',
  jobs: 'Job Openings',
};

function isHomeTab(v: string | null): v is TalentHomeTab {
  return v === 'subscriptions' || v === 'assignments' || v === 'jobs';
}

export default function TalentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: onboardingProgress } = useMyOnboardingProgress();
  const { data: moduleAccess, isLoading: accessLoading } = useModuleAccess();
  const isApproved = user?.approval_status === 'approved';
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;
  const [tab, setTab] = useState<TalentHomeTab>('subscriptions');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('tab');
    if (isHomeTab(q)) setTab(q);
  }, []);

  const handleTab = (next: TalentHomeTab) => {
    setTab(next);
    const url = next === 'subscriptions' ? '/talent/dashboard' : `/talent/dashboard?tab=${next}`;
    router.replace(url, { scroll: false });
  };

  const showOnboardingStrip = (() => {
    if (!onboardingProgress) return false;
    if (!onboardingProgress.all_completed_at) return true;
    const completedMs = new Date(onboardingProgress.all_completed_at).getTime();
    return Date.now() - completedMs < SEVEN_DAYS_MS;
  })();

  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const unlockedSet = new Set(moduleAccess?.unlocked ?? []);
  const lockedMap = new Map((moduleAccess?.locked ?? []).map((l) => [l.module, l]));
  const activeModule = TAB_MODULE[tab];
  const activeLock = lockedMap.get(activeModule);
  const tabLocked =
    !accessLoading &&
    !unlockedSet.has(activeModule) &&
    (!!activeLock || !onboarded);

  if (!onboarded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-8 py-12 text-center shadow-[0_8px_30px_-6px_rgba(0,0,0,0.08)]">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a]">
              Complete Your <span className="text-rainbow">Training</span> to Get Started
            </h1>
            <p className="mt-3 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] max-w-sm mx-auto leading-relaxed">
              Watch the onboarding video to unlock all modules and start building your profile.
            </p>
            <Link href="/talent/training" className="btn-iridescent mt-6 inline-flex text-sm py-2.5 px-5">
              Go to Training
              <svg className="arrow-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 inline-flex items-center gap-2 stagger-1">
              <span className="eyebrow-rainbow">
                {isApproved ? 'Talent Workspace' : 'Pending Approval'}
              </span>
              {isApproved && user?.is_active !== false && (
                <span className="pill-live">Live</span>
              )}
              {user?.is_active === false && (
                <Badge variant="red">Profile Inactive</Badge>
              )}
            </div>

            <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] sm:text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Welcome back{firstName ? <>, <span className="text-rainbow">{firstName}</span></> : ''}.
            </h1>
            <p className="mt-1 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Subscriptions, assignments, and job openings in one place.
            </p>
          </div>
        </div>
      </section>

      {showOnboardingStrip && onboardingProgress && (
        <section className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Your onboarding journey
              </h2>
              <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#737373]">
                {onboardingProgress.all_completed_at
                  ? 'You’ve completed every stage. Nice work!'
                  : 'Complete each stage to unlock the full talent workspace.'}
              </p>
            </div>
          </div>
          <OnboardingStageStrip progress={onboardingProgress.progress} />
        </section>
      )}

      <div className="sticky top-[56px] z-20 -mx-4 bg-[#F5F5F6]/95 px-4 py-2 backdrop-blur-sm md:static md:mx-0 md:bg-transparent md:px-0 md:py-0">
        <TalentHomeTabs active={tab} onChange={handleTab} />
      </div>

      {tabLocked && activeLock ? (
        <ModuleUnlockGate
          moduleLabel={TAB_LABEL[tab]}
          chapterId={activeLock.chapter_id}
        />
      ) : tabLocked ? (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-10 text-center">
          <p className="text-sm font-semibold text-[#0a0a0a]">Complete training to unlock {TAB_LABEL[tab]}.</p>
          <Link href="/talent/training" className="btn-iridescent mt-4 inline-flex text-sm">
            Go to Training
          </Link>
        </div>
      ) : tab === 'jobs' ? (
        <TalentJobsView embedded />
      ) : (
        <TalentOffersView variant={tab === 'assignments' ? 'assignment' : 'subscription'} embedded />
      )}
    </div>
  );
}
