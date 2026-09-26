import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useMyOnboardingProgress, type OnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useModuleAccess } from '@/hooks/useTraining';
import TalentHomeTabs, { type TalentHomeTab } from '@/components/layout/TalentHomeTabs';
import TalentOffersView, { WhatsAppUpdatesToggle } from '@/components/subscriptions/TalentOffersView';
import TalentJobsView from '@/components/jobs/talent/TalentJobsView';
import ModuleUnlockGate from '@/components/training/ModuleUnlockGate';
import PartnerLockedView from '@/components/partner/PartnerLockedView';
import TalentDesktopOverview from '@/components/talent/TalentDesktopOverview';

type BooleanStageKey =
  | 'signed_up'
  | 'onboarding_completed'
  | 'basic_profile_completed'
  | 'job_profile_completed'
  | 'portfolio_completed'
  | 'app_downloaded'
  | 'webinar_attended';

const ONBOARDING_STAGES: { key: BooleanStageKey; label: string; short: string; pendingHint: string }[] = [
  { key: 'signed_up', label: 'Sign-up', short: 'Sign-up', pendingHint: 'Sign up to get started' },
  { key: 'onboarding_completed', label: 'Onboarding Course', short: 'Course', pendingHint: 'Complete the onboarding course' },
  { key: 'basic_profile_completed', label: 'Basic Profile', short: 'Basic', pendingHint: 'Fill in every required section of your basic profile' },
  { key: 'job_profile_completed', label: 'Job Profile', short: 'Job', pendingHint: 'Create a job profile and submit it for review' },
  { key: 'portfolio_completed', label: 'Portfolio', short: 'Portfolio', pendingHint: 'Add at least one item to a job profile' },
  { key: 'app_downloaded', label: 'App downloaded', short: 'App', pendingHint: 'Download the SquadHire app and sign in' },
  { key: 'webinar_attended', label: 'Webinar attended', short: 'Webinar', pendingHint: 'Register for the onboarding webinar in Training and attend it' },
];

