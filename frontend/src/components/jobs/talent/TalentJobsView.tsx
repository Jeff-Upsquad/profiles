'use client';

import { useState } from 'react';
import Link from 'next/link';
import JobsOptInCard from './JobsOptInCard';
import JobCardList from './JobCardList';
import {
  useJobPreferences,
  useOptOutOfJobs,
  useTalentJobs,
  type TalentJobsTab,
} from '@/hooks/useJobs';

// Talent Jobs module — opt-in gate + the 10-tab hiring funnel feed.

const TABS: { key: TalentJobsTab; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'call_for_interview', label: 'Call for Interview' },
  { key: 'interview', label: 'Interview' },
  { key: 'selected', label: 'Selected' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'placed', label: 'Placed' },
];

export default function TalentJobsView() {
  const [tab, setTab] = useState<TalentJobsTab>('new');
  const { data: prefs, isLoading: prefsLoading } = useJobPreferences();
  const optOut = useOptOutOfJobs();
  const optedIn = prefs?.opted_in === true;
  const { data: jobs, isLoading, isError } = useTalentJobs(tab, { enabled: optedIn });
  const { data: newJobs } = useTalentJobs('new', { enabled: optedIn });

  const newCount = (newJobs ?? []).length;

  return (
    <div className="space-y-6">
      {/* Compact hero */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content">
          <div className="mb-2.5 stagger-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {optedIn && newCount > 0
                ? `${newCount} new opening${newCount === 1 ? '' : 's'}`
                : 'Opportunities'}
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px] stagger-2">
            Job Openings
          </h1>
          <p className="mt-1.5 max-w-xl font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
            Full-time roles from businesses hiring through UpSquad — apply, interview and get placed,
            all in one place.
          </p>
        </div>
      </section>

      {prefsLoading && (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
          <div className="h-56 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        </div>
      )}

      {/* Opt-in gate */}
      {!prefsLoading && !optedIn && <JobsOptInCard />}

      {!prefsLoading && optedIn && (
        <>
          {/* Preferences summary — edited in Basic Profile → Job Preference */}
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#E7E7EA] bg-white px-5 py-4">
            <div className="min-w-0">
              <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                Job preferences
              </h3>
              <p className="mt-0.5 truncate text-xs text-[#737373]">
                {(() => {
                  const locations = [
                    ...(prefs?.preferred_cities ?? []),
                    ...(prefs?.preferred_districts ?? []),
                    ...(prefs?.preferred_states ?? []),
                    ...(prefs?.preferred_countries ?? []),
                  ];
                  return [
                    locations.length > 0 ? locations.join(', ') : 'Anywhere',
                    (prefs?.preferred_job_types?.length ?? 0) > 0
                      ? prefs!.preferred_job_types.join(', ')
                      : null,
                    prefs?.open_to_relocation ? 'Open to relocation' : null,
                    prefs?.expected_salary_monthly != null
                      ? `₹${prefs.expected_salary_monthly.toLocaleString()}/mo expected`
                      : null,
                    prefs?.notice_period_days != null ? `${prefs.notice_period_days}d notice` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                })()}
              </p>
              <button
                type="button"
                disabled={optOut.isPending}
                onClick={() => optOut.mutate()}
                className="mt-1.5 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
              >
                {optOut.isPending ? 'Opting out…' : 'Opt out of job openings'}
              </button>
            </div>
            <Link
              href="/talent/basic-profile?section=job_preference"
              className="shrink-0 rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#525252] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            >
              Edit
            </Link>
          </div>

          {/* Funnel tab strip — horizontal scroll on narrow screens */}
          <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-1.5">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                const count = t.key === 'new' ? newCount : null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                        : 'text-[#525252] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {t.label}
                    {count !== null && count > 0 && (
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                          isActive ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#E7E7EA] text-[#525252]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <JobCardList items={jobs} tab={tab} isLoading={isLoading} isError={isError} />
        </>
      )}
    </div>
  );
}
