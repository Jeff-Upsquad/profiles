'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

type Recipient = {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  responded_at: string | null;
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
  const { data, isLoading, error } = useQuery<Response>({
    queryKey: ['admin-card-recipients', cardId],
    queryFn: () =>
      api.get(`/admin/subscription-cards/${cardId}/recipients`).then((r) => r.data),
  });

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
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-sm">
          {isLoading ? (
            <p className="text-center text-xs text-gray-500">Loading…</p>
          ) : error ? (
            <p className="text-center text-xs text-red-600">Failed to load recipients.</p>
          ) : (
            <Section title="Talents">
              <Subgroup label="Accepted" items={groups.accepted} />
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
  label, items,
}: { label: 'Accepted' | 'Rejected' | 'Pending'; items: Recipient[] }) {
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
              <p className="truncate text-sm text-gray-900">{it.talent_name || 'Unknown talent'}</p>
              <p className="truncate text-[11px] font-mono text-gray-400">{it.talent_user_id.slice(0, 8)}</p>
              {it.responded_at && (
                <p className="text-[11px] text-gray-400">{formatRelative(it.responded_at)}</p>
              )}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP[it.status]}`}>
              {it.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
