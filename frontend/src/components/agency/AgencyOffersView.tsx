'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import Badge from '@/components/ui/Badge';
import AgencyCardView, { type AgencyCardItem } from '@/components/agency/AgencyCardView';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import { formatOfferAmount } from '@/hooks/useAssignmentOffers';
import { useAgencyCanRespond } from '@/hooks/useAgencyCardActions';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

type TabKey = 'pending' | 'bidding' | 'responded' | 'expired';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'bidding', label: 'Bidding' },
  { key: 'responded', label: 'Responded' },
  { key: 'expired', label: 'Expired' },
];

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

function isTabKey(v: string | null): v is TabKey {
  return v === 'pending' || v === 'bidding' || v === 'responded' || v === 'expired';
}

const OPEN = new Set(['pending_business', 'pending_talent']);

const STATUS_BADGE: Record<string, { label: string; variant: 'yellow' | 'indigo' | 'green' | 'red' | 'gray' }> = {
  pending_business: { label: 'Awaiting business', variant: 'yellow' },
  pending_talent: { label: 'Offer received', variant: 'indigo' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

const ACTION_LABELS: Record<string, string> = {
  submitted: 'submitted an offer',
  countered: 'sent a counter-offer',
  accepted: 'accepted the offer',
  declined: 'declined the offer',
  withdrawn: 'withdrew the offer',
  expired: 'offer expired',
  question_asked: 'asked a question',
  question_answered: 'answered a question',
};

// ─── Bidding tab helpers ─────────────────────────────────────────────────────

function cardDisplayName(o: any): string {
  const content = (o.card_content ?? {}) as Record<string, unknown>;
  const brand = typeof content.brand_name === 'string' ? content.brand_name.trim() : '';
  const title = typeof content.title === 'string' ? content.title.trim() : '';
  const sub = typeof content.subscription_name === 'string' ? content.subscription_name.trim() : '';
  const plan = typeof content.plan_name === 'string' ? content.plan_name.trim() : '';
  if (title) return title;
  const composed = [brand, sub, plan].filter(Boolean).join(' — ');
  if (composed) return composed;
  return o.card_type === 'assignment' ? 'Assignment' : 'Subscription';
}

function BiddingRow({ offer, openId, setOpenId }: { offer: any; openId: string | null; setOpenId: (id: string | null) => void }) {
  const isOpen = openId === offer.id;
  const name = cardDisplayName(offer);
  const tint = tintFor(name);
  const meta = STATUS_BADGE[offer.status] ?? { label: offer.status, variant: 'gray' as const };
  const amount = formatOfferAmount(offer.current_amount) ?? '—';
  const content = (offer.card_content ?? {}) as Record<string, unknown>;
  const sub = [content.subscription_name, content.plan_name].filter(Boolean).join(' · ');
  const bidLabel = offer.status === 'pending_talent' ? 'Business offer' : offer.status === 'pending_business' ? 'Your bid' : 'Latest';

  return (
    <li>
      <button type="button" onClick={() => setOpenId(isOpen ? null : offer.id)} className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#F5F5F6]">
        <div className={`${tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl`} style={{ color: 'var(--tint-icon)' }}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-[family-name:var(--font-jakarta)] truncate text-[14px] font-semibold text-[#0a0a0a]">{name}</p>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          {sub && <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#737373]">{sub}</p>}
          <p className="mt-1 text-sm text-[#0a0a0a]"><span className="text-[#737373]">{bidLabel}:</span> <span className="font-semibold">{amount}</span></p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#525252]">
          {isOpen ? 'Hide' : 'Details'}
          <svg className={`h-4 w-4 text-[#a3a3a3] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-[#E7E7EA] bg-[#F5F5F6] px-5 py-5">
          <div className="rounded-xl bg-white p-4 ring-1 ring-[#E7E7EA]">
            <SubscriptionCardContent content={content as SubscriptionCardContentShape} />
          </div>
          {offer.events?.length > 0 && (
            <ul className="mt-3 divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA] bg-white">
              {offer.events.map((e: any) => (
                <li key={e.id} className="px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-[#0a0a0a]">
                      <span className="font-semibold">{e.actor_type === 'agency' ? 'You' : e.actor_type === 'business' ? 'Business' : e.actor_type === 'admin' ? 'UpSquad' : 'System'}</span>{' '}
                      <span className="text-[#525252]">{ACTION_LABELS[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                    </p>
                    <span className="shrink-0 text-[10px] text-[#a3a3a3]">{new Date(e.created_at).toLocaleDateString()}</span>
                  </div>
                  {e.amount && <p className="mt-0.5 text-[11px] text-[#525252]">Figure: <span className="font-semibold">{formatOfferAmount(e.amount)}</span></p>}
                  {e.note && <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-2.5 py-1.5 text-[11px] text-[#525252]">{e.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AgencyOffersView({
  variant = 'subscription',
  embedded = false,
}: {
  variant?: 'subscription' | 'assignment';
  embedded?: boolean;
}) {
  const isAssignment = variant === 'assignment';
  const heading = isAssignment ? 'Assignments' : 'Subscriptions';
  const [tab, setTab] = useState<TabKey>('pending');
  const qc = useQueryClient();
  const backfillRan = useRef(false);
  const { data: gate } = useAgencyCanRespond();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('tab');
    if (isTabKey(q)) setTab(q);
  }, []);

  const statusParam = tab === 'bidding' ? undefined : tab;
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['agencyCards', variant, statusParam ?? 'all'],
    queryFn: () => {
      const fn = variant === 'assignment' ? agencyApi.assignments : agencyApi.subscriptions;
      return fn(statusParam ?? 'all') as Promise<AgencyCardItem[]>;
    },
  });

  const { data: offerData, isLoading: offersLoading } = useQuery({
    queryKey: ['agencyAllOffers'],
    queryFn: () => agencyApi.allOffers(),
    enabled: tab === 'bidding',
  });

  const filteredCards = cards.filter((c) => {
    const type = c.card.card_type || 'subscription';
    return variant === 'assignment' ? type === 'assignment' : type !== 'assignment';
  });

  const pendingCount = cards.filter((c) => c.status === 'pending' && !c.cancelled_at).length;
  const allOffers = (offerData?.offers ?? []).filter((o: any) => {
    const t = o.card_type === 'assignment' ? 'assignment' : 'subscription';
    return variant === 'assignment' ? t === 'assignment' : t !== 'assignment';
  });
  const biddingCount = allOffers.filter((o: any) => OPEN.has(o.status)).length;

  // Auto-backfill on first empty load
  useEffect(() => {
    if (!isLoading && filteredCards.length === 0 && tab !== 'bidding' && !backfillRan.current) {
      backfillRan.current = true;
      agencyApi.backfillCards().then(() => qc.invalidateQueries({ queryKey: ['agencyCards'] })).catch(() => {});
    }
  }, [isLoading, filteredCards.length, tab, qc]);

  return (
    <div className="space-y-6">
      {!embedded && (
        <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2.5 stagger-1">
                <span className="eyebrow-rainbow">{pendingCount > 0 ? `${pendingCount} pending offer${pendingCount === 1 ? '' : 's'}` : 'No pending offers'}</span>
              </div>
              <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
                <span className="text-rainbow">{heading}</span>.
              </h1>
              <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
                {isAssignment ? 'One-off project briefs matched to your agency. Accept or decline each one.' : 'Offers pushed to you based on your profile. Accept or decline each one.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Tab Control */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#F5F5F6] p-1.5 border border-[#E7E7EA]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count = t.key === 'pending' ? pendingCount : t.key === 'bidding' ? biddingCount : null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className={`font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${isActive ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]' : 'text-[#525252] hover:text-[#0a0a0a]'}`}>
              {t.label}
              {count !== null && count > 0 && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${isActive ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#E7E7EA] text-[#525252]'}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="h-32 animate-pulse rounded-xl bg-[#f0f0f0]" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#f0f0f0]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#f0f0f0]" />
            </div>
          ))}
        </div>
      )}

      {tab === 'pending' && !isLoading && filteredCards.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" /></svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No offers right now</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">We&apos;ll notify you when a business sends an offer.</p>
          </div>
        </div>
      )}

      {tab === 'pending' && !isLoading && filteredCards.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {filteredCards.map((item, i) => (
            <div key={item.id} className={`stagger-${Math.min(i + 1, 6)}`}>
              <AgencyCardView item={item} />
            </div>
          ))}
        </div>
      )}

      {/* Bidding tab */}
      {tab === 'bidding' && offersLoading && (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#f0f0f0]" />)}</div>
      )}

      {tab === 'bidding' && !offersLoading && allOffers.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No bids yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">When you bid on a card or a business sends you an offer, it will show up here.</p>
          </div>
        </div>
      )}

      {tab === 'bidding' && !offersLoading && allOffers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <ul className="divide-y divide-[#E7E7EA]">
            {allOffers.map((offer: any) => (
              <BiddingRow key={offer.id} offer={offer} openId={null} setOpenId={() => {}} />
            ))}
          </ul>
        </div>
      )}

      {/* Responded tab */}
      {tab === 'responded' && !isLoading && filteredCards.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No responses yet</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">Offers you accept or decline will show up here.</p>
          </div>
        </div>
      )}

      {tab === 'responded' && !isLoading && filteredCards.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {filteredCards.map((item) => (
            <AgencyCardView key={item.id} item={item} />
          ))}
        </div>
      )}

      {/* Expired tab */}
      {tab === 'expired' && !isLoading && filteredCards.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">No expired offers</h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">Offers that closed before you responded will show up here.</p>
          </div>
        </div>
      )}

      {tab === 'expired' && !isLoading && filteredCards.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {filteredCards.map((item) => (
            <AgencyCardView key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
