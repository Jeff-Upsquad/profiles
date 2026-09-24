'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import OnboardingHub from '@/views/onboarding/OnboardingHub';

function RejectedCandidatesContent() {
  const params = useSearchParams();
  const track = params.get('track') === 'jobs' ? 'jobs' : 'partner';
  const tabs = [
    { value: 'partner', label: 'Partner Program' },
    { value: 'jobs', label: 'Jobs' },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-gray-200" role="tablist" aria-label="Rejected candidate program">
        {tabs.map((tab) => (
          <Link key={tab.value} role="tab" aria-selected={track === tab.value}
            href={`/rejected-candidates${tab.value === 'jobs' ? '?track=jobs' : ''}`}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${track === tab.value
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {tab.label}
          </Link>
        ))}
      </div>
      <OnboardingHub track={track} rejectedOnly />
    </div>
  );
}

export default function RejectedCandidatesPage() {
  return <Suspense><RejectedCandidatesContent /></Suspense>;
}
