'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface SignupRow {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  current_location?: string | null;
  approval_status: string;
  is_active?: boolean;
  suspended?: boolean;
  blacklisted?: boolean;
  created_at: string;
  rejection_reason?: string | null;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  active: number;
  suspended: number;
}

interface AutoApproveSetting {
  enabled: boolean;
}

function StatusBadge({
  status,
  isActive,
  suspended,
}: {
  status: string;
  isActive?: boolean;
  suspended?: boolean;
}) {
  if (suspended) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Suspended
      </span>
    );
  }
  if (isActive === false) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
        Inactive
      </span>
    );
  }
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border border-amber-200',
    approved: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border border-red-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-700 border border-gray-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function UserApprovals() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: stats } = useQuery<Stats>({
    queryKey: ['signup-stats'],
    queryFn: async () => (await api.get('/admin/user-approvals/stats')).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['signups', debounced, status, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20, approval_status: status };
      if (debounced) params.search = debounced;
      const { data } = await api.get('/admin/user-approvals', { params });
      return data as { users: SignupRow[]; total: number; total_pages: number; page: number };
    },
  });

  const { data: autoApprove } = useQuery<AutoApproveSetting>({
    queryKey: ['autoApproveSetting'],
    queryFn: async () => (await api.get('/admin/settings/auto-approve')).data,
  });

  const autoApproveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data } = await api.patch('/admin/settings/auto-approve', { enabled });
      return data as { enabled: boolean; approvedCount: number };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['autoApproveSetting'] });
      qc.invalidateQueries({ queryKey: ['signups'] });
      qc.invalidateQueries({ queryKey: ['signup-stats'] });
      if (res.enabled) {
        toast.success(
          res.approvedCount > 0
            ? `Auto-approval on — ${res.approvedCount} pending signup${res.approvedCount === 1 ? '' : 's'} marked approved`
            : 'Auto-approval enabled',
        );
      } else {
        toast.success('Auto-approval disabled');
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update setting'),
  });

  const approveMut = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/admin/user-approvals/${id}/approve`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signups'] });
      qc.invalidateQueries({ queryKey: ['signup-stats'] });
      toast.success('Approved');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Approve failed'),
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.patch(`/admin/user-approvals/${id}/reject`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signups'] });
      qc.invalidateQueries({ queryKey: ['signup-stats'] });
      toast.success('Rejected');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reject failed'),
  });

  const bulkApproveMut = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/admin/user-approvals/bulk-approve', { ids })).data,
    onSuccess: (res: any) => {
      const ok = (res.results ?? []).filter((r: any) => r.success).length;
      toast.success(`${ok} signup${ok === 1 ? '' : 's'} approved`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['signups'] });
      qc.invalidateQueries({ queryKey: ['signup-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Bulk approve failed'),
  });

  const users = data?.users ?? [];
  const totalPages = data?.total_pages ?? 1;
  const autoApproveEnabled = autoApprove?.enabled === true;

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    const pendingIds = users.filter((u) => u.approval_status === 'pending').map((u) => u.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const n = new Set(prev);
        pendingIds.forEach((id) => n.delete(id));
        return n;
      });
    } else {
      setSelected((prev) => {
        const n = new Set(prev);
        pendingIds.forEach((id) => n.add(id));
        return n;
      });
    }
  };

  const handleToggleAutoApprove = () => {
    if (autoApproveMutation.isPending) return;
    const next = !autoApproveEnabled;
    if (next && (stats?.pending ?? 0) > 0) {
      const n = stats?.pending ?? 0;
      const ok = confirm(
        `Enabling auto-approval will mark all ${n} pending signup${n === 1 ? '' : 's'} as approved. They can already use the app either way. Continue?`,
      );
      if (!ok) return;
    }
    autoApproveMutation.mutate(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sign-ups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review talent accounts after they sign up. New talent can use the app immediately —
            approval is a separate review, not a wait.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => bulkApproveMut.mutate([...selected])}
              disabled={bulkApproveMut.isPending}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {bulkApproveMut.isPending ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
          <Link
            href="/approvals/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Preview Signup Form
          </Link>
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Auto-approve new signups</h2>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                autoApproveEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {autoApproveEnabled ? 'On' : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            When on, new accounts skip the review queue and are marked approved. Talent can already
            use the app while pending.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoApproveEnabled}
          onClick={handleToggleAutoApprove}
          disabled={autoApproveMutation.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            autoApproveEnabled ? 'bg-indigo-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              autoApproveEnabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <button
          type="button"
          onClick={() => {
            setStatus('all');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            status === 'all' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Total</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats?.total ?? '-'}</div>
          <div className="text-xs text-gray-500">{stats?.active ?? 0} active</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus('pending');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            status === 'pending' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider text-amber-700">Pending review</div>
          <div className="mt-1 text-2xl font-bold text-amber-900">{stats?.pending ?? '-'}</div>
          <div className="text-xs text-amber-700/70">Needs review</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus('approved');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            status === 'approved'
              ? 'border-emerald-300 bg-emerald-50'
              : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider text-emerald-700">Approved</div>
          <div className="mt-1 text-2xl font-bold text-emerald-800">{stats?.approved ?? '-'}</div>
          <div className="text-xs text-emerald-700/70">Reviewed</div>
        </button>
        <button
          type="button"
          onClick={() => {
            setStatus('rejected');
            setPage(1);
          }}
          className={`rounded-xl border p-4 text-left shadow-sm transition ${
            status === 'rejected' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50'
          }`}
        >
          <div className="text-xs font-medium uppercase tracking-wider text-red-700">Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-800">{stats?.rejected ?? '-'}</div>
          <div className="text-xs text-red-700/70">Declined</div>
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Suspended</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{stats?.suspended ?? '-'}</div>
          <div className="text-xs text-gray-500">Blocked</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                status === s
                  ? 'bg-gray-900 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <svg
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
            />
          </svg>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">No sign-ups found</p>
            <p className="text-sm text-gray-500">Adjust filters or wait for new talent to sign up.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        onChange={toggleAll}
                        checked={
                          users.filter((u) => u.approval_status === 'pending').length > 0 &&
                          users
                            .filter((u) => u.approval_status === 'pending')
                            .every((u) => selected.has(u.id))
                        }
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Talent
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email / Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Joined
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled={u.approval_status !== 'pending'}
                          checked={selected.has(u.id)}
                          onChange={() => toggleOne(u.id)}
                          className="rounded border-gray-300 disabled:opacity-30"
                        />
                      </td>
                      <td
                        className="cursor-pointer px-4 py-3"
                        onClick={() => router.push(`/users/${u.id}`)}
                      >
                        <div className="text-sm font-medium text-gray-900">{u.full_name}</div>
                        {u.current_location && (
                          <div className="text-xs text-gray-400">{u.current_location}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[220px] truncate text-sm text-gray-700">{u.email || '—'}</div>
                        <div className="text-xs text-gray-500">{u.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={u.approval_status}
                          isActive={u.is_active}
                          suspended={!!u.suspended}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/users/${u.id}`);
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            View
                          </button>
                          {u.approval_status === 'pending' && (
                            <>
                              <button
                                disabled={approveMut.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  approveMut.mutate(u.id);
                                }}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                disabled={rejectMut.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const r = prompt('Rejection reason (optional)');
                                  if (r !== null) rejectMut.mutate({ id: u.id, reason: r });
                                }}
                                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <div className="text-sm text-gray-600">
                  Page {page} of {totalPages} · {data?.total} total
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
