'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, useMyAssignmentCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { FirstItemTip } from '@/components/ui/FirstItemTip';
import { ActionHintTip } from '@/components/ui/ActionHintTip';
import { formatDate } from '@/lib/formatDate';
import ConnectBriefDrawer from '@/components/business/connect-brief/ConnectBriefDrawer';

type Bucket = 'open' | 'active' | 'paused' | 'cancelled';

// Inbox/card glyph used for open, paused and cancelled rows.
const CARD_ICON =
  'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4';
// Check-badge glyph for the Active (assigned) rows.
const CHECK_ICON = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';

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
  return formatDate(date);
}

// Fold the raw card status + lifecycle timestamps into one of four business-
// facing buckets. Order matters: terminal state wins first (a cancelled card
// can still carry a stale paused_at), then paused (a paused card keeps
// status='assigned', so it must be checked before the active/open split).
function classifyCard(card: BusinessSubscriptionCardSummary): Bucket {
  if (card.status === 'archived' || card.cancelled_at || card.recalled_at) return 'cancelled';
  if (card.paused_at) return 'paused';
  if (card.status === 'assigned') return 'active';
  return 'open';
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

const TABS: Array<{ key: Bucket; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'cancelled', label: 'Cancelled' },
];

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
  const [tab, setTab] = useState<Bucket>('open');
  const [briefOpen, setBriefOpen] = useState(false);

  const allCards = cards ?? [];
  const byBucket: Record<Bucket, BusinessSubscriptionCardSummary[]> = { open: [], active: [], paused: [], cancelled: [] };
  for (const c of allCards) byBucket[classifyCard(c)].push(c);
  const visible = byBucket[tab];
  const counts: Record<Bucket, number> = {
    open: byBucket.open.length,
    active: byBucket.active.length,
    paused: byBucket.paused.length,
    cancelled: byBucket.cancelled.length,
  };

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {counts.active} {counts.active === 1 ? noun : nounPlural} active
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              My <span className="text-rainbow">{noun}</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Review and select talents for your {noun} cards.
            </p>
          </div>
          <div className="stagger-3">
            <button
              type="button"
              onClick={() => setBriefOpen(true)}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#0a0a0a]/85 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Request {isAssignment ? 'an assignment' : 'a subscription'}
            </button>
          </div>
        </div>
      </section>

      {/* First-run hint pointing new businesses at the Request button above. */}
      {user?.id && (
        <ActionHintTip
          storageKey={`squadhire:tip:request-${noun}:${user.id}`}
          message={`New here? Use the “Request ${isAssignment ? 'an assignment' : 'a subscription'}” button above to submit ${isAssignment ? 'an assignment' : 'a subscription'} request — tell us what you need and we’ll start matching talent.`}
        />
      )}

      <ConnectBriefDrawer
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        product={variant}
      />

      {/* ── Cards, bucketed into Open / Active / Paused / Cancelled ── */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between border-b border-[#E7E7EA] px-6 py-5">
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
          <TabBar active={tab} onChange={setTab} counts={counts} />
        </div>

        {isLoading ? (
          <div className="space-y-3 px-6 pb-6 pt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState bucket={tab} hasNoCards={allCards.length === 0} noun={noun} />
        ) : (
          <ul className="divide-y divide-[#E7E7EA]">
            {visible.map((card, i) => (
              <CardRow
                key={card.id}
                card={card}
                bucket={tab}
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
  counts,
}: {
  active: Bucket;
  onChange: (tab: Bucket) => void;
  counts: Record<Bucket, number>;
}) {
  return (
    <div className="-mx-6 border-b border-[#E7E7EA] px-6" role="tablist" aria-label="Subscription cards">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <TabButton key={t.key} active={active === t.key} onClick={() => onChange(t.key)} count={counts[t.key]}>
            {t.label}
          </TabButton>
        ))}
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
          active ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#f0f0f0] text-[#737373]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ bucket, hasNoCards, noun }: { bucket: Bucket; hasNoCards: boolean; noun: string }) {
  const copy: Record<Bucket, { heading: string; description: string }> = {
    open: { heading: `No open ${noun}s`, description: `New ${noun} cards published to you will land here.` },
    active: { heading: `No active ${noun}s`, description: 'Cards with a talent assigned and running will land here.' },
    paused: { heading: `No paused ${noun}s`, description: `${noun[0].toUpperCase()}${noun.slice(1)}s put on hold will land here.` },
    cancelled: { heading: `No cancelled ${noun}s`, description: `Cancelled, recalled and closed ${noun}s will land here.` },
  };
  const { heading, description } = hasNoCards
    ? { heading: `No ${noun} cards yet`, description: "Cards will appear here once they're published to your account." }
    : copy[bucket];

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
        <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d={CARD_ICON} />
        </svg>
      </div>
      <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
        {heading}
      </h3>
      <p className="max-w-sm text-sm text-[#737373]">{description}</p>
    </div>
  );
}

function CardRow({
  card,
  bucket,
  index,
  tipSlot,
  detailBase,
}: {
  card: BusinessSubscriptionCardSummary;
  bucket: Bucket;
  index: number;
  tipSlot?: React.ReactNode;
  detailBase: string;
}) {
  const rawPrice = formatPrice(card.customer_monthly_price, card.currency);
  const price = rawPrice && card.is_group ? `from ${rawPrice}` : rawPrice;
  const published = formatPublishedAt(card.published_at);
  const tint = tintFor(card.id);
  const muted = bucket === 'paused' || bucket === 'cancelled';

  const forReview = card.counts.for_review ?? 0;
  const shortlisted = card.counts.shortlisted;
  const selectedCount = card.counts.selected ?? 0;
  const pendingBids = card.counts.pending_bids ?? 0;
  const unreadBadge = (card.counts.new_accepted ?? 0) + pendingBids;

  // Status pill next to the title. Open rows carry no pill unless the card is
  // still a CRM pending brief (status='submitted'); a recalled card in the
  // Cancelled bucket keeps its distinct amber "Recalled" tag.
  const tag =
    card.status === 'submitted'
      ? { label: 'Submitted', cls: 'bg-[#FFFBEB] text-[#B45309]' }
      : bucket === 'active'
        ? { label: 'Assigned', cls: 'bg-[#E7E7EA] text-[#0a0a0a]' }
        : bucket === 'paused'
          ? { label: 'Paused', cls: 'bg-amber-100 text-amber-800' }
          : bucket === 'cancelled'
            ? card.recalled_at && !card.cancelled_at
              ? { label: 'Recalled', cls: 'bg-amber-100 text-amber-800' }
              : { label: 'Cancelled', cls: 'bg-[#F4F4F5] text-[#71717A]' }
            : null;

  // Lead meta: Active rows headline the selected-talent count; everything else
  // leads with the plan/tier subtitle.
  const leadBold = bucket === 'active' && selectedCount > 0;
  const leadText = leadBold
    ? `${selectedCount} talent${selectedCount !== 1 ? 's' : ''} selected`
    : planSubtitle(card);

  return (
    <li className={`relative stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`${detailBase}/${card.id}`}
        className={`group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F5F5F6] ${muted ? 'opacity-70' : ''}`}
      >
        <div
          className={`${tint} flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl`}
          style={{ color: 'var(--tint-icon)' }}
        >
          <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d={bucket === 'active' ? CHECK_ICON : CARD_ICON} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
              {cardTitle(card)}
            </p>
            {unreadBadge > 0 && bucket === 'open' && (
              <span
                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white"
                title={
                  pendingBids > 0 && (card.counts.new_accepted ?? 0) > 0
                    ? `${pendingBids} new bid${pendingBids === 1 ? '' : 's'}, ${card.counts.new_accepted} new acceptance${(card.counts.new_accepted ?? 0) === 1 ? '' : 's'}`
                    : pendingBids > 0
                      ? `${pendingBids} new bid${pendingBids === 1 ? '' : 's'}`
                      : `${card.counts.new_accepted} new`
                }
              >
                {unreadBadge}
              </span>
            )}
            {tag && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tag.cls}`}>
                {tag.label}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {leadText && (
              <span className={leadBold ? 'font-medium text-[#0a0a0a]' : 'text-[#737373]'}>{leadText}</span>
            )}
            {leadText && (price || published) && <span className="text-[#D4D4D8]">·</span>}
            {price && <span className="font-medium text-[#0a0a0a]">{price}</span>}
            {published && (
              <>
                {price && <span className="text-[#D4D4D8]">·</span>}
                <span className="text-[#a3a3a3]">Published {published}</span>
              </>
            )}
          </div>
        </div>

        {bucket === 'open' && (
          <div className="hidden sm:flex flex-shrink-0 items-center gap-2 text-[11px]">
            {pendingBids > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFAC2] px-2 py-0.5 font-medium text-[#0a0a0a]">
                <span>{pendingBids}</span>
                <span className="text-[#737373]">bid{pendingBids === 1 ? '' : 's'}</span>
              </span>
            )}
            {forReview > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                <span>{forReview}</span>
                <span className="text-amber-500">for review</span>
              </span>
            )}
            {shortlisted > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F6] px-2 py-0.5 font-medium text-[#0a0a0a]">
                <span>{shortlisted}</span>
                <span className="text-[#0a0a0a]">shortlisted</span>
              </span>
            )}
          </div>
        )}

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
