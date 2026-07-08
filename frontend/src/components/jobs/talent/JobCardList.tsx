'use client';

import JobCard from './JobCard';
import type { TalentJobFeedItem, TalentJobsTab } from '@/hooks/useJobs';

const EMPTY_COPY: Record<TalentJobsTab, { title: string; body: string }> = {
  new: {
    title: 'No new openings right now',
    body: "We'll notify you when a business posts a job matching your preferences.",
  },
  accepted: {
    title: 'No applications yet',
    body: 'Openings you apply to will show up here while the business screens applicants.',
  },
  shortlisted: {
    title: 'Nothing shortlisted yet',
    body: "When a business shortlists you, the opening moves here — you'll be notified.",
  },
  call_for_interview: {
    title: 'No interview calls',
    body: 'Interview invitations you receive will appear here to accept or decline.',
  },
  interview: {
    title: 'No interviews in progress',
    body: 'Openings where you accepted an interview call will show up here.',
  },
  selected: {
    title: 'Nothing here yet',
    body: 'Openings where you cleared the interview will show up here.',
  },
  rejected: {
    title: 'Nothing here',
    body: 'Openings that were declined or not taken forward will show up here.',
  },
  offer: {
    title: 'No offers yet',
    body: 'Offer letters you receive will appear here to review and respond.',
  },
  hired: {
    title: 'No hires yet',
    body: "When you accept an offer and the business hires you, it'll show here.",
  },
  placed: {
    title: 'No placements yet',
    body: 'Once you join a role, the business marks you placed and it shows here.',
  },
};

export default function JobCardList({
  items,
  tab,
  isLoading,
  isError,
}: {
  items: TalentJobFeedItem[] | undefined;
  tab: TalentJobsTab;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="h-20 animate-pulse rounded-xl bg-[#f0f0f0]" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#f0f0f0]" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#f0f0f0]" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-red-900">
            Could not load job openings
          </h3>
          <p className="mt-0.5 text-sm text-red-700">Please refresh the page to try again.</p>
        </div>
      </div>
    );
  }

  if ((items?.length ?? 0) === 0) {
    const copy = EMPTY_COPY[tab];
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
        <div className="hero-glow-purple pointer-events-none absolute inset-0" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
            <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
            {copy.title}
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">{copy.body}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {items!.map((item, i) => (
        <div key={item.recipient_id ?? item.candidate_id ?? i} className={`stagger-${Math.min(i + 1, 6)}`}>
          <JobCard item={item} />
        </div>
      ))}
    </div>
  );
}
