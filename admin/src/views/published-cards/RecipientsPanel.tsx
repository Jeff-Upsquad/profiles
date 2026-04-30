'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import TierBadge from '@/components/ui/TierBadge';

type Recipient = {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null;
  tier_custom: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  created_at: string;
};

type Response = { items: Recipient[] };

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_CHIP: Record<'pending' | 'accepted' | 'rejected', string> = {
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function RecipientsPanel({
  cardId, title, onClose,
}: { cardId: string; title: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ['admin-card-recipients', cardId],
    queryFn: () =>
      api.get(`/admin/subscription-cards/${cardId}/recipients`).then((r) => r.data),
  });

  const removeFromDashboard = useMutation({
    mutationFn: (recipientId: string) =>
      api
        .post(`/admin/subscription-cards/${cardId}/recipients/${recipientId}/remove-from-dashboard`)
        .then((r) => r.data as { removed: number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-recipients', cardId] });
      queryClient.invalidateQueries({ queryKey: ['admin-published-cards'] });
    },
  });

  const selectRecipient = useMutation({
    mutationFn: (recipientId: string) =>
      api.post(`/admin/subscription-cards/${cardId}/select`, { recipient_id: recipientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-recipients', cardId] });
      queryClient.invalidateQueries({ queryKey: ['admin-published-cards'] });
    },
    onError: (err: any) =>
      alert(err?.response?.data?.message || err.message || 'Failed to select recipient'),
  });

  const undoSelection = useMutation({
    mutationFn: () =>
      api.post(`/admin/subscription-cards/${cardId}/undo-selection`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-card-recipients', cardId] });
      queryClient.invalidateQueries({ queryKey: ['admin-published-cards'] });
    },
    onError: (err: any) =>
      alert(err?.response?.data?.message || err.message || 'Failed to undo selection'),
  });

  const hasSelection = (data?.items || []).some((r) => r.selected_at);

  const groups = useMemo(() => {
    const items = data?.items || [];
    return {
      accepted: items.filter((r) => r.status === 'accepted'),
      rejected: items.filter((r) => r.status === 'rejected'),
      pending: items.filter((r) => r.status === 'pending'),
    };
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-[480px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900 truncate">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {hasSelection && (
          <div className="flex items-center justify-between border-b border-gray-200 bg-blue-50 px-5 py-2.5">
            <p className="text-xs text-blue-700 font-medium">A talent has been selected for this card.</p>
            <button
              onClick={() => {
                if (window.confirm('Undo the selection? The card will reopen.')) undoSelection.mutate();
              }}
              disabled={undoSelection.isPending}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Undo selection
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {isLoading ? (
            <p className="text-center text-xs text-gray-500">Loading…</p>
          ) : error ? (
            <p className="text-center text-xs text-red-600">Failed to load recipients.</p>
          ) : (
            <Section title="Talents">
              <Subgroup
                label="Accepted"
                items={groups.accepted}
                onRemoveFromDashboard={(id) => removeFromDashboard.mutate(id)}
                pendingRemovalId={
                  removeFromDashboard.isPending ? removeFromDashboard.variables ?? null : null
                }
                onSelect={!hasSelection ? (id) => {
                  if (window.confirm('Select this talent? Other acceptees will be passed over.')) {
                    selectRecipient.mutate(id);
                  }
                } : undefined}
                isSelecting={selectRecipient.isPending}
              />
              <Subgroup label="Rejected" items={groups.rejected} />
              <Subgroup label="Pending" items={groups.pending} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Subgroup({
  label, items, onRemoveFromDashboard, pendingRemovalId, onSelect, isSelecting,
}: {
  label: 'Accepted' | 'Rejected' | 'Pending';
  items: Recipient[];
  onRemoveFromDashboard?: (recipientId: string) => void;
  pendingRemovalId?: string | null;
  onSelect?: (recipientId: string) => void;
  isSelecting?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium text-gray-600">{label} (0)</p>
        <p className="text-xs text-gray-400">None.</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-gray-600">{label} ({items.length})</p>
      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0 flex-1 truncate">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm text-gray-900">{it.talent_name || 'Unknown talent'}</p>
                <TierBadge tier={it.tier} tierCustom={it.tier_custom} />
              </div>
              <p className="truncate text-[11px] font-mono text-gray-400">{it.talent_user_id.slice(0, 8)}</p>
              {it.responded_at && (
                <p className="text-[11px] text-gray-400">{formatRelative(it.responded_at)}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {it.selected_at && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                  Selected
                </span>
              )}
              {it.passed_over_at && !it.selected_at && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                  Not selected
                </span>
              )}
              {onSelect && !it.selected_at && !it.passed_over_at && (
                <button
                  type="button"
                  disabled={isSelecting}
                  onClick={() => onSelect(it.id)}
                  className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Select
                </button>
              )}
              {onRemoveFromDashboard && it.status === 'accepted' && !it.selected_at && !it.passed_over_at && (
                <button
                  type="button"
                  disabled={pendingRemovalId === it.id}
                  onClick={() => {
                    if (window.confirm('Remove this talent from the business dashboard?')) {
                      onRemoveFromDashboard(it.id);
                    }
                  }}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {pendingRemovalId === it.id ? 'Removing…' : 'Remove from dashboard'}
                </button>
              )}
              {!it.selected_at && !it.passed_over_at && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[it.status]}`}>
                  {it.status}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
