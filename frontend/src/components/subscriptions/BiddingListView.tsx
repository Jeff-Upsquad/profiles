'use client';

import { useMemo, useState } from 'react';
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
  const sub = typeof content.subscription_name === 'string' ? content.subscription_name.trim() : '';
  const plan = typeof content.plan_name === 'string' ? content.plan_name.trim() : '';
  // Prefer the full "Brand — Role — Plan" title when present (matches card body).
  if (title) return title;
  const composed = [brand || o.brand_name, sub, plan].filter(Boolean).join(' — ');
  if (composed) return composed;
  return (
    (typeof o.brand_name === 'string' ? o.brand_name.trim() : '') ||
    (typeof o.card_title === 'string' ? o.card_title.trim() : '') ||
    (o.card_type === 'assignment' ? 'Assignment' : 'Subscription')
  );
}

function cardSubheading(o: TalentCardOffer): string {
  const content = (o.card_content ?? {}) as Record<string, unknown>;
  const sub = typeof content.subscription_name === 'string' ? content.subscription_name.trim() : '';
  const plan = typeof content.plan_name === 'string' ? content.plan_name.trim() : '';
  return [sub, plan].filter(Boolean).join(' · ');
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

function bidLabelFor(status: string): string {
  if (status === 'pending_talent') return 'They offered';
  if (status === 'pending_business') return 'Your bid';
  return 'Latest';
}

function BiddingRow({
  offer,
  cardType,
  isOpen,
  onToggle,
  emphasize = false,
}: {
  offer: TalentCardOffer;
  cardType: 'subscription' | 'assignment';
  isOpen: boolean;
  onToggle: () => void;
  emphasize?: boolean;
}) {
  const name = cardDisplayName(offer);
  const sub = cardSubheading(offer);
  const tint = tintFor(name);
  const meta = STATUS[offer.status] ?? { label: offer.status, variant: 'gray' as const };
  const item = itemFromOffer(offer);
  const amount = formatOfferAmount(offer.current_amount) ?? '—';
  const isAssignment = cardType === 'assignment';
  const currency =
    (typeof offer.current_amount?.currency === 'string' && offer.current_amount.currency) ||
    (typeof item.card.content.currency === 'string' ? item.card.content.currency : undefined);

  return (
    <li className={emphasize ? 'bg-indigo-50/40' : undefined}>
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#F5F5F6]"
      >
        <div
          className={`${tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl`}
          style={{ color: 'var(--tint-icon)' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-[family-name:var(--font-jakarta)] truncate text-[14px] font-semibold text-[#0a0a0a]">
              {name}
            </p>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          {sub && (
            <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#737373]">
              {sub}
            </p>
          )}
          <p className="mt-1 text-sm text-[#0a0a0a]">
            <span className="text-[#737373]">{bidLabelFor(offer.status)}:</span>{' '}
            <span className="font-semibold">{amount}</span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#525252]">
          {isOpen ? 'Hide details' : 'Details'}
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

      {/* Toggle: full original card body + bid actions */}
      {isOpen && (
        <div className="border-t border-[#E7E7EA] bg-[#F5F5F6] px-5 py-5 space-y-4">
          {/* Bid summary strip (always visible above card details) */}
          {offer.status === 'pending_talent' ? (
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
            <div className="rounded-xl bg-white px-3.5 py-3 ring-1 ring-[#E7E7EA]">
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
          )}

          {/* Full card details under the toggle */}
          <div className="rounded-xl bg-white p-4 ring-1 ring-[#E7E7EA]">
            <SubscriptionCardContent content={item.card.content} />
          </div>

          <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-[#E7E7EA]">
            <AssignmentOfferActions
              item={item}
              currency={currency}
              bidLabel={!isAssignment}
              hideAmountSummary
            />
          </div>
        </div>
      )}
    </li>
  );
}

function OfferList({
  offers,
  cardType,
  openId,
  setOpenId,
  emphasize = false,
}: {
  offers: TalentCardOffer[];
  cardType: 'subscription' | 'assignment';
  openId: string | null;
  setOpenId: (id: string | null) => void;
  emphasize?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <ul className="divide-y divide-[#E7E7EA]">
        {offers.map((o) => (
          <BiddingRow
            key={o.id}
            offer={o}
            cardType={cardType}
            isOpen={openId === o.id}
            onToggle={() => setOpenId(openId === o.id ? null : o.id)}
            emphasize={emphasize}
          />
        ))}
      </ul>
    </div>
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
  const [openId, setOpenId] = useState<string | null>(null);

  const { businessOffers, yourBids, closed } = useMemo(() => {
    const all = (offers ?? []).filter((o) => {
      const t = o.card_type === 'assignment' ? 'assignment' : 'subscription';
      return t === cardType;
    });
    const businessOffers = all.filter((o) => o.status === 'pending_talent');
    const yourBids = all.filter((o) => o.status === 'pending_business');
    const closed = all.filter(
      (o) => o.status !== 'pending_talent' && o.status !== 'pending_business',
    );
    return { businessOffers, yourBids, closed };
  }, [offers, cardType]);

  const total = businessOffers.length + yourBids.length + closed.length;

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
          subtitle="Business sent a figure — open a row to counter, accept, or decline."
        >
          <OfferList
            offers={businessOffers}
            cardType={cardType}
            openId={openId}
            setOpenId={setOpenId}
            emphasize
          />
        </Section>
      )}

      {yourBids.length > 0 && (
        <Section
          title="Your bids"
          subtitle="Waiting on the business. Open a row for full card details and actions."
        >
          <OfferList
            offers={yourBids}
            cardType={cardType}
            openId={openId}
            setOpenId={setOpenId}
          />
        </Section>
      )}

      {closed.length > 0 && (
        <Section title="Closed" subtitle="Accepted, declined, withdrawn, or expired negotiations.">
          <OfferList
            offers={closed}
            cardType={cardType}
            openId={openId}
            setOpenId={setOpenId}
          />
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
