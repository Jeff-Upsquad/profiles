import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMyProfiles } from '@/hooks/useProfiles';
import { useMyOnboardingProgress, type OnboardingProgress } from '@/hooks/useOnboardingProgress';
import Badge, { statusToBadgeVariant } from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

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

interface StatTile {
  label: string;
  value: number;
  hint: string;
  tint: string;
  icon: React.ReactNode;
}

export default function TalentDashboard() {
  const { user } = useAuth();
  const { data: profiles, isLoading } = useMyProfiles();
  const { data: onboardingProgress } = useMyOnboardingProgress();
  const isApproved = user?.approval_status === 'approved';
  const onboarded = user?.onboarding_completed !== false || user?.skip_onboarding === true;

  const showOnboardingStrip = (() => {
    if (!onboardingProgress) return false;
    if (!onboardingProgress.all_completed_at) return true;
    const completedMs = new Date(onboardingProgress.all_completed_at).getTime();
    return Date.now() - completedMs < SEVEN_DAYS_MS;
  })();

  const stats = {
    total: profiles?.length ?? 0,
    approved: profiles?.filter((p) => p.status === 'approved').length ?? 0,
    pending: profiles?.filter((p) => p.status === 'pending_review').length ?? 0,
    draft: profiles?.filter((p) => p.status === 'draft').length ?? 0,
  };

  const recentProfiles = (profiles ?? []).slice(0, 5);
  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const tiles: StatTile[] = [
    {
      label: 'Total Profiles',
      value: stats.total,
      hint: 'across all categories',
      tint: 'tint-purple',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Approved',
      value: stats.approved,
      hint: 'live & discoverable',
      tint: 'tint-green',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Review',
      value: stats.pending,
      hint: 'awaiting approval',
      tint: 'tint-amber',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Drafts',
      value: stats.draft,
      hint: 'in progress',
      tint: 'tint-blue',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
  ];

  if (!onboarded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-8 py-12 text-center shadow-[0_8px_30px_-6px_rgba(0,0,0,0.08)]">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2FCBC]">
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
    <div className="space-y-8">
      {/* ── Hero Section (compact) ── */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 stagger-1">
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

            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Welcome back{firstName ? <>, <span className="text-rainbow">{firstName}</span></> : ''}.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Track your profiles, manage your portfolio, and discover opportunities.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 stagger-4">
            <Link href="/talent/profiles/new" className="btn-iridescent text-sm py-2 px-3.5">
              Create Profile
              <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/talent/profiles"
              className="font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg border border-[#E8E5DE] bg-white px-3.5 py-2 text-sm font-semibold text-[#0a0a0a] transition-all duration-200 hover:bg-[#f0f0f0] active:scale-[0.97]"
            >
              View Profiles
            </Link>
          </div>
        </div>
      </section>

      {/* ── Onboarding progress strip (hides 7 days after all stages complete) ── */}
      {showOnboardingStrip && onboardingProgress && (
        <section className="rounded-2xl border border-[#E8E5DE] bg-white px-5 py-5 sm:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
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

      {/* ── Stat Cards (Pastel Tints) ── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <div
              key={tile.label}
              className={`stat-card ${tile.tint} stagger-${i + 1}`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm"
                  style={{ color: 'var(--tint-icon)' }}
                >
                  {tile.icon}
                </div>
              </div>
              <div className="mt-6">
                <p
                  className="font-[family-name:var(--font-jakarta)] text-[44px] leading-none font-semibold tracking-[-0.035em]"
                  style={{ color: 'var(--tint-text)' }}
                >
                  {tile.value}
                </p>
                <p className="mt-3 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-[#0a0a0a]">
                  {tile.label}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#525252]">
                  {tile.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Two-column: Recent Profiles + Quick Tips ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Profiles — main column */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] px-6 py-5">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Recent Profiles
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">Your latest job profiles and their status</p>
            </div>
            <Link
              href="/talent/profiles"
              className="font-[family-name:var(--font-inter)] inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-[#525252] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
            >
              View all
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {recentProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
                <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
                No profiles yet
              </h3>
              <p className="mb-5 max-w-sm text-sm text-[#737373]">
                Create your first profile to start getting discovered by businesses.
              </p>
              <Link href="/talent/profiles/new" className="btn-iridescent">
                Create your first profile
                <svg className="arrow-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-[#E8E5DE]">
              {recentProfiles.map((profile, i) => (
                <li
                  key={profile.id}
                  className={`group flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[#F7F6F3] stagger-${Math.min(i + 1, 6)}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#f0f0f0] text-[#525252] transition-colors group-hover:bg-[#F2FCBC] group-hover:text-[#0a0a0a]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a] truncate">
                        {profile.category?.name ?? 'Profile'}
                      </p>
                      <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
                        Created {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={statusToBadgeVariant(profile.status)}>
                      {profile.status.replace('_', ' ')}
                    </Badge>
                    <Link
                      href={`/talent/profiles/${profile.id}`}
                      className="font-[family-name:var(--font-inter)] hidden sm:inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#0a0a0a] transition-colors hover:bg-[#F2FCBC]"
                    >
                      View
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Side column — Pro tips / Featured */}
        <div className="space-y-4">
          {/* Featured tip card with conic border */}
          <div className="relative rounded-2xl bg-[#0a0a0a] p-6 text-white overflow-hidden noise-overlay">
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-rainbow opacity-30 blur-3xl" />
            <div className="relative">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm mb-4">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em]">
                Tips for approval
              </h3>
              <p className="mt-1.5 text-sm text-white/70 leading-relaxed">
                Add a strong portfolio, fill out all required fields, and pick a Native language to get approved faster.
              </p>
              <Link
                href="/talent/training"
                className="mt-5 inline-flex items-center gap-1 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-white hover:gap-2 transition-all"
              >
                Watch training videos
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl border border-[#E8E5DE] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Quick actions
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Update basic profile', to: '/talent/basic-profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                { label: 'View subscriptions', to: '/talent/subscriptions', icon: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4' },
                { label: 'Account settings', to: '/talent/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
              ].map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  className="group flex items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-[#525252] transition-colors hover:bg-[#F7F6F3] hover:text-[#0a0a0a]"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-[#a3a3a3] group-hover:text-[#0a0a0a] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </span>
                  <svg className="h-3 w-3 text-[#a3a3a3] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
