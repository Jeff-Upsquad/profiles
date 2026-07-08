'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useJobProfileView, useRespondToJob } from '@/hooks/useJobs';
import Button from '@/components/ui/Button';
import BusinessBrandSection from './BusinessBrandSection';
import JobQnASection from './JobQnASection';
import { currencySymbol } from '@/components/jobs/shared';

// Full job-profile view (recipient-gated server-side): the self-contained
// job + business + brand snapshots synced from SquadHub, plus published Q&A.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-[#E7E7EA] pt-3 first:mt-0 first:border-t-0 first:pt-0">
      <h2 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-[#525252]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function JobProfileView({ jobProfileId }: { jobProfileId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useJobProfileView(jobProfileId);
  const respond = useRespondToJob();
  // Page-level "Ask a question": scroll down to the Q&A section and open its
  // ask modal (the section runs in controlled mode).
  const qnaRef = useRef<HTMLDivElement>(null);
  const [askOpen, setAskOpen] = useState(false);
  const askQuestion = () => {
    qnaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setAskOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-64 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">
          Job profile not found or you don&apos;t have access.
        </p>
        <button
          onClick={() => router.push('/talent/job-openings')}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to job openings
        </button>
      </div>
    );
  }

  const { profile, questions, recipient } = data;
  const details = profile.details ?? {};
  const responsibilities = Array.isArray(details.responsibilities) ? details.responsibilities : [];
  const requirements = Array.isArray(details.requirements) ? details.requirements : [];
  const skills = Array.isArray(details.skills) ? details.skills : [];
  const benefits = Array.isArray(details.benefits) ? details.benefits : [];
  const workingDays = Array.isArray(details.working_days) ? details.working_days : [];
  const workingHours = details.working_hours
    ? [details.working_hours.start, details.working_hours.end].filter(Boolean).join(' – ')
    : null;
  const salary =
    details.salary_min != null || details.salary_max != null
      ? (() => {
          const sym = currencySymbol(details.salary_currency);
          const fmt = (n: number) => `${sym}${n.toLocaleString()}`;
          const range =
            details.salary_min != null && details.salary_max != null && details.salary_min !== details.salary_max
              ? `${fmt(details.salary_min)}–${fmt(details.salary_max)}`
              : fmt((details.salary_min ?? details.salary_max) as number);
          return `${range}/${details.salary_period === 'annual' || details.salary_period === 'yearly' ? 'yr' : 'mo'}`;
        })()
      : null;
  const experience =
    details.min_experience_years != null || details.max_experience_years != null
      ? details.min_experience_years != null && details.max_experience_years != null
        ? `${details.min_experience_years}–${details.max_experience_years} years`
        : details.min_experience_years != null
          ? `${details.min_experience_years}+ years`
          : `Up to ${details.max_experience_years} years`
      : null;
  const location = details.location ?? null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Job profile */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
            {profile.title}
          </h1>
          {salary && (
            <span className="shrink-0 rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
              {salary}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[#737373]">
          {[details.employment_type, details.work_mode, experience].filter(Boolean).join(' · ')}
        </p>

        {/* Action bar — respond to the live opening / jump down to Q&A */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-[#E7E7EA] pb-4">
          {recipient?.status === 'pending' && (
            <>
              <Button
                size="sm"
                onClick={() => respond.mutate({ recipientId: recipient.id, action: 'accept' })}
                disabled={respond.isPending}
              >
                {respond.isPending ? 'Saving…' : 'Accept'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => respond.mutate({ recipientId: recipient.id, action: 'reject' })}
                disabled={respond.isPending}
                className="!border-[#FCA5A5] !text-[#B91C1C]"
              >
                Decline
              </Button>
            </>
          )}
          {recipient?.status === 'accepted' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-semibold text-[#065F46]">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Applied
            </span>
          )}
          {recipient?.status === 'rejected' && (
            <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-3 py-1 text-xs font-semibold text-[#737373]">
              Declined
            </span>
          )}
          <Button size="sm" variant="outline" onClick={askQuestion}>
            Ask a question
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {profile.description && (
            <Section title="About the role">
              <p className="whitespace-pre-line text-sm text-[#525252]">{profile.description}</p>
            </Section>
          )}

          {responsibilities.length > 0 && (
            <Section title="Responsibilities">
              <BulletList items={responsibilities} />
            </Section>
          )}

          {requirements.length > 0 && (
            <Section title="Requirements">
              <BulletList items={requirements} />
            </Section>
          )}

          {skills.length > 0 && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {(workingDays.length > 0 || workingHours) && (
            <Section title="Working schedule">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                {workingDays.length > 0 && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Days</dt>
                    <dd className="text-sm text-[#0a0a0a]">{workingDays.join(', ')}</dd>
                  </div>
                )}
                {workingHours && (
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Hours</dt>
                    <dd className="text-sm text-[#0a0a0a]">{workingHours}</dd>
                  </div>
                )}
              </dl>
            </Section>
          )}

          {details.education && (
            <Section title="Education">
              <p className="text-sm text-[#525252]">{details.education}</p>
            </Section>
          )}

          {benefits.length > 0 && (
            <Section title="Benefits">
              <BulletList items={benefits} />
            </Section>
          )}

          {details.growth_path && (
            <Section title="Growth path">
              <p className="whitespace-pre-line text-sm text-[#525252]">{details.growth_path}</p>
            </Section>
          )}

          {location && (
            <Section title="Location">
              <p className="text-sm text-[#0a0a0a]">
                {[location.label, location.address, location.city, location.region]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              {location.google_maps_url && (
                <a
                  href={location.google_maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
                >
                  Open in Google Maps
                </a>
              )}
            </Section>
          )}
        </div>
      </div>

      <BusinessBrandSection business={profile.business_snapshot} brand={profile.brand_snapshot} />

      <div ref={qnaRef} className="scroll-mt-4">
        <JobQnASection
          jobProfileId={profile.id}
          cardId={recipient?.card_id}
          questions={questions}
          askOpen={askOpen}
          onAskOpenChange={setAskOpen}
        />
      </div>
    </div>
  );
}
