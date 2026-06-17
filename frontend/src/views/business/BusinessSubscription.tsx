'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, useMyAssignmentCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { FirstItemTip } from '@/components/ui/FirstItemTip';

type Tab = 'open' | 'closed';

function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

function formatPublishedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfPublished = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.floor((startOfToday - startOfPublished) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function classifyCard(card: BusinessSubscriptionCardSummary): 'assigned' | 'live' | 'recalled' | 'closed' {
  if (card.status === 'assigned') return 'assigned';
  if (card.status === 'active') return 'live';
  if (card.recalled_at) return 'recalled';
  return 'closed';
}

function cardTitle(card: BusinessSubscriptionCardSummary): string {
  const left = card.brand_name || 'Untitled';
  const right = card.subscription_name;
  return right ? `${left} · ${right}` : left;
}

function planSubtitle(card: BusinessSubscriptionCardSummary): string | null {
  const { plan_name, plan_tier } = card;
  // Multi-tier brief: list all of its tiers instead of a single one.
  const tiers = card.tiers ?? [];
  if (card.is_group && tiers.length > 0) {
    return plan_name ? `${plan_name} · ${tiers.join(' · ')}` : tiers.join(' · ');
  }
  if (plan_name && plan_tier) return `${plan_name} · ${plan_tier}`;
  if (plan_name) return plan_name;
  if (plan_tier) return `${plan_tier} tier`;
  return null;
}

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function BusinessSubscription({
  variant = 'subscription',
}: {
  variant?: 'subscription' | 'assignment';
} = {}) {
  const { user } = useAuth();
  const isAssignment = variant === 'assignment';
  const noun = isAssignment ? 'assignment' : 'subscription';
  const nounPlural = isAssignment ? 'assignments' : 'subscriptions';
  const Noun = isAssignment ? 'Assignment' : 'Subscription';
  // Only the active variant's query fetches (the other is disabled), so the
  // page that isn't shown doesn't fire a request.
  const subQuery = useMySubscriptionCards(!isAssignment);
  const asgQuery = useMyAssignmentCards(isAssignment);
  const { data: cards, isLoading } = isAssignment ? asgQuery : subQuery;
  // Card detail/review reuses one component, but assignments get their own
  // route so the URL + back-nav read "assignments", not "subscription".
  const detailBase = isAssignment ? '/business/assignments' : '/business/subscription';
  const [tab, setTab] = useState<Tab>('open');

  const allCards = cards ?? [];
  const assigned = allCards.filter((c) => classifyCard(c) === 'assigned');
  const open = allCards.filter((c) => classifyCard(c) === 'live');
  const closed = allCards.filter((c) => classifyCard(c) === 'recalled' || classifyCard(c) === 'closed');
  const visible = tab === 'open' ? open : closed;

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {open.length} {open.length === 1 ? noun : nounPlural} active
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              My <span className="text-rainbow">{noun}</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Review and select talents for your {noun} cards.
            </p>
          </div>
        </div>
      </section>

      {/* ── Active Subscriptions (Assigned) ── */}
      {assigned.length > 0 && (
        <div className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] px-6 py-5">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Active {Noun}s
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">
                Talents have been assigned to these cards.
              </p>
            </div>
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
              {assigned.length}
            </span>
          </div>
          <ul className="divide-y divide-[#E8E5DE]">
            {assigned.map((card, i) => (
              <AssignedCardRow key={card.id} card={card} index={i} detailBase={detailBase} />
            ))}
          </ul>
        </div>
      )}

      {/* ── Cards list ── */}
      <div className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-[#E8E5DE] px-6 py-5">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              {Noun} Cards
            </h2>
            <p className="mt-0.5 text-sm text-[#737373]">
              Tap a card to review and shortlist talents.
            </p>
          </div>
        </div>

        <div className="px-6 pt-4">
          <TabBar active={tab} onChange={setTab} openCount={open.length} closedCount={closed.length} />
        </div>

        {isLoading ? (
          <div className="space-y-3 px-6 pb-6 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState tab={tab} hasNoCards={allCards.length === 0} noun={noun} />
        ) : (
          <ul className="divide-y divide-[#E8E5DE]">
            {visible.map((card, i) => (
              <CardRow
                key={card.id}
                card={card}
                muted={tab === 'closed'}
                index={i}
                detailBase={detailBase}
                tipSlot={
                  i === 0 && tab === 'open' && user?.id ? (
                    <FirstItemTip
                      storageKey={`squadhire:tip:subscription-card:${user.id}`}
                      message="Tap any subscription card to view available candidates and shortlist them."
                    />
                  ) : null
                }
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TabBar({
  active,
  onChange,
  openCount,
  closedCount,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
  openCount: number;
  closedCount: number;
}) {
  return (
    <div className="-mx-6 border-b border-[#E8E5DE] px-6" role="tablist" aria-label="Subscription cards">
      <div className="flex gap-1 overflow-x-auto">
        <TabButton active={active === 'open'} onClick={() => onChange('open')} count={openCount}>
          Open
        </TabButton>
        <TabButton active={active === 'closed'} onClick={() => onChange('closed')} count={closedCount}>
          Closed
        </TabButton>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
        active
          ? 'border-b-2 border-[#0a0a0a] text-[#0a0a0a]'
          : 'border-b-2 border-transparent text-[#737373] hover:text-[#0a0a0a]'
      }`}
    >
      <span>{children}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-[#F2FCBC] text-[#0a0a0a]' : 'bg-[#f0f0f0] text-[#737373]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ tab, hasNoCards, noun = 'subscription' }: { tab: Tab; hasNoCards: boolean; noun?: string }) {
  const heading = hasNoCards
    ? `No ${noun} cards yet`
    : tab === 'open'
      ? 'No open cards'
      : 'No closed cards yet';
  const description = hasNoCards
    ? "Cards will appear here once they're published to your account."
    : tab === 'open'
      ? `All your active ${noun}s will land here.`
      : 'Finished hires and archived cards will land here.';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2FCBC]">
        <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
        </svg>
      </div>
      <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
        {heading}
      </h3>
      <p className="max-w-sm text-sm text-[#737373]">{description}</p>
    </div>
  );
}

function AssignedCardRow({ card, index, detailBase }: { card: BusinessSubscriptionCardSummary; index: number; detailBase: string }) {
  const rawPrice = formatPrice(card.customer_monthly_price, card.currency);
  const price = rawPrice && card.is_group ? `from ${rawPrice}` : rawPrice;
  const published = formatPublishedAt(card.published_at);
  const tint = tintFor(card.id);
  const selectedCount = card.counts.selected ?? 0;

  return (
    <li className={`stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`${detailBase}/${card.id}`}
        className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F7F6F3]"
      >
        <div
          className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
          style={{ color: 'var(--tint-icon)' }}
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
              {cardTitle(card)}
            </p>
            <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              Assigned
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {selectedCount > 0 && (
              <span className="font-medium text-sky-700">
                {selectedCount} talent{selectedCount !== 1 ? 's' : ''} selected
              </span>
            )}
            {selectedCount > 0 && (price || published) && (
              <span className="text-[#D4D4D8]">&middot;</span>
            )}
            {price && <span className="font-medium text-[#0a0a0a]">{price}</span>}
            {published && (
              <>
                {price && <span className="text-[#D4D4D8]">&middot;</span>}
                <span className="text-[#a3a3a3]">Published {published}</span>
              </>
            )}
          </div>
        </div>

        <svg
          className="h-4 w-4 flex-shrink-0 text-[#a3a3a3] opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.25}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}

function CardRow({
  card,
  muted,
  index,
  tipSlot,
  detailBase,
}: {
  card: BusinessSubscriptionCardSummary;
  muted: boolean;
  index: number;
  tipSlot?: React.ReactNode;
  detailBase: string;
}) {
  const rawPrice = formatPrice(card.customer_monthly_price, card.currency);
  const price = rawPrice && card.is_group ? `from ${rawPrice}` : rawPrice;
  const published = formatPublishedAt(card.published_at);
  const forReview = card.counts.for_review ?? 0;
  const shortlisted = card.counts.shortlisted;
  const isRecalled = classifyCard(card) === 'recalled';
  const tint = tintFor(card.id);

  return (
    <li className={`relative stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`${detailBase}/${card.id}`}
        className={`group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F7F6F3] ${
          muted ? 'opacity-70' : ''
        }`}
      >
        <div
          className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
          style={{ color: 'var(--tint-icon)' }}
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
              {cardTitle(card)}
            </p>
            {isRecalled && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Recalled
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {planSubtitle(card) && (
              <span className="text-[#737373]">{planSubtitle(card)}</span>
            )}
            {planSubtitle(card) && (price || published) && (
              <span className="text-[#D4D4D8]">·</span>
            )}
            {price && <span className="font-medium text-[#0a0a0a]">{price}</span>}
            {published && (
              <>
                {price && <span className="text-[#D4D4D8]">·</span>}
                <span className="text-[#a3a3a3]">Published {published}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-shrink-0 items-center gap-2 text-[11px]">
          {forReview > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
              <span>{forReview}</span>
              <span className="text-amber-500">for review</span>
            </span>
          )}
          {shortlisted > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
              <span>{shortlisted}</span>
              <span className="text-indigo-500">shortlisted</span>
            </span>
          )}
        </div>

        <svg
          className="h-4 w-4 flex-shrink-0 text-[#a3a3a3] opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.25}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
      {tipSlot}
    </li>
  );
}
