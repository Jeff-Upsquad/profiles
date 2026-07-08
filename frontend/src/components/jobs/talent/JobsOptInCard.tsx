'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useOptInToJobs } from '@/hooks/useJobs';

// Opt-in gate for job openings. Matching preferences (districts, job types,
// salary, notice period, relocation) live in Basic Profile → Job Preference.

export default function JobsOptInCard({ onDone }: { onDone?: () => void }) {
  const optIn = useOptInToJobs();

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-5">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFAC2]">
          <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
          Get discovered for jobs
        </h2>
        <p className="mt-1 text-sm text-[#525252]">
          Opt in and businesses hiring full-time roles can reach you with job openings matched to
          your profile and job preferences. You can opt out anytime.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#737373]">
          Preferred districts, job types, expected salary and notice period are set in{' '}
          <Link
            href="/talent/basic-profile?section=job_preference"
            className="font-semibold text-[#0a0a0a] underline underline-offset-2 hover:no-underline"
          >
            Basic Profile → Job Preference
          </Link>
          .
        </p>
        <Button
          size="sm"
          loading={optIn.isPending}
          onClick={() => optIn.mutate({}, { onSuccess: () => onDone?.() })}
        >
          Opt in to job openings
        </Button>
      </div>
    </div>
  );
}
