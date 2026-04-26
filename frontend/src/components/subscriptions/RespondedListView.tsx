'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from './SubscriptionCardContent';
import type { SubscriptionCardItem } from '@/hooks/useSubscriptionCards';

interface Props {
  items: SubscriptionCardItem[];
}

interface DateGroup {
  key: string;
  label: string;
  items: SubscriptionCardItem[];
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function dayKey(iso: string | null): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'Unknown date';
  return dayFormatter.format(new Date(iso));
}

function groupByDay(items: SubscriptionCardItem[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const item of items) {
    const sortKey = item.responded_at ?? item.cancelled_at ?? '';
    const key = dayKey(sortKey);
    if (!groups.has(key)) {
      groups.set(key, { key, label: dayLabel(sortKey), items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  for (const g of groups.values()) {
    g.items.sort((a, b) => {
      const at = (a.responded_at ?? a.cancelled_at ?? '') || '';
      const bt = (b.responded_at ?? b.cancelled_at ?? '') || '';
      return bt.localeCompare(at);
    });
  }
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function rowHeading(item: SubscriptionCardItem): string {
  const c = item.card.content;
  const brand = typeof c.brand_name === 'string' ? c.brand_name.trim() : '';
  return brand || 'Subscription';
}

function rowSubheading(item: SubscriptionCardItem): string {
  const c = item.card.content;
  const sub = typeof c.subscription_name === 'string' ? c.subscription_name.trim() : '';
  const plan = typeof c.plan_name === 'string' ? c.plan_name.trim() : '';
  return [sub, plan].filter(Boolean).join(' · ');
}

export default function RespondedListView({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = groupByDay(items);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.key}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {group.label}
          </h2>
          <ul className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            {group.items.map((item, idx) => {
              const isOpen = openId === item.id;
              const cancelled = item.cancelled_at != null;
              const time = item.responded_at
                ? timeFormatter.format(new Date(item.responded_at))
                : '';
              return (
                <li
                  key={item.id}
                  className={idx > 0 ? 'border-t border-gray-100' : ''}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className={`min-w-0 flex-1 ${cancelled ? 'opacity-60' : ''}`}>
                      <div className="truncate text-sm font-medium text-gray-900">
                        {rowHeading(item)}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {rowSubheading(item) || '—'}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {item.status === 'accepted' && (
                        <Badge variant="green">Accepted</Badge>
                      )}
                      {item.status === 'rejected' && (
                        <Badge variant="red">Rejected</Badge>
                      )}
                      {cancelled && <Badge variant="gray">Cancelled</Badge>}
                      <span className="hidden w-16 text-right text-xs text-gray-500 sm:inline">
                        {time}
                      </span>
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </button>
                  {isOpen && (
                    <div
                      className={`border-t border-gray-100 bg-gray-50 px-4 py-4 ${cancelled ? 'opacity-60' : ''}`}
                    >
                      <SubscriptionCardContent content={item.card.content} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
