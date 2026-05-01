'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';

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

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: cards, isLoading } = useMySubscriptionCards();
  const [tab, setTab] = useState<Tab>('open');

  const open = (cards ?? []).filter((c) => classifyCard(c) !== 'closed');
  const closed = (cards ?? []).filter((c) => classifyCard(c) === 'closed');
  const visible = tab === 'open' ? open : closed;

  const greeting = (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
        Welcome{user?.company_name ? `, ${user.company_name}` : ''}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Subscription cards published to your account. Tap one to see the talents you've shortlisted under it.
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {greeting}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <>
        {greeting}
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-600">No subscription cards yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Cards will appear here once they're published to your account.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {greeting}
      <Tabs
        active={tab}
        onChange={setTab}
        openCount={open.length}
        closedCount={closed.length}
      />
      {visible.length === 0 ? (
        <EmptyTabState tab={tab} />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {visible.map((card) => (
            <SubscriptionCardRow key={card.id} card={card} muted={tab === 'closed'} />
          ))}
        </div>
      )}
    </>
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
    <div className="mb-4 border-b border-gray-200" role="tablist" aria-label="Subscription cards">
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
      className={`relative -mb-px flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-indigo-600 text-indigo-700'
          : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      <span>{children}</span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyTabState({ tab }: { tab: Tab }) {
  const message =
    tab === 'open'
      ? 'No open subscription cards right now.'
      : 'No closed cards yet — finished hires will land here.';
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

function SubscriptionCardRow({
  card,
  muted,
}: {
  card: BusinessSubscriptionCardSummary;
  muted: boolean;
}) {
  const price = formatPrice(card.customer_monthly_price, card.currency);
  const published = formatPublishedAt(card.published_at);
  const accepted = card.counts.accepted;
  const shortlisted = card.counts.shortlisted;
  const isRecalled = classifyCard(card) === 'recalled';

  return (
    <Link
      href={`/business/dashboard/cards/${card.id}`}
      className={`group flex flex-col rounded-xl border bg-white p-4 transition-shadow hover:shadow-md ${
        muted ? 'border-gray-200 opacity-70' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">
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
          {planSubtitle(card) && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{planSubtitle(card)}</p>
          )}
        </div>
        {price && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            {price}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
          <span>{accepted}</span>
          <span className="text-emerald-500">accepted</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
          <span>{shortlisted}</span>
          <span className="text-indigo-500">shortlisted</span>
        </span>
        {published && (
          <span className="ml-auto text-gray-400">Published {published}</span>
        )}
      </div>
    </Link>
  );
}
