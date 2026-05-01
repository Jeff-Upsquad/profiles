'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';

type Tab = 'open' | 'closed';

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

function classifyCard(card: BusinessSubscriptionCardSummary): 'live' | 'recalled' | 'closed' {
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
  const [tab, setTab] = useState<Tab>('open');

  const allCards = cards ?? [];
  const open = allCards.filter((c) => classifyCard(c) !== 'closed');
  const closed = allCards.filter((c) => classifyCard(c) === 'closed');
  const visible = tab === 'open' ? open : closed;

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
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-glow-blur" />
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 stagger-1">
              <span className="eyebrow-rainbow">Business Workspace</span>
              {open.length > 0 && <span className="pill-live">Live</span>}
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#202020] stagger-2">
              Welcome back{firstWord ? <>, <span className="text-rainbow">{firstWord}</span></> : ''}.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#646464] stagger-3">
              Track your subscriptions, review talents, and manage your shortlists.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 stagger-4">
            <Link href="/business/discover" className="btn-iridescent text-sm py-2 px-3.5">
              Discover Talent
              <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <Link
              href="/business/shortlist"
              className="font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg border border-[#E4E4E7] bg-white px-3.5 py-2 text-sm font-semibold text-[#202020] transition-all duration-200 hover:bg-[#f0f0f0] active:scale-[0.97]"
            >
              View Shortlist
            </Link>
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
                <p className="mt-3 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-[#202020]">
                  {tile.label}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#646464]">
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
        <div className="lg:col-span-2 rounded-2xl border border-[#ECECEF] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between border-b border-[#ECECEF] px-6 py-5">
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#202020]">
                Subscription Cards
              </h2>
              <p className="mt-0.5 text-sm text-[#838383]">
                Cards published to your account by SquadHub
              </p>
            </div>
          </div>

          <div className="px-6 pt-4">
            <Tabs
              active={tab}
              onChange={setTab}
              openCount={open.length}
              closedCount={closed.length}
            />
          </div>

          {isLoading ? (
            <div className="space-y-3 px-6 pb-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-[#f0f0f0]" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyTabState tab={tab} hasNoCards={allCards.length === 0} />
          ) : (
            <ul className="divide-y divide-[#ECECEF]">
              {visible.map((card, i) => (
                <SubscriptionCardRow
                  key={card.id}
                  card={card}
                  muted={tab === 'closed'}
                  index={i}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Side column — Featured tip + Quick links */}
        <div className="space-y-4">
          <div className="relative rounded-2xl bg-[#202020] p-6 text-white overflow-hidden noise-overlay">
            <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-rainbow opacity-30 blur-3xl" />
            <div className="relative">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm mb-4">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em]">
                Hire faster
              </h3>
              <p className="mt-1.5 text-sm text-white/70 leading-relaxed">
                Browse approved talent profiles, shortlist favorites, and send interest requests directly from each card.
              </p>
              <Link
                href="/business/discover"
                className="mt-5 inline-flex items-center gap-1 font-[family-name:var(--font-inter)] text-[13px] font-semibold text-white hover:gap-2 transition-all"
              >
                Start browsing
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-[#ECECEF] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <h3 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#202020]">
              Quick actions
            </h3>
            <div className="space-y-1">
              {[
                { label: 'Browse all categories', to: '/business/discover', icon: 'M4 6h16M4 12h16M4 18h7' },
                { label: 'My shortlist', to: '/business/shortlist', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
                { label: 'Interest requests', to: '/business/interests', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
                { label: 'Account settings', to: '/business/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
              ].map((item) => (
                <Link
                  key={item.to}
                  href={item.to}
                  className="group flex items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-[#646464] transition-colors hover:bg-[#F8F9FA] hover:text-[#202020]"
                >
                  <span className="flex items-center gap-2.5">
                    <svg className="h-4 w-4 text-[#A1A1AA] group-hover:text-[#6647F0] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                    {item.label}
                  </span>
                  <svg className="h-3 w-3 text-[#A1A1AA] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
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

function Tabs({
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
    <div className="-mx-6 border-b border-[#ECECEF] px-6" role="tablist" aria-label="Subscription cards">
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
          ? 'border-b-2 border-[#6647F0] text-[#202020]'
          : 'border-b-2 border-transparent text-[#838383] hover:text-[#202020]'
      }`}
    >
      <span>{children}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-[#F2EEFF] text-[#6647F0]' : 'bg-[#f0f0f0] text-[#838383]'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyTabState({ tab, hasNoCards }: { tab: Tab; hasNoCards: boolean }) {
  const heading = hasNoCards
    ? 'No subscription cards yet'
    : tab === 'open'
      ? 'No open cards'
      : 'No closed cards yet';
  const description = hasNoCards
    ? "Cards will appear here once they're published to your account by SquadHub."
    : tab === 'open'
      ? 'All your active subscriptions will land here.'
      : 'Finished hires and archived cards will land here.';

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F2EEFF]">
        <svg className="h-6 w-6 text-[#6647F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
        </svg>
      </div>
      <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#202020]">
        {heading}
      </h3>
      <p className="max-w-sm text-sm text-[#838383]">{description}</p>
    </div>
  );
}

function SubscriptionCardRow({
  card,
  muted,
  index,
}: {
  card: BusinessSubscriptionCardSummary;
  muted: boolean;
  index: number;
}) {
  const price = formatPrice(card.customer_monthly_price, card.currency);
  const published = formatPublishedAt(card.published_at);
  const accepted = card.counts.accepted;
  const shortlisted = card.counts.shortlisted;
  const isRecalled = classifyCard(card) === 'recalled';
  const tint = tintFor(card.id);

  return (
    <li className={`stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`/business/dashboard/cards/${card.id}`}
        className={`group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-[#F8F9FA] ${
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
            <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#202020]">
              {cardTitle(card)}
            </p>
            {isRecalled && (
              <span
                className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                title="Card was recalled by SquadHub. Accepted talents stay in your shortlist."
              >
                Recalled
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {planSubtitle(card) && (
              <span className="text-[#838383]">{planSubtitle(card)}</span>
            )}
            {planSubtitle(card) && (price || published) && (
              <span className="text-[#D4D4D8]">·</span>
            )}
            {price && <span className="font-medium text-[#202020]">{price}</span>}
            {published && (
              <>
                {price && <span className="text-[#D4D4D8]">·</span>}
                <span className="text-[#A1A1AA]">Published {published}</span>
              </>
            )}
          </div>
        </div>

        <div className="hidden sm:flex flex-shrink-0 items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            <span>{accepted}</span>
            <span className="text-emerald-500">accepted</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
            <span>{shortlisted}</span>
            <span className="text-indigo-500">shortlisted</span>
          </span>
        </div>

        <svg
          className="h-4 w-4 flex-shrink-0 text-[#A1A1AA] opacity-0 transition-opacity group-hover:opacity-100"
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
