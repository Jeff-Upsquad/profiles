'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatDate';
import type { SubscriptionCardItem } from '@/hooks/useSubscriptionCards';

interface Props {
  items: SubscriptionCardItem[];
  initialOpenId?: string | null;
  mode?: 'pending' | 'responded' | 'expired';
}

interface DateGroup {
  key: string;
  label: string;
  items: SubscriptionCardItem[];
}

function itemDate(item: SubscriptionCardItem, mode: Props['mode']): string {
  if (mode === 'pending') return item.card.published_at ?? '';
  return item.responded_at ?? item.cancelled_at ?? item.card.published_at ?? '';
}

function dayKey(iso: string): string {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function dayLabel(iso: string): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(d);
}

function groupByDay(items: SubscriptionCardItem[], mode: Props['mode']): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const item of items) {
    const date = itemDate(item, mode);
    const key = dayKey(date);
    if (!groups.has(key)) groups.set(key, { key, label: dayLabel(date), items: [] });
    groups.get(key)!.items.push(item);
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => itemDate(b, mode).localeCompare(itemDate(a, mode)));
  }
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function heading(item: SubscriptionCardItem): string {
  const content = item.card.content;
  return stringValue(content.brand_name) || stringValue(content.title) || 'Opportunity';
}

function subheading(item: SubscriptionCardItem): string {
  const content = item.card.content;
  return [stringValue(content.subscription_name), stringValue(content.plan_name)]
    .filter(Boolean)
    .join(' · ');
}

function price(item: SubscriptionCardItem): string {
  const content = item.card.content;
  const label = stringValue(content.price_label);
  if (label) return label;
  if (typeof content.monthly_price !== 'number') return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: stringValue(content.currency) || 'INR',
      maximumFractionDigits: 0,
    }).format(content.monthly_price);
  } catch {
    return `${stringValue(content.currency) || 'INR'} ${content.monthly_price.toLocaleString()}`;
  }
}

function commitment(item: SubscriptionCardItem): string {
  const content = item.card.content;
  const details = (content.assignment_details ?? {}) as Record<string, unknown>;
  const subscriptionCommitment = [stringValue(content.capacity_label), stringValue(content.hours_label)]
    .filter(Boolean)
    .join(' · ');
  return (
    stringValue(details.work_type) ||
    stringValue(details.scope_type) ||
    subscriptionCommitment ||
    '—'
  );
}

function StatusBadge({ item, mode }: { item: SubscriptionCardItem; mode: Props['mode'] }) {
  if (mode === 'pending') return null;
  if (item.status === 'accepted') return <Badge variant="green">Accepted</Badge>;
  if (item.status === 'rejected') return <Badge variant="red">Declined</Badge>;
  if (item.cancelled_at) return <Badge variant="gray">Cancelled</Badge>;
  if (mode === 'expired') return <Badge variant="gray">Expired</Badge>;
  return null;
}

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function RespondedListView({ items, initialOpenId = null, mode = 'responded' }: Props) {
  const groups = groupByDay(items, mode);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="mb-3 font-[family-name:var(--font-inter)] text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            {group.label}
          </h2>
          <div className="space-y-3">
            {group.items.map((item) => {
              const title = heading(item);
              const type = item.card.card_type === 'assignment' ? 'assignment' : 'subscription';
              return (
                <Link
                  key={item.id}
                  id={`recipient-${item.id}`}
                  href={`/talent/opportunities/${item.id}?type=${type}`}
                  className={`block overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] ${
                    item.id === initialOpenId ? 'border-[#0a0a0a] ring-1 ring-[#0a0a0a]' : 'border-[#E7E7EA]'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div
                      className={`${tintFor(title)} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl`}
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-[family-name:var(--font-jakarta)] text-[14px] font-semibold text-[#0a0a0a]">{title}</p>
                      <p className="mt-0.5 truncate text-xs text-[#737373]">{subheading(item) || (type === 'assignment' ? 'Assignment' : 'Subscription')}</p>
                    </div>
                    <StatusBadge item={item} mode={mode} />
                    <svg className="h-4 w-4 shrink-0 text-[#a3a3a3]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.06 10 7.23 6.29a.75.75 0 111.04-1.08l4.39 4.25a.75.75 0 010 1.08l-4.39 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <dl className="grid grid-cols-2 border-t border-[#E7E7EA] bg-[#FAFAFA]">
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-[9px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Commitment</dt>
                      <dd className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-[#404040]">{commitment(item)}</dd>
                    </div>
                    <div className="min-w-0 border-l border-[#E7E7EA] px-3 py-2.5">
                      <dt className="text-[9px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Price</dt>
                      <dd className="mt-0.5 truncate text-[11px] font-semibold text-[#1F7E36]">{price(item)}</dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
