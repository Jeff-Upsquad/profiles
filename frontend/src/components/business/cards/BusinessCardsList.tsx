'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  type HireActivityItem,
  type FilterKey,
  type ActivityStatus,
  STATUS_STYLES,
  STATUS_FILTER_ORDER,
  PRODUCT_BADGE,
  PRODUCT_TINT,
  ProductIcon,
} from './hireActivity';

/**
 * The card-activity list — a filterable list of the business's subscriptions,
 * assignments and job posts. Shared by the Find talent "Your activity" section
 * and the standalone "My Cards" page so both render identical rows. Owns the
 * status filter and per-tab counts internally; data is passed in. Cards are
 * grouped by lifecycle status (not product type).
 */
export default function BusinessCardsList({
  items,
  isLoading = false,
  isError = false,
  preview = false,
  title = 'Your activity',
  subtitle = 'All subscriptions, assignments, and job posts — grouped by status.',
}: {
  items: HireActivityItem[];
  isLoading?: boolean;
  isError?: boolean;
  preview?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const visibleItems = items;

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: visibleItems.length } as Record<FilterKey, number>;
    for (const status of STATUS_FILTER_ORDER) c[status] = 0;
    for (const i of visibleItems) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [visibleItems]);

  // These tabs are always visible even when empty, so the business can see
  // at a glance that no cards are in those terminal/paused states.
  const ALWAYS_SHOW_STATUSES: ActivityStatus[] = ['paused', 'closed', 'cancelled'];

  // Show tabs with cards, the active tab, and always-visible statuses.
  const tabs = useMemo(() => {
    const statusTabs = STATUS_FILTER_ORDER.filter(
      (s) => (counts[s] ?? 0) > 0 || filter === s || ALWAYS_SHOW_STATUSES.includes(s),
    ).map((s) => ({ key: s as FilterKey, label: STATUS_STYLES[s].label }));
    return [{ key: 'all' as const, label: 'All' }, ...statusTabs];
  }, [counts, filter]);

  // When the active filter has no cards left (e.g. data refreshed), fall back
  // to All so the list isn't stuck on an empty status tab.
  const effectiveFilter: FilterKey =
    filter === 'all' || (counts[filter] ?? 0) > 0 ? filter : 'all';

  // Statuses visible in the "All" tab — only open (pre-assigned) and active
  // (assigned). Terminal states (paused, filled, cancelled, closed) live in
  // their own tabs.
  const ALL_TAB_STATUSES: ActivityStatus[] = [
    'submitted', 'open', 'sourcing', 'interviewing', 'active',
  ];

  // Group by status in workflow order. "All" shows only open + active groups;
  // a specific status tab shows only that group.
  const groups = useMemo(() => {
    const byStatus = new Map<ActivityStatus, HireActivityItem[]>();
    for (const item of visibleItems) {
      const list = byStatus.get(item.status);
      if (list) list.push(item);
      else byStatus.set(item.status, [item]);
    }
    const order =
      effectiveFilter === 'all'
        ? ALL_TAB_STATUSES
        : STATUS_FILTER_ORDER.filter((s) => s === effectiveFilter);
    return order
      .filter((s) => (byStatus.get(s)?.length ?? 0) > 0)
      .map((status) => ({
        status,
        label: STATUS_STYLES[status].label,
        items: byStatus.get(status) ?? [],
      }));
  }, [visibleItems, effectiveFilter]);

  const totalVisible = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col gap-3 border-b border-[#E7E7EA] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[#737373]">{subtitle}</p>
        </div>
      </div>

      <div className="border-b border-[#E7E7EA] px-5 sm:px-6" role="tablist" aria-label="Filter by status">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const active = effectiveFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.key)}
                className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-[#0a0a0a]' : 'text-[#737373] hover:text-[#0a0a0a]'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-xs font-medium ${active ? 'text-[#525252]' : 'text-[#a3a3a3]'}`}>
                  {counts[tab.key] ?? 0}
                </span>
                {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0a0a0a]" />}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 px-5 py-5 sm:px-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="px-5 py-10 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-900">Could not load your activity.</p>
            <p className="mt-0.5 text-sm text-red-700">Refresh the page to try again.</p>
          </div>
        </div>
      ) : totalVisible === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F6]">
            <svg className="h-5 w-5 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <p className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            Nothing here yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[#737373]">
            Create a subscription, assignment, or job post above and it will show up in this list.
          </p>
        </div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.status}>
              {/* Section header only when "All" shows multiple statuses */}
              {effectiveFilter === 'all' && groups.length > 1 && (
                <div className="border-b border-[#E7E7EA] bg-[#FAFAFA] px-5 py-2 sm:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                    {group.label}
                    <span className="ml-1.5 font-medium normal-case tracking-normal text-[#a3a3a3]">
                      {group.items.length}
                    </span>
                  </p>
                </div>
              )}
              <ul className="divide-y divide-[#E7E7EA]">
                {group.items.map((item) => (
                  <CardRow key={item.id} item={item} preview={preview} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CardRow({ item, preview }: { item: HireActivityItem; preview: boolean }) {
  const status = STATUS_STYLES[item.status];
  const unread = item.unreadCount ?? 0;
  const body = (
    <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F5F5F6] sm:px-6">
      <div
        className={`${PRODUCT_TINT[item.product]} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`}
        style={{ color: 'var(--tint-icon)' }}
      >
        <ProductIcon product={item.product} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
            {item.title}
          </p>
          <span className="shrink-0 rounded-full bg-[#F5F5F6] px-2 py-0.5 text-[10px] font-semibold text-[#525252]">
            {PRODUCT_BADGE[item.product]}
          </span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
            {status.label}
          </span>
          {unread > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              {unread} new
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-[#737373]">{item.subtitle}</p>
        <p className="mt-0.5 truncate text-xs text-[#a3a3a3]">{item.meta}</p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-[#D4D4D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

  if (item.href && !preview) {
    return (
      <li>
        <Link href={item.href}>{body}</Link>
      </li>
    );
  }
  return <li className={preview ? 'cursor-default' : undefined}>{body}</li>;
}
