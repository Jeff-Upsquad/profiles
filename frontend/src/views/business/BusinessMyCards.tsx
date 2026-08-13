'use client';

import { useState } from 'react';
import BusinessCardsList from '@/components/business/cards/BusinessCardsList';
import { useHireActivity, useHasAssignedCard } from '@/components/business/cards/hireActivity';
import HowItWorksContent from '@/components/business/HowItWorksContent';

/**
 * "My Cards" — the full management list of the business's cards (subscriptions,
 * assignments and job posts) on its own tab, with per-type differentiation.
 * Reuses the same list rows as the Find talent "Your activity" section.
 *
 * Once the business has its first assigned card, the bottom-nav "How it works"
 * tab is replaced by the SquadHub tab — so the guide moves here as a
 * collapsible section rather than disappearing.
 */
export default function BusinessMyCards() {
  const { items, isLoading, isError } = useHireActivity();
  const { hasAssignedCard } = useHasAssignedCard();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] font-semibold tracking-[-0.025em] text-[#0a0a0a] sm:text-[24px]">
          My Cards
        </h1>
        <p className="mt-1 text-sm text-[#737373]">
          Every subscription, assignment, and job post you&rsquo;ve created.
        </p>
      </div>

      <BusinessCardsList
        items={items}
        isLoading={isLoading}
        isError={isError}
        title="All cards"
        subtitle="Filter by status — submitted, open, active, cancelled, and more."
      />

      {hasAssignedCard && (
        <section className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((v) => !v)}
            aria-expanded={guideOpen}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA] sm:px-6"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFFAC2]">
                <svg className="h-4.5 w-4.5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                  How it works
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[#737373]">
                  Watch the walkthrough and learn what Squad Hire and Squad Hub each do.
                </span>
              </span>
            </span>
            <svg
              className={`h-4 w-4 flex-shrink-0 text-[#737373] transition-transform ${guideOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {guideOpen && (
            <div className="border-t border-[#E7E7EA] px-5 py-5 sm:px-6 sm:py-6">
              <HowItWorksContent variant="embedded" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
