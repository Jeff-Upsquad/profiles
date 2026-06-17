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
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function dayLabel(iso: string | null): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dayFormatter.format(d);
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

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function RespondedListView({ items }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = groupByDay(items);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-3 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {group.label}
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <ul className="divide-y divide-[#E8E5DE]">
              {group.items.map((item) => {
                const isOpen = openId === item.id;
                const cancelled = item.cancelled_at != null;
                const time = item.responded_at
                  ? timeFormatter.format(new Date(item.responded_at))
                  : '';
                const heading = rowHeading(item);
                const tint = tintFor(heading);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : item.id)}
                      className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[#F7F6F3]"
                    >
                      <div
                        className={`${tint} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${cancelled ? 'opacity-60' : ''}`}
                        style={{ color: 'var(--tint-icon)' }}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div className={`min-w-0 flex-1 ${cancelled ? 'opacity-60' : ''}`}>
                        <div className="font-[family-name:var(--font-jakarta)] truncate text-[14px] font-semibold text-[#0a0a0a]">
                          {heading}
                        </div>
                        <div className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#737373]">
                          {rowSubheading(item) || '—'}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {item.card.card_type === 'assignment' && <Badge variant="yellow">Assignment</Badge>}
                        {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
                        {item.status === 'rejected' && <Badge variant="red">Declined</Badge>}
                        {cancelled && <Badge variant="gray">Cancelled</Badge>}
                        {item.selected_at && <Badge variant="blue">Selected</Badge>}
                        {item.passed_over_at && !item.selected_at && (
                          <Badge variant="gray">
                            {item.card.status === 'assigned' ? 'Closed' : 'Not selected'}
                          </Badge>
                        )}
                        <span className="hidden w-16 text-right font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3] sm:inline">
                          {time}
                        </span>
                        <svg
                          className={`h-4 w-4 text-[#a3a3a3] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"
                        >
                          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {isOpen && (
                      <div className={`border-t border-[#E8E5DE] bg-[#F7F6F3] px-5 py-5 ${cancelled ? 'opacity-60' : ''}`}>
                        <SubscriptionCardContent content={item.card.content} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
