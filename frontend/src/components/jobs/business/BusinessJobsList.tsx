'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import { useBusinessJobCards, type BusinessJobCardSummary } from '@/hooks/useBusinessJobs';
import {
  fmtDate,
  jobBusinessName,
  jobTitle,
  packageLabel,
  tintFor,
  type BadgeVariantName,
} from '@/components/jobs/shared';

// Business "My Job Posts" — hiring cards published to this business, each
// linking into the per-card console.

function stageBadge(card: BusinessJobCardSummary): { label: string; variant: BadgeVariantName } {
  const jc = card.job_card;
  if (jc?.closed_at) {
    return jc.close_mode === 'filled'
      ? { label: 'Filled', variant: 'green' }
      : { label: 'Closed', variant: 'gray' };
  }
  switch (jc?.hiring_stage) {
    case 'screening':
      return { label: 'Screening', variant: 'yellow' };
    case 'interviewing':
      return { label: 'Interviewing', variant: 'indigo' };
    case 'offering':
      return { label: 'Offers out', variant: 'indigo' };
    default:
      return { label: 'Sourcing', variant: 'blue' };
  }
}

function funnelSummary(card: BusinessJobCardSummary): string {
  const c = card.funnel_counts ?? {};
  const applied = (c.applied ?? 0) + (c.screening ?? 0);
  const parts: string[] = [];
  if (card.pending_recipients > 0) parts.push(`${card.pending_recipients} pending`);
  if (applied > 0) parts.push(`${applied} applied`);
  if (c.shortlisted) parts.push(`${c.shortlisted} shortlisted`);
  const interviews = (c.interview_invited ?? 0) + (c.interview ?? 0);
  if (interviews > 0) parts.push(`${interviews} in interviews`);
  if (c.selected) parts.push(`${c.selected} selected`);
  if (c.offer) parts.push(`${c.offer} offered`);
  const hired = (c.hired ?? 0) + (c.placed ?? 0);
  if (hired > 0) parts.push(`${hired} hired`);
  return parts.join(' · ') || 'No candidates yet';
}

export default function BusinessJobsList() {
  const { data: cards, isLoading, isError } = useBusinessJobCards();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content">
          <div className="mb-2.5 stagger-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              Job Posts
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px] stagger-2">
            My Job Posts
          </h1>
          <p className="mt-1.5 max-w-xl font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
            Track applicants, run interviews, send offers and hire — the full funnel for every role
            you&apos;re hiring through UpSquad.
          </p>
        </div>
      </section>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-900">Could not load your job posts.</p>
          <p className="mt-0.5 text-sm text-red-700">Please refresh the page to try again.</p>
        </div>
      )}

      {!isLoading && !isError && (cards?.length ?? 0) === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple pointer-events-none absolute inset-0" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              No job posts yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              When your hiring brief goes live, the job post and its candidate funnel will appear
              here.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (cards?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <ul className="divide-y divide-[#E7E7EA]">
            {cards!.map((card) => {
              const title = jobTitle(card.content);
              const businessName = jobBusinessName(card.content);
              const tint = tintFor(businessName);
              const badge = stageBadge(card);
              const pkg = packageLabel(card.content);
              return (
                <li key={card.id}>
                  <Link
                    href={`/business/job-posts/${card.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F5F5F6]"
                  >
                    <div
                      className={`${tint} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`}
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                          {title}
                        </p>
                        {pkg && (
                          <span className="shrink-0 rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a]">
                            {pkg}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#737373]">
                        {funnelSummary(card)}
                        {card.published_at ? ` · Published ${fmtDate(card.published_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      <svg className="h-4 w-4 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
