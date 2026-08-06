'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  type HireActivityItem,
  type FilterKey,
  STATUS_STYLES,
  PRODUCT_BADGE,
  PRODUCT_TINT,
  ProductIcon,
} from './hireActivity';

/**
 * The card-activity list — a filterable list of the business's subscriptions,
 * assignments and job posts. Shared by the Find talent "Your activity" section
 * and the standalone "My Cards" page so both render identical rows. Owns the
 * type filter and per-tab counts internally; data is passed in.
 */
export default function BusinessCardsList({
  items,
  isLoading = false,
  isError = false,
  preview = false,
  title = 'Your activity',
  subtitle = 'All subscriptions, assignments, and job posts in one list.',
}: {
  items: HireActivityItem[];
  isLoading?: boolean;
  isError?: boolean;
  preview?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [filter, setFilter] = useState<FilterKey>('all');

  const counts = useMemo(() => {
    const c = { all: items.length, subscription: 0, assignment: 0, job: 0 };
    for (const i of items) c[i.product] += 1;
    return c;
  }, [items]);

  const visible = filter === 'all' ? items : items.filter((i) => i.product === filter);

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

      <div className="border-b border-[#E7E7EA] px-5 sm:px-6" role="tablist" aria-label="Filter by type">
        <div className="-mb-px flex gap-1 overflow-x-auto">
          {(
            [
              { key: 'all' as const, label: 'All' },
              { key: 'subscription' as const, label: 'Subscriptions' },
              { key: 'assignment' as const, label: 'Assignments' },
              { key: 'job' as const, label: 'Job posts' },
            ] as const
          ).map((tab) => {
            const active = filter === tab.key;
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
                  {counts[tab.key]}
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
      ) : visible.length === 0 ? (
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
        <ul className="divide-y divide-[#E7E7EA]">
          {visible.map((item) => {
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
                <li key={item.id}>
                  <Link href={item.href}>{body}</Link>
                </li>
              );
            }
            return (
              <li key={item.id} className={preview ? 'cursor-default' : undefined}>
                {body}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
