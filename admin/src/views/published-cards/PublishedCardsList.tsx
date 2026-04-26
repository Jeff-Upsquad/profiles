'use client';

import { useCallback, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import api from '@/services/api';
import Input from '@/components/ui/Input';
import RecipientsPanel from './RecipientsPanel';

interface PublishedCard {
  id: string;
  external_id: string;
  status: 'active' | 'archived';
  published_at: string;
  expires_at: string | null;
  business_name: string | null;
  subscription_name: string | null;
  plan_label: string | null;
  talents: { pending: number; accepted: number; rejected: number };
}

interface CardsResponse {
  items: PublishedCard[];
}

function formatPublishedAt(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function cardTitle(card: PublishedCard): string {
  const business = card.business_name || 'Unknown business';
  return card.subscription_name ? `${business} · ${card.subscription_name}` : business;
}

export default function PublishedCardsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const selectedId = searchParams.get('selected');

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const { data, isLoading } = useQuery<CardsResponse>({
    queryKey: ['admin-published-cards', status, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/subscription-cards?${params.toString()}`);
      return data;
    },
    placeholderData: keepPreviousData,
  });

  const cards = data?.items || [];

  const groups = useMemo(() => ({
    active: cards.filter((c) => c.status === 'active'),
    archived: cards.filter((c) => c.status === 'archived'),
  }), [cards]);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedId) || null,
    [cards, selectedId],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-6 pt-5 pb-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Published Cards</h1>
          <p className="mt-0.5 text-sm text-gray-500">All subscription cards published from SquadHub.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => updateQuery({ status: e.target.value })}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <div className="flex-1 min-w-[200px]">
            <Input
              type="text"
              value={search}
              onChange={(e) => updateQuery({ search: e.target.value })}
              placeholder="Search business or subscription…"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : cards.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">No published cards match your filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.active.length > 0 && (
              <CardGroup
                label="Active"
                color="#10B981"
                items={groups.active}
                selectedId={selectedId}
                onSelect={(id) => updateQuery({ selected: id })}
              />
            )}
            {groups.archived.length > 0 && (
              <CardGroup
                label="Archived"
                color="#6B7280"
                items={groups.archived}
                selectedId={selectedId}
                onSelect={(id) => updateQuery({ selected: id })}
              />
            )}
          </div>
        )}
      </div>

      {selectedCard && (
        <RecipientsPanel
          cardId={selectedCard.id}
          title={cardTitle(selectedCard)}
          onClose={() => updateQuery({ selected: null })}
        />
      )}
    </div>
  );
}

function CardGroup({
  label,
  color,
  items,
  selectedId,
  onSelect,
}: {
  label: string;
  color: string;
  items: PublishedCard[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="text-xs text-gray-500">({items.length})</span>
      </div>
      <div className="space-y-1.5">
        {items.map((card) => (
          <PublishedCardRow
            key={card.id}
            card={card}
            selected={selectedId === card.id}
            onClick={() => onSelect(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PublishedCardRow({
  card, selected, onClick,
}: { card: PublishedCard; selected: boolean; onClick: () => void }) {
  const business = card.business_name || 'Unknown';
  const subName = card.subscription_name || '—';
  const planLabel = card.plan_label || '';
  const t = card.talents;
  const ringClass = selected ? 'ring-2 ring-indigo-500 ring-offset-1' : '';

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition hover:shadow-sm ${ringClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600 text-sm font-semibold">
          {business.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {business} · {subName}
          </p>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {planLabel}
            {planLabel && card.published_at ? ' · ' : ''}
            {card.published_at ? `Published ${formatPublishedAt(card.published_at)}` : ''}
          </p>
        </div>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
        title={`Talents: ${t.accepted} accepted, ${t.rejected} rejected, ${t.pending} pending`}
      >
        <span className="text-gray-500">Talents</span>
        <span className="text-emerald-700">{t.accepted}✓</span>
        <span className="text-red-600">{t.rejected}✗</span>
        <span className="text-amber-700">{t.pending}⌛</span>
      </span>
    </button>
  );
}
