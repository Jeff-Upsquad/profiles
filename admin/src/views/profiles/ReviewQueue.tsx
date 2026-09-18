import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import TierBadge from '@/components/ui/TierBadge';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';
import { timeAgo } from '@/views/onboarding/hubTypes';
import ReviewChecklistModal from './ReviewChecklistModal';

type QueueTab = 'pending_review' | 'changes_requested';

interface ReviewProfile {
  id: string;
  talent_user_id: string;
  category_id: string;
  status: string;
  field_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  talent_users?: { full_name: string; phone?: string | null };
  categories?: { name: string; slug: string };
  tier: 'junior' | 'pro' | 'Top Talents' | 'custom' | null;
  tier_custom: string | null;
  requested_changes?: { key: string; label: string }[] | null;
  changes_requested_at?: string | null;
  resubmitted_at?: string | null;
  changes_whatsapp_sent?: boolean | null;
}

export default function ReviewQueue() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tab, setTab] = useState<QueueTab>('pending_review');
  const [checklistOpen, setChecklistOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery<ReviewProfile[]>({
    queryKey: ['reviews', categoryFilter, tab],
    queryFn: async () => {
      const { data } = await api.get('/admin/reviews', {
        params: { ...(categoryFilter ? { category_id: categoryFilter } : {}), status: tab },
      });
      return data.profiles ?? data;
    },
  });

  // Count for the other tab's badge so the reviewer sees both inboxes at once.
  const { data: waiting } = useQuery<ReviewProfile[]>({
    queryKey: ['reviews', categoryFilter, 'changes_requested'],
    queryFn: async () => {
      const { data } = await api.get('/admin/reviews', {
        params: { ...(categoryFilter ? { category_id: categoryFilter } : {}), status: 'changes_requested' },
      });
      return data.profiles ?? data;
    },
    enabled: tab === 'pending_review',
  });
  const waitingCount = tab === 'changes_requested' ? profiles?.length ?? 0 : waiting?.length ?? 0;

  const { data: categories } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['admin-categories-list'],
    queryFn: async () => {
      const { data } = await api.get('/admin/categories');
      return data.categories ?? data;
    },
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.patch('/admin/reviews/bulk-approve', { profile_ids: ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setSelectedIds(new Set());
      toast.success('Profiles approved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Bulk approve failed');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === (profiles?.length ?? 0)) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set((profiles ?? []).map((p) => p.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'pending_review'
              ? `${profiles?.length ?? 0} profiles pending review`
              : `${profiles?.length ?? 0} profiles waiting on the talent`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setChecklistOpen(true)}>
            Edit checklist
          </Button>
          {tab === 'pending_review' && selectedIds.size > 0 && (
            <Button
              loading={bulkApprove.isPending}
              onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
            >
              Approve Selected ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Tabs: your turn vs their turn */}
      <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm">
        {(
          [
            { value: 'pending_review', label: 'Needs review' },
            { value: 'changes_requested', label: 'Waiting on talent' },
          ] as { value: QueueTab; label: string }[]
        ).map((t) => {
          const active = tab === t.value;
          const n = t.value === 'changes_requested' ? waitingCount : undefined;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setTab(t.value);
                setSelectedIds(new Set());
              }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              {typeof n === 'number' && n > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Categories</option>
          {(categories ?? []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-200" />
          ))}
        </div>
      ) : (profiles ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-500">
          <p className="text-lg font-medium">
            {tab === 'pending_review' ? 'No profiles pending review' : 'Nobody is waiting on changes'}
          </p>
          <p className="mt-1 text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {tab === 'pending_review' && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === (profiles?.length ?? 0) && (profiles?.length ?? 0) > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Talent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Category
                </th>
                {tab === 'changes_requested' && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Asked for
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {tab === 'pending_review' ? 'Submitted' : 'Asked'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(profiles ?? []).map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50">
                  {tab === 'pending_review' && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(profile.id)}
                        onChange={() => toggleSelect(profile.id)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <span>{profile.talent_users?.full_name ?? 'Unknown'}</span>
                      <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
                    </div>
                    {tab === 'pending_review' && profile.resubmitted_at && (
                      <p className="mt-0.5 text-xs text-emerald-700">
                        Resubmitted {timeAgo(profile.resubmitted_at)} after you asked for changes
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {profile.categories?.name ?? 'N/A'}
                  </td>
                  {tab === 'changes_requested' && (
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex flex-wrap gap-1">
                        {(profile.requested_changes ?? []).map((c, i) => (
                          <span key={`${c.key}-${i}`} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200">
                            {c.label}
                          </span>
                        ))}
                      </div>
                      {profile.changes_whatsapp_sent === false && (
                        <p className="mt-1 text-[11px] text-amber-700">WhatsApp not sent</p>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-500" title={tab === 'pending_review' ? profile.updated_at : profile.changes_requested_at ?? ''}>
                    {tab === 'pending_review'
                      ? formatDate(profile.updated_at)
                      : timeAgo(profile.changes_requested_at) || formatDate(profile.changes_requested_at ?? profile.updated_at)}
                  </td>
                  <td className="px-4 py-3">
                    {tab === 'pending_review' ? (
                      <Badge variant="yellow">Pending</Badge>
                    ) : (
                      <Badge variant="gray">Waiting on talent</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/reviews/${profile.id}`}>
                      <Button variant="ghost" size="sm">
                        {tab === 'pending_review' ? 'Review' : 'View'}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReviewChecklistModal isOpen={checklistOpen} onClose={() => setChecklistOpen(false)} />
    </div>
  );
}