interface StripStage {
  key: string;
  label: string;
  short: string;
  done: boolean;
  /** Started but not done — e.g. registered for the webinar, course half-way. */
  inProgress: boolean;
  hint: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function stripStages(progress: OnboardingProgress): StripStage[] {
  const stages: StripStage[] = ONBOARDING_STAGES
    // Sales and accountant profiles have no portfolio step.
    .filter((stage) => stage.key !== 'portfolio_completed' || progress.portfolio_required !== false)
    // Older API responses have no talent-board fields — hide those stages
    // rather than show them as permanently pending.
    .filter((stage) => progress[stage.key] !== undefined)
    .map((stage) => {
      const done = !!progress[stage.key];
      const registered = stage.key === 'webinar_attended' && !done && !!progress.webinar_registered;
      return {
        key: stage.key,
        label: stage.label,
        short: stage.short,
        done,
        inProgress: registered,
        hint: done ? 'Done' : registered ? 'You’re registered — attend the webinar to complete this step' : stage.pendingHint,
      };
    });
  const courses = [
    { key: 'partner_course', label: 'Partner Program course', short: 'Partner course', course: progress.partner_course },
    { key: 'jobs_course', label: 'Jobs course', short: 'Jobs course', course: progress.jobs_course },
  ] as const;
  for (const { key, label, short, course } of courses) {
    if (!course) continue;
    stages.push({
      key,
      label,
      short,
      done: course.done,
      inProgress: !course.done && course.completed > 0,
      hint: course.done
        ? 'Done'
        : `${course.completed} of ${course.total} pages complete — finish it in Training`,
    });
  }
  return stages;
}

function OnboardingStageStrip({ progress }: { progress: OnboardingProgress }) {
  const stages = stripStages(progress);
  return (
    // Phones: a wrapping grid so every stage stays visible (a single row of up
    // to nine would scroll off-screen). sm+: one connected row.
    <div className="grid grid-cols-5 gap-x-1 gap-y-4 sm:flex sm:flex-wrap sm:items-start sm:gap-4">
      {stages.map((stage, i) => {
        const { done, inProgress } = stage;
        const isLast = i === stages.length - 1;
        return (
          <div
            key={stage.key}
            className="flex shrink-0 items-start justify-center sm:justify-start sm:gap-4"
            title={`${stage.label}: ${stage.hint}`}
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
                ) : inProgress ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-amber-400 bg-white">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                  </span>
                ) : (
                  <span className="h-5 w-5 rounded-full border-2 border-gray-300 bg-white" />
                )}
              </span>
              <span
                className={`text-center font-[family-name:var(--font-inter)] text-[11px] font-medium leading-tight sm:whitespace-nowrap sm:leading-none ${
                  done || inProgress ? 'text-[#0a0a0a]' : 'text-[#a3a3a3]'
                }`}
              >
                {stage.short}
              </span>
            </div>
            {!isLast && (
              <span
                className={`mt-3 hidden h-0.5 sm:block sm:w-8 lg:w-10 ${done ? 'bg-green-300' : 'bg-gray-200'}`}
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

/**
 * Desktop (md+, where the talent sidebar is visible) gets an overview; mobile
 * and the native app's WebView (no sidebar) get the tabbed work feeds, since
 * Home is their only way into Subscriptions / Assignments / Jobs. null until
 * measured, so neither body renders — and fetches — on the wrong screen.
 */
function useHomeLayout(): 'overview' | 'feeds' | null {
  const [layout, setLayout] = useState<'overview' | 'feeds' | null>(null);
  useEffect(() => {
    let inApp = false;
    try {
      inApp = new URLSearchParams(window.location.search).get('in_app') === '1'
        || sessionStorage.getItem('squadhire_in_app') === '1';
    } catch {
      inApp = false;
    }
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setLayout(!inApp && mq.matches ? 'overview' : 'feeds');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return layout;
}

function isHomeTab(v: string | null): v is TalentHomeTab {
  return v === 'subscriptions' || v === 'assignments' || v === 'jobs';
}

export default function TalentDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: onboardingProgress } = useMyOnboardingProgress();
  const { data: moduleAccess, isLoading: accessLoading } = useModuleAccess();
  const layout = useHomeLayout();
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;
  const partnerAvailable = user?.partner_approval_status === undefined || user.partner_approval_status === 'approved';
  // A talent who never asked for Jobs has no Jobs tab; everyone else keeps all
  // three, because Subscriptions and Assignments are now browsable (read-only)
  // even before Partner Program approval.
  const wantsJobs = user?.wants_jobs !== false;
  const homeTabs: TalentHomeTab[] | undefined = wantsJobs
    ? undefined
    : ['subscriptions', 'assignments'];
  const [tab, setTab] = useState<TalentHomeTab>(
    partnerAvailable || !wantsJobs ? 'subscriptions' : 'jobs',
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('tab');
    if (isHomeTab(q) && (q !== 'jobs' || wantsJobs)) setTab(q);
  }, [wantsJobs]);

  const handleTab = (next: TalentHomeTab) => {
    if (next === 'jobs' && !wantsJobs) return;
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

  const onboardingStrip = showOnboardingStrip && onboardingProgress ? (
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
  ) : null;

  // Not measured yet — render nothing rather than the wrong body.
  if (!layout) return null;

  if (layout === 'overview') {
    return (
      <div className="space-y-6">
        <TalentDesktopOverview wantsJobs={wantsJobs}>
          {partnerAvailable && <WhatsAppUpdatesToggle />}
          {onboardingStrip}
        </TalentDesktopOverview>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {partnerAvailable && <WhatsAppUpdatesToggle />}

      {onboardingStrip}

      <div className="-mx-4 bg-transparent px-4 py-2 md:mx-0 md:px-0 md:py-0">
        <TalentHomeTabs active={tab} onChange={handleTab} tabs={homeTabs} />
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
      ) : !partnerAvailable ? (
        <PartnerLockedView variant={tab === 'assignments' ? 'assignment' : 'subscription'} embedded />
      ) : (
        <TalentOffersView
          variant={tab === 'assignments' ? 'assignment' : 'subscription'}
          embedded
          showWhatsAppUpdates={false}
        />
      )}
    </div>
  );
}
