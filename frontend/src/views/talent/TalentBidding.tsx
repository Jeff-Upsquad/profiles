'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import {
  useTalentCardOffers,
  formatOfferAmount,
  type TalentCardOffer,
} from '@/hooks/useAssignmentOffers';

const STATUS: Record<string, { label: string; variant: 'yellow' | 'indigo' | 'green' | 'red' | 'gray' }> = {
  pending_business: { label: 'Awaiting business', variant: 'yellow' },
  pending_talent: { label: 'Offer received', variant: 'indigo' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

function hrefFor(o: TalentCardOffer): string {
  return o.card_type === 'assignment' ? '/talent/assignments' : '/talent/subscriptions';
}

export default function TalentBidding() {
  const { data: offers, isLoading, error } = useTalentCardOffers();
  const list = offers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold text-[#0a0a0a]">
          Bidding
        </h1>
        <p className="mt-1 text-sm text-[#737373]">
          Your bids and business offers on subscription and assignment cards.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#f0f0f0]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">
          Could not load your bids. Please try again.
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0a0a0a]">No bids yet</p>
          <p className="mt-1 text-sm text-[#737373]">
            When you bid on a card or a business sends you an offer, it will show up here.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/talent/subscriptions" className="text-sm font-semibold text-[#0a0a0a] underline underline-offset-2">
              Subscriptions
            </Link>
            <Link href="/talent/assignments" className="text-sm font-semibold text-[#0a0a0a] underline underline-offset-2">
              Assignments
            </Link>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA] overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {list.map((o) => {
            const meta = STATUS[o.status] ?? { label: o.status, variant: 'gray' as const };
            const typeLabel = o.card_type === 'assignment' ? 'Assignment' : 'Subscription';
            return (
              <li key={o.id}>
                <Link
                  href={hrefFor(o)}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAFA]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                        {o.brand_name || o.card_title || 'Card'}
                      </p>
                      <span className="rounded-full bg-[#F1F1F3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                        {typeLabel}
                      </span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#0a0a0a]">
                      <span className="text-[#737373]">
                        {o.status === 'pending_talent'
                          ? 'They offered'
                          : o.status === 'pending_business'
                            ? 'Your bid'
                            : 'Latest'}
                        :
                      </span>{' '}
                      <span className="font-semibold">{formatOfferAmount(o.current_amount) ?? '—'}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#525252]">
                    Open →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
