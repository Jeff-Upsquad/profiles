'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { FirstItemTip } from '@/components/ui/FirstItemTip';

interface StatTile {
  label: string;
  value: number;
  hint: string;
  tint: string;
  icon: React.ReactNode;
}

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

function classifyCard(card: BusinessSubscriptionCardSummary): 'open' | 'active' | 'paused' | 'cancelled' {
  // Same four buckets as the My-subscription page. Terminal wins first, then
  // paused (an assigned card keeps status='assigned'), then the active/open split.
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

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: cards, isLoading } = useMySubscriptionCards();

  const allCards = cards ?? [];
  // "Open" here means genuinely open — published/broadcast/selected cards
  // awaiting review. Assigned (Active), Paused and Cancelled cards live on the
  // My-subscription page, not this homepage list.
  const open = allCards.filter((c) => classifyCard(c) === 'open');
  const closed = allCards.filter((c) => classifyCard(c) === 'cancelled');

  const totals = allCards.reduce(
    (acc, c) => ({
      accepted: acc.accepted + (c.counts?.accepted ?? 0),
      shortlisted: acc.shortlisted + (c.counts?.shortlisted ?? 0),
    }),
    { accepted: 0, shortlisted: 0 },
  );

  const companyName = user?.company_name ?? '';
  const firstWord = companyName.split(' ')[0] ?? '';

  const tiles: StatTile[] = [
    {
      label: 'Open Cards',
      value: open.length,
      hint: 'active subscriptions',
      tint: 'tint-purple',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
        </svg>
      ),
    },
    {
      label: 'Accepted',
      value: totals.accepted,
      hint: 'talents onboarded',
      tint: 'tint-green',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Shortlisted',
      value: totals.shortlisted,
      hint: 'in your saved list',
      tint: 'tint-blue',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      label: 'Closed',
      value: closed.length,
      hint: 'archived cards',
      tint: 'tint-amber',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 stagger-1">
              <span className="eyebrow-rainbow">Business Workspace</span>
              {open.length > 0 && <span className="pill-live">Live</span>}
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Welcome back{firstWord ? <>, <span className="text-rainbow">{firstWord}</span></> : ''}.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Track your subscriptions, review talents, and manage your shortlists.
            </p>
          </div>

        </div>
      </section>

      {/* ── Stat Cards ── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <div key={tile.label} className={`stat-card ${tile.tint} stagger-${i + 1}`}>
              <div className="flex items-start justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 backdrop-blur-sm"
                  style={{ color: 'var(--tint-icon)' }}
                >
                  {tile.icon}
                </div>
              </div>
              <div className="mt-6">
                <p
                  className="font-[family-name:var(--font-jakarta)] text-[44px] leading-none font-semibold tracking-[-0.035em]"
                  style={{ color: 'var(--tint-text)' }}
                >
                  {tile.value}
                </p>
                <p className="mt-3 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-[#0a0a0a]">
                  {tile.label}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#525252]">
                  {tile.hint}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Two-column: Subscription Cards + Quick Actions ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Subscription cards — main column */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#E7E7EA] px-6 py-5">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                Open Subscription Cards
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">
                Cards published to your account by SquadHub
              </p>
            </div>
            {open.length > 0 && (
              <span className="rounded-full bg-[#E7E7EA] px-2.5 py-1 text-xs font-semibold text-[#0a0a0a]">
                {open.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3 px-6 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-[#f0f0f0]" />
              ))}
            </div>
          ) : open.length === 0 ? (
            <EmptyState hasNoCards={allCards.length === 0} />
          ) : (
            <ul className="divide-y divide-[#E7E7EA]">
              {open.map((card, i) => (
                <SubscriptionCardRow
                  key={card.id}
                  card={card}
                  index={i}
                  tipSlot={
                    i === 0 && user?.id ? (
                      <FirstItemTip
                        storageKey={`squadhire:tip:dashboard-card:${user.id}`}
                        message="Tap any subscription card to view available candidates and start shortlisting."
                      />
                    ) : null
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {/* Side column — Featured tip + Quick links */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Quick actions
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Account settings', to: '/business/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
              ].map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  className="group flex items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-[#525252] transition-colors hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-[#a3a3a3] group-hover:text-[#0a0a0a] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </span>
                  <svg className="h-3 w-3 text-[#a3a3a3] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ hasNoCards }: { hasNoCards: boolean }) {
  const heading = hasNoCards ? 'No subscription cards yet' : 'No open cards';
  const description = hasNoCards
    ? "Cards will appear here once they're published to your account by SquadHub."
    : 'Your open subscriptions will appear here.';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
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

function SubscriptionCardRow({
  card,
  index,
  tipSlot,
}: {
  card: BusinessSubscriptionCardSummary;
  index: number;
  tipSlot?: React.ReactNode;
}) {
  const rawPrice = formatPrice(card.customer_monthly_price, card.currency);
  // For a multi-tier brief the price is the lowest tier — label it "from".
  const price = rawPrice && card.is_group ? `from ${rawPrice}` : rawPrice;
  const published = formatPublishedAt(card.published_at);
  const accepted = card.counts.accepted;
  const shortlisted = card.counts.shortlisted;
  const tint = tintFor(card.id);

  return (
    <li className={`relative stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`/business/dashboard/cards/${card.id}`}
        className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F5F5F6]"
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
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            <span>{accepted}</span>
            <span className="text-emerald-500">accepted</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F5F6] px-2 py-0.5 font-medium text-[#0a0a0a]">
            <span>{shortlisted}</span>
            <span className="text-[#0a0a0a]">shortlisted</span>
          </span>
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
