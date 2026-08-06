'use client';

import BusinessCardsList from '@/components/business/cards/BusinessCardsList';
import { useHireActivity } from '@/components/business/cards/hireActivity';

/**
 * "My Cards" — the full management list of the business's cards (subscriptions,
 * assignments and job posts) on its own tab, with per-type differentiation.
 * Reuses the same list rows as the Find talent "Your activity" section.
 */
export default function BusinessMyCards() {
  const { items, isLoading, isError } = useHireActivity();

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
        subtitle="Filter by type — subscriptions, assignments, and job posts."
      />
    </div>
  );
}
