'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import AssignmentOfferActions from '@/components/subscriptions/AssignmentOfferActions';
import {
  useTalentCardOffers,
  formatOfferAmount,
  type TalentCardOffer,
} from '@/hooks/useAssignmentOffers';
import type { SubscriptionCardItem } from '@/hooks/useSubscriptionCards';

const STATUS: Record<string, { label: string; variant: 'yellow' | 'indigo' | 'green' | 'red' | 'gray' }> = {
  pending_business: { label: 'Awaiting business', variant: 'yellow' },
  pending_talent: { label: 'Offer received', variant: 'indigo' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

const OPEN = new Set(['pending_business', 'pending_talent']);

/** Minimal card item so AssignmentOfferActions can drive bid/accept/counter. */
function itemFromOffer(o: TalentCardOffer): SubscriptionCardItem {
  const cardType = (o.card_type === 'assignment' ? 'assignment' : 'subscription') as
    | 'subscription'
    | 'assignment';
  return {
    id: o.recipient_id,
    status: 'accepted',
    responded_at: o.responded_at,
    cancelled_at: null,
    selected_at: null,
    passed_over_at: null,
    card: {
      id: o.card_id,
      external_id: '',
      content: {
        brand_name: o.brand_name ?? undefined,
        title: o.card_title ?? undefined,
        card_type: cardType,
      },
      status: 'active',
      published_at: o.created_at,
      expires_at: o.expires_on,
      card_type: cardType,
    },
  };
}

export default function BiddingListView({
  cardType,
}: {
  cardType: 'subscription' | 'assignment';
}) {
  const { data: offers, isLoading, error } = useTalentCardOffers();
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const all = offers ?? [];
    return all.filter((o) => {
      const t = o.card_type === 'assignment' ? 'assignment' : 'subscription';
      return t === cardType;
    });
  }, [offers, cardType]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-700">
        Could not load your bids. Please try again.
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
        <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
            <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
            No bids yet
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
            When you bid on a {cardType === 'assignment' ? 'assignment' : 'subscription'} or a business
            sends you an offer, it will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#E7E7EA] overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {list.map((o) => {
        const meta = STATUS[o.status] ?? { label: o.status, variant: 'gray' as const };
        const isOpen = openId === o.id;
        const isActive = OPEN.has(o.status);
        return (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : o.id)}
              className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                    {o.brand_name || o.card_title || 'Card'}
                  </p>
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
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#525252]">
                {isActive ? 'Manage' : 'Details'}
                <svg
                  className={`h-4 w-4 text-[#a3a3a3] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="border-t border-[#E7E7EA] bg-[#F5F5F6] px-5 py-4">
                <AssignmentOfferActions
                  item={itemFromOffer(o)}
                  bidLabel={cardType === 'subscription'}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Open (active) bid count for a card type — used as the Bidding tab badge. */
export function useBiddingCount(cardType: 'subscription' | 'assignment') {
  const { data: offers } = useTalentCardOffers();
  return useMemo(() => {
    const all = offers ?? [];
    return all.filter((o) => {
      const t = o.card_type === 'assignment' ? 'assignment' : 'subscription';
      return t === cardType && OPEN.has(o.status);
    }).length;
  }, [offers, cardType]);
}
