'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMySubscriptionCards, type BusinessSubscriptionCardSummary } from '@/hooks/useBusiness';

function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

function formatPublishedAt(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  // Calendar-day diff in the user's local timezone — using raw 24h math
  // would misclassify a card published yesterday at 11pm as "today" for
  // any view loaded soon after midnight.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfPublished = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.floor((startOfToday - startOfPublished) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * A card lands in one of three buckets:
 *   - 'live'     — status='active'. Currently visible to talents. Open section.
 *   - 'recalled' — status='archived' with recalled_at set. SquadHub pulled the
 *                  card after acceptances; the lead is still in flight via the
 *                  acceptee. Open section, with a Recalled tag.
 *   - 'closed'   — status='archived' with no recalled_at. Search is over —
 *                  hire completed, lead cancelled, etc. Closed section.
 */
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

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: cards, isLoading } = useMySubscriptionCards();

  // Open holds anything still in play: live cards plus recalled-but-accepted
  // ones (the lead is alive via the acceptee). Closed is terminal — search
  // ended without a recall. Sorted within each bucket by published_at desc
  // because the API already does that.
  const open = (cards ?? []).filter((c) => classifyCard(c) !== 'closed');
  const closed = (cards ?? []).filter((c) => classifyCard(c) === 'closed');

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
      {open.length > 0 && <CardSection label="Open" items={open} />}
      {closed.length > 0 && <CardSection label="Closed" items={closed} muted />}
    </>
  );
}

function CardSection({
  label,
  items,
  muted = false,
}: {
  label: string;
  items: BusinessSubscriptionCardSummary[];
  muted?: boolean;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label} <span className="text-gray-400">({items.length})</span>
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((card) => (
          <SubscriptionCardRow key={card.id} card={card} muted={muted} />
        ))}
      </div>
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
          {card.plan_name && (
            <p className="mt-0.5 truncate text-xs text-gray-500">{card.plan_name}</p>
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
