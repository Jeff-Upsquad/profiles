'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  useMySubscriptionCards,
  useMyCategories,
  useSharedProfiles,
  type BusinessSubscriptionCardSummary,
} from '@/hooks/useBusiness';
import type { Category, Profile } from '@/types';

type TopTab = 'dashboard' | 'subscription' | 'all-profiles';
type CardTab = 'open' | 'closed';

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
  const [topTab, setTopTab] = useState<TopTab>('dashboard');

  const greeting = (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
        Welcome{user?.company_name ? `, ${user.company_name}` : ''}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Track your subscription cards, accepted talents, and shared profiles.
      </p>
    </div>
  );

  return (
    <>
      {greeting}
      <TopTabs active={topTab} onChange={setTopTab} />
      {topTab === 'dashboard' && <DashboardTab />}
      {topTab === 'subscription' && <SubscriptionTab />}
      {topTab === 'all-profiles' && <AllProfilesTab />}
    </>
  );
}

function TopTabs({ active, onChange }: { active: TopTab; onChange: (t: TopTab) => void }) {
  const tabs: Array<{ id: TopTab; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'subscription', label: 'My subscription' },
    { id: 'all-profiles', label: 'All profiles' },
  ];
  return (
    <nav className="mb-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Business sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          onClick={() => onChange(t.id)}
          className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            active === t.id
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ─── Dashboard tab ─────────────────────────────────────────────────────────

function DashboardTab() {
  const { data: cards, isLoading } = useMySubscriptionCards();
  const [tab, setTab] = useState<CardTab>('open');

  const open = (cards ?? []).filter((c) => classifyCard(c) !== 'closed');
  const closed = (cards ?? []).filter((c) => classifyCard(c) === 'closed');
  const visible = tab === 'open' ? open : closed;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-600">No subscription cards yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Cards will appear here once they're published to your account.
        </p>
      </div>
    );
  }

  return (
    <>
      <CardSubTabs
        active={tab}
        onChange={setTab}
        openCount={open.length}
        closedCount={closed.length}
      />
      {visible.length === 0 ? (
        <EmptyCardState tab={tab} />
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

function CardSubTabs({
  active,
  onChange,
  openCount,
  closedCount,
}: {
  active: CardTab;
  onChange: (t: CardTab) => void;
  openCount: number;
  closedCount: number;
}) {
  return (
    <div className="mb-4 border-b border-gray-200" role="tablist" aria-label="Subscription cards">
      <div className="flex gap-1 overflow-x-auto">
        <CardTabButton active={active === 'open'} onClick={() => onChange('open')} count={openCount}>
          Open
        </CardTabButton>
        <CardTabButton active={active === 'closed'} onClick={() => onChange('closed')} count={closedCount}>
          Closed
        </CardTabButton>
      </div>
    </div>
  );
}

function CardTabButton({
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

function EmptyCardState({ tab }: { tab: CardTab }) {
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

// ─── My subscription tab ───────────────────────────────────────────────────

function SubscriptionTab() {
  const { data: categories, isLoading: categoriesLoading } = useMyCategories();
  const [activeCategoryId, setActiveCategoryId] = useState('');

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0]!.id);
    }
  }, [categories, activeCategoryId]);

  if (categoriesLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-600">No subscribed categories yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Categories appear here once you have an active subscription.
        </p>
      </div>
    );
  }

  return (
    <>
      <CategoryChipTabs
        categories={categories}
        activeId={activeCategoryId}
        onChange={setActiveCategoryId}
      />
      {activeCategoryId && <AcceptedProfilesList categoryId={activeCategoryId} />}
    </>
  );
}

function CategoryChipTabs({
  categories,
  activeId,
  onChange,
}: {
  categories: Category[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Subscription categories">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeId === cat.id
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}

function AcceptedProfilesList({ categoryId }: { categoryId: string }) {
  const { data: profiles, isLoading } = useSharedProfiles(categoryId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-600">No accepted profiles in this category yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Profiles appear here once talents accept their subscription invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <ProfileRow key={profile.id} profile={profile} categoryId={categoryId} />
      ))}
    </div>
  );
}

function ProfileRow({ profile, categoryId }: { profile: Profile; categoryId: string }) {
  const name = (profile as any)?.talent_user?.full_name ?? 'Unknown talent';
  const location = (profile as any)?.talent_user?.current_location;
  const photo = (profile as any)?.talent_user?.profile_photo_url;
  const categoryName = (profile as any)?.category?.name;
  const initial = name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/business/dashboard/${categoryId}/${profile.id}`}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        <p className="truncate text-[11px] text-gray-500">
          {categoryName}
          {categoryName && location ? ' · ' : ''}
          {location}
        </p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── All profiles tab ──────────────────────────────────────────────────────

function AllProfilesTab() {
  const { data: categories, isLoading } = useMyCategories();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-600">No profiles available yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Profiles appear here once your subscription becomes active.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <CategoryProfilesSection key={cat.id} category={cat} />
      ))}
    </div>
  );
}

function CategoryProfilesSection({ category }: { category: Category }) {
  const { data: profiles, isLoading } = useSharedProfiles(category.id);

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{category.name}</h2>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  if (!profiles || profiles.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{category.name}</h2>
        <span className="text-xs text-gray-400">{profiles.length}</span>
      </div>
      <div className="space-y-2">
        {profiles.map((profile) => (
          <ProfileRow key={profile.id} profile={profile} categoryId={category.id} />
        ))}
      </div>
    </section>
  );
}
