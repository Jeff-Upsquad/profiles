'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import Badge from '@/components/ui/Badge';
import PendingTag from '@/components/talent/PendingTag';
import { useUnreadSubscriptionCount, useUnreadAssignmentCount } from '@/hooks/useSubscriptionCards';
import { useUnreadJobsCount } from '@/hooks/useJobs';
import { usePartnerAccess } from '@/hooks/usePartnerProgram';
import { useMyProfiles } from '@/hooks/useProfiles';
import { useIncompleteTrainingCount } from '@/hooks/useTraining';
import { useTalentPendingTasks } from '@/hooks/useTalentPendingTasks';

interface WorkTile {
  label: string;
  to: string;
  tint: string;
  count: number;
  hint: string;
  icon: ReactNode;
}

const iconClass = 'h-5 w-5';

const ICONS = {
  subscriptions: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
    </svg>
  ),
  assignments: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  jobs: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  lock: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  chevron: (
    <svg className="h-4 w-4 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
};

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Desktop Dashboard body. On desktop the sidebar already links straight to the
 * Subscriptions / Assignments / Job Openings feeds, so instead of repeating
 * them here the Dashboard gives an at-a-glance overview: what's new in each
 * feed and what's left to do on the talent's own profile. Mobile keeps the
 * tabbed feeds (see TalentDashboard) because it has no sidebar.
 */
export default function TalentDesktopOverview({
  wantsJobs,
  children,
}: {
  wantsJobs: boolean;
  /** Rendered under the welcome header (WhatsApp toggle, onboarding strip). */
  children?: ReactNode;
}) {
  const { user } = useAuth();
  const { approved } = usePartnerAccess();
  // Same gating as the sidebar badges: the unread endpoints are partner-only.
  const { data: unreadSubs = 0 } = useUnreadSubscriptionCount({ enabled: approved });
  const { data: unreadAssignments = 0 } = useUnreadAssignmentCount({ enabled: approved });
  const { data: unreadJobs = 0 } = useUnreadJobsCount({ enabled: wantsJobs });
  const { data: profiles, isSuccess: profilesLoaded } = useMyProfiles();
  const { data: incompleteTraining = 0 } = useIncompleteTrainingCount();
  const pending = useTalentPendingTasks({ enabled: !user?.application_cancelled_at });

  const firstName = user?.full_name?.split(' ')[0] ?? '';

  const tiles: WorkTile[] = [
    {
      label: 'Subscriptions',
      to: '/talent/subscriptions',
      tint: 'tint-purple',
      count: unreadSubs,
      hint: unreadSubs > 0 ? 'New recurring offers waiting for you' : 'No new recurring offers',
      icon: ICONS.subscriptions,
    },
    {
      label: 'Assignments',
      to: '/talent/assignments',
      tint: 'tint-amber',
      count: unreadAssignments,
      hint: unreadAssignments > 0 ? 'New one-off projects waiting for you' : 'No new projects',
      icon: ICONS.assignments,
    },
    ...(wantsJobs
      ? [{
          label: 'Job Openings',
          to: '/talent/job-openings',
          tint: 'tint-green',
          count: unreadJobs,
          hint: unreadJobs > 0 ? 'Job openings you haven’t seen yet' : 'No new job openings',
          icon: ICONS.jobs,
        }]
      : []),
  ];

  const ownProfiles = profilesLoaded ? (profiles ?? []).filter((p) => !p.is_ghost) : [];
  const approvedProfiles = ownProfiles.filter((p) => p.status === 'approved').length;
  const inReview = ownProfiles.filter((p) => p.status === 'pending_review').length;
  const profileParts = [
    approvedProfiles > 0 && `${approvedProfiles} approved`,
    inReview > 0 && `${inReview} in review`,
    pending.pendingProfiles > 0 && `${pending.pendingProfiles} to submit`,
  ].filter(Boolean) as string[];

  const todo: { label: string; to: string; status: string; pending: boolean }[] = [
    {
      label: 'Basic Profile',
      to: '/talent/basic-profile',
      status: pending.basicPending
        ? `${plural(pending.basicSections.length, 'required section')} left`
        : 'Complete',
      pending: pending.basicPending,
    },
    {
      label: 'Job Profiles',
      to: '/talent/profiles',
      status: !profilesLoaded
        ? '…'
        : pending.noProfiles
          ? 'Create your first job profile'
          : profileParts.join(' · ') || plural(ownProfiles.length, 'profile'),
      pending: pending.profilesPending,
    },
    {
      label: 'Training Program',
      to: '/talent/training',
      status: incompleteTraining > 0 ? `${plural(incompleteTraining, 'item')} to finish` : 'All caught up',
      pending: incompleteTraining > 0,
    },
  ];

  return (
    <>
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-7 py-6">
        <div className="hero-glow-blur" />
        <div className="hero-content">
          <div className="mb-2 inline-flex items-center gap-2 stagger-1">
            <span className="eyebrow-rainbow">Talent Workspace</span>
            {user?.is_active === false ? (
              <Badge variant="red">Profile Inactive</Badge>
            ) : (
              <span className="pill-live">Live</span>
            )}
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[28px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
            Welcome back{firstName ? <>, <span className="text-rainbow">{firstName}</span></> : ''}.
          </h1>
          <p className="mt-1 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
            Here’s what’s new and what’s left to do.
          </p>
        </div>
      </section>

      {children}

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">
          New for you
        </h2>
        <div className={`grid gap-4 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {tiles.map((tile, i) => {
            // Subscriptions / Assignments are a read-only preview outside the
            // Partner Program, and their unread counts aren't available.
            const previewOnly = !approved && tile.to !== '/talent/job-openings';
            return (
              <Link key={tile.to} href={tile.to} className={`stat-card ${tile.tint} stagger-${i + 1} block`}>
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm"
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    {tile.icon}
                  </div>
                  {previewOnly && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#737373]" title="Preview only — join the Partner Program to respond">
                      {ICONS.lock}
                      Preview
                    </span>
                  )}
                </div>
                <div className="mt-6">
                  <p
                    className="font-[family-name:var(--font-jakarta)] text-[44px] leading-none font-semibold tracking-[-0.035em]"
                    style={{ color: 'var(--tint-text)' }}
                  >
                    {previewOnly ? '—' : tile.count}
                  </p>
                  <p className="mt-3 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-[#0a0a0a]">
                    {tile.label}
                  </p>
                  <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#525252]">
                    {previewOnly ? 'Browse live opportunities, read-only' : tile.hint}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="border-b border-[#E7E7EA] px-6 py-4 font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">
          Your profile
        </h2>
        <ul className="divide-y divide-[#E7E7EA]">
          {todo.map((row) => (
            <li key={row.to}>
              <Link href={row.to} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#FAFAFA]">
                <span className="w-40 shrink-0 font-[family-name:var(--font-inter)] text-sm font-semibold text-[#0a0a0a]">
                  {row.label}
                </span>
                <span className="flex-1 font-[family-name:var(--font-inter)] text-sm text-[#525252]">
                  {row.status}
                </span>
                {row.pending && <PendingTag />}
                {ICONS.chevron}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
