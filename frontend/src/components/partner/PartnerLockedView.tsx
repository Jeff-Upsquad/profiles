'use client';

import PartnerApplyPanel from '@/components/partner/PartnerApplyPanel';
import PreviewOpportunityCard from '@/components/partner/PreviewOpportunityCard';
import { useOpportunityPreview } from '@/hooks/usePartnerProgram';

/**
 * Subscriptions / Assignments as a non-partner sees them: the application form
 * on top, then every live broadcast opportunity, anonymised and read-only.
 *
 * This is the whole module for them — there is no accept, bid or negotiate
 * path anywhere in here, and the cards carry no client identity to leak.
 */
export default function PartnerLockedView({
  variant,
  embedded = false,
}: {
  variant: 'subscription' | 'assignment';
  /** Hide the page hero when rendered as a Home tab. */
  embedded?: boolean;
}) {
  const isAssignment = variant === 'assignment';
  const heading = isAssignment ? 'Assignments' : 'Subscriptions';
  const { data, isLoading, isError } = useOpportunityPreview(variant);
  const count = data?.length ?? 0;

  return (
    <div className="space-y-6">
      {!embedded && (
        <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="hero-content">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">Preview only</span>
            </div>
            <h1 className="stagger-2 font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-[#0a0a0a] sm:text-[30px]">
              <span className="text-rainbow">{heading}</span>.
            </h1>
            <p className="stagger-3 mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252]">
              See the live {isAssignment ? 'project briefs' : 'client subscriptions'} running right
              now. Join the Partner Program to take them on.
            </p>
          </div>
        </section>
      )}

      <PartnerApplyPanel variant={variant} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-[-0.015em] text-[#0a0a0a]">
          Live opportunities
          {count > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E7E7EA] px-1.5 text-[11px] font-semibold text-[#525252]">
              {count}
            </span>
          )}
        </h2>
        <p className="font-[family-name:var(--font-inter)] text-xs text-[#737373]">
          Client names and briefs are hidden
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="h-32 animate-pulse rounded-xl bg-[#f0f0f0]" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#f0f0f0]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#f0f0f0]" />
              <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-[#f0f0f0]" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-red-900">
              Could not load {heading.toLowerCase()}
            </h3>
            <p className="mt-0.5 text-sm text-red-700">Please refresh the page to try again.</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && count === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple pointer-events-none absolute inset-0" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              No live {isAssignment ? 'assignments' : 'subscriptions'} right now
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              New briefs come through regularly. Check back soon.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && count > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {data!.map((item) => (
            <PreviewOpportunityCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
