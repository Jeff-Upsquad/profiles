'use client';

import { useMemo } from 'react';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import AssignmentOfferActions from '@/components/subscriptions/AssignmentOfferActions';
import {
  useTalentCardOffers,
  formatOfferAmount,
  type TalentCardOffer,
} from '@/hooks/useAssignmentOffers';
import type {
  SubscriptionCardContentShape,
  SubscriptionCardItem,
} from '@/hooks/useSubscriptionCards';

const STATUS: Record<string, { label: string; variant: 'yellow' | 'indigo' | 'green' | 'red' | 'gray' }> = {
  pending_business: { label: 'Awaiting business', variant: 'yellow' },
  pending_talent: { label: 'Offer received', variant: 'indigo' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

const OPEN = new Set(['pending_business', 'pending_talent']);

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

/** Same display name as Pending / original card header. */
function cardDisplayName(o: TalentCardOffer): string {
  const content = (o.card_content ?? {}) as Record<string, unknown>;
  const brand = typeof content.brand_name === 'string' ? content.brand_name.trim() : '';
  const title = typeof content.title === 'string' ? content.title.trim() : '';
  return (
    brand ||
    title ||
    (typeof o.brand_name === 'string' ? o.brand_name.trim() : '') ||
    (typeof o.card_title === 'string' ? o.card_title.trim() : '') ||
    (o.card_type === 'assignment' ? 'Assignment' : 'Subscription')
  );
}

function itemFromOffer(o: TalentCardOffer): SubscriptionCardItem {
  const cardType = (o.card_type === 'assignment' ? 'assignment' : 'subscription') as
    | 'subscription'
    | 'assignment';
  const content = {
    ...((o.card_content ?? {}) as SubscriptionCardContentShape),
    card_type: cardType,
  };
  const status =
    o.card_status === 'assigned' || o.card_status === 'archived' ? o.card_status : 'active';
  return {
    id: o.recipient_id,
    status: 'accepted',
    responded_at: o.responded_at,
    cancelled_at: null,
    selected_at: null,
    passed_over_at: null,
    card: {
      id: o.card_id,
      external_id: o.card_external_id ?? '',
      content,
      status,
      published_at: o.card_published_at ?? o.created_at,
      expires_at: o.card_expires_at ?? o.expires_on,
      card_type: cardType,
    },
  };
}

function BiddingCard({
  offer,
  cardType,
  emphasizeBusinessOffer = false,
}: {
  offer: TalentCardOffer;
  cardType: 'subscription' | 'assignment';
  emphasizeBusinessOffer?: boolean;
}) {
  const name = cardDisplayName(offer);
  const tint = tintFor(name);
  const meta = STATUS[offer.status] ?? { label: offer.status, variant: 'gray' as const };
  const item = itemFromOffer(offer);
  const amount = formatOfferAmount(offer.current_amount) ?? '—';
  const isAssignment = cardType === 'assignment';
  const typeLabel = isAssignment ? 'Assignment' : 'Subscription';
  const currency =
    (typeof offer.current_amount?.currency === 'string' && offer.current_amount.currency) ||
    (typeof item.card.content.currency === 'string' ? item.card.content.currency : undefined);
  const isOpen = OPEN.has(offer.status);

  const bidBanner =
    offer.status === 'pending_talent' ? (
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">
          Business offer
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
          {amount}
        </p>
        <p className="mt-0.5 text-xs text-indigo-800">
          Counter, accept, or decline this offer.
        </p>
      </div>
    ) : offer.status === 'pending_business' ? (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
          Your bid
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
          {amount}
        </p>
        <p className="mt-0.5 text-xs text-amber-900">Waiting for the business to respond.</p>
      </div>
    ) : (
      <div className="rounded-xl bg-[#F5F5F6] px-3.5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
          Latest figure
        </p>
        <p className="mt-0.5 font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
          {amount}
        </p>
        <div className="mt-1.5">
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
      </div>
    );

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 ${
        emphasizeBusinessOffer ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-[#E7E7EA]'
      }`}
    >
      {/* Same tinted header as original pending cards */}
      <div className={`${tint} relative h-20 px-5 flex items-center overflow-hidden`}>
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex w-full items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
            style={{ color: 'var(--tint-icon)' }}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--tint-icon)' }}
            >
              {offer.status === 'pending_talent' ? 'New business offer' : 'Bidding'}
            </p>
            <p
              className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a] truncate"
              style={{ maxWidth: '14rem' }}
            >
              {name}
            </p>
          </div>
          <div className="relative ml-auto flex shrink-0 flex-col items-end gap-1 self-start">
            <span
              className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm"
              style={{ color: 'var(--tint-icon)' }}
            >
              {typeLabel}
            </span>
            {isOpen && <Badge variant={meta.variant}>{meta.label}</Badge>}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Bid / offer details always on top */}
        {bidBanner}

        {/* Full original card details */}
        <SubscriptionCardContent content={item.card.content} />

        {/* Actions — amount already shown in banner above */}
        <AssignmentOfferActions
          item={item}
          currency={currency}
          bidLabel={!isAssignment}
          hideAmountSummary
        />
      </div>
    </article>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-[#737373]">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function BiddingListView({
  cardType,
}: {
  cardType: 'subscription' | 'assignment';
}) {
  const { data: offers, isLoading, error } = useTalentCardOffers();

  const { businessOffers, yourBids, closed } = useMemo(() => {
    const all = (offers ?? []).filter((o) => {
      const t = o.card_type === 'assignment' ? 'assignment' : 'subscription';
      return t === cardType;
    });
    // New business offers need talent action — pin to top as their own section.
    const businessOffers = all.filter((o) => o.status === 'pending_talent');
    // Talent-led open bids still awaiting the business.
    const yourBids = all.filter((o) => o.status === 'pending_business');
    // Terminal / settled negotiations.
    const closed = all.filter(
      (o) => o.status !== 'pending_talent' && o.status !== 'pending_business',
    );
    return { businessOffers, yourBids, closed };
  }, [offers, cardType]);

  const total = businessOffers.length + yourBids.length + closed.length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="h-20 animate-pulse rounded-xl bg-[#f0f0f0]" />
            <div className="mt-4 h-16 animate-pulse rounded-xl bg-[#f0f0f0]" />
            <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#f0f0f0]" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#f0f0f0]" />
          </div>
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

  if (total === 0) {
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
    <div className="space-y-8">
      {businessOffers.length > 0 && (
        <Section
          title="New offers for you"
          subtitle="Business sent a figure — counter, accept, or decline."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {businessOffers.map((o) => (
              <BiddingCard
                key={o.id}
                offer={o}
                cardType={cardType}
                emphasizeBusinessOffer
              />
            ))}
          </div>
        </Section>
      )}

      {yourBids.length > 0 && (
        <Section
          title="Your bids"
          subtitle="Waiting on the business to respond to your figure."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {yourBids.map((o) => (
              <BiddingCard key={o.id} offer={o} cardType={cardType} />
            ))}
          </div>
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Closed" subtitle="Accepted, declined, withdrawn, or expired negotiations.">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {closed.map((o) => (
              <BiddingCard key={o.id} offer={o} cardType={cardType} />
            ))}
          </div>
        </Section>
      )}
    </div>
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
