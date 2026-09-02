'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/formatDate';

type PipelineStage = 'all' | 'signed_up' | 'onboarding_course' | 'basic_profile' | 'job_profile' | 'final_review' | 'live' | 'no_response';

interface SignupRow {
  id: string;
  full_name: string;
  phone?: string | null;
  email?: string | null;
  current_location?: string | null;
  approval_status: string;
  pipeline_stage?: string;
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
  by_pipeline_stage?: Record<string, number>;
}

interface AutoApproveSetting {
  enabled: boolean;
}

const PIPELINE_STAGES: { value: PipelineStage; label: string; color: string; bgColor: string }[] = [
  { value: 'signed_up', label: 'Signed up', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  { value: 'onboarding_course', label: 'Onboarding course', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
  { value: 'basic_profile', label: 'Basic profile', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  { value: 'job_profile', label: 'Job profile', color: 'text-teal-700', bgColor: 'bg-teal-50 border-teal-200' },
  { value: 'final_review', label: 'Final review', color: 'text-violet-700', bgColor: 'bg-violet-50 border-violet-200' },
  { value: 'live', label: 'Live', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200' },
  { value: 'no_response', label: 'No response / inactive', color: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200' },
];

const PIPELINE_STAGE_COLORS: Record<string, string> = {
  signed_up: 'bg-purple-100 text-purple-700 border border-purple-200',
  onboarding_course: 'bg-amber-100 text-amber-700 border border-amber-200',
  basic_profile: 'bg-orange-100 text-orange-700 border border-orange-200',
  job_profile: 'bg-teal-100 text-teal-700 border border-teal-200',
  final_review: 'bg-violet-100 text-violet-700 border border-violet-200',
  live: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  no_response: 'bg-gray-100 text-gray-600 border border-gray-200',
};

function PipelineStageBadge({ stage }: { stage?: string }) {
  if (!stage) return <span className="text-gray-400">—</span>;
  const cls = PIPELINE_STAGE_COLORS[stage] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  const label = PIPELINE_STAGES.find((s) => s.value === stage)?.label ?? stage;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function UserApprovals() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('all');
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
    queryKey: ['signups', debounced, pipelineStage, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 20, pipeline_stage: pipelineStage };
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

  const updatePipelineStageMut = useMutation({
    mutationFn: async ({ userId, stage }: { userId: string; stage: string }) =>
      (await api.patch(`/admin/user-approvals/${userId}/pipeline-stage`, { stage })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['signups'] });
      qc.invalidateQueries({ queryKey: ['signup-stats'] });
      toast.success('Pipeline stage updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update stage'),
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
            Track talent through the onboarding pipeline. Stages sync with Squad Hire CRM.
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

      {/* Pipeline Stage Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {PIPELINE_STAGES.map((stage) => (
          <button
            key={stage.value}
            type="button"
            onClick={() => {
              setPipelineStage(stage.value);
              setPage(1);
            }}
            className={`rounded-xl border p-3 text-left shadow-sm transition ${
              pipelineStage === stage.value
                ? `${stage.bgColor} border-2`
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className={`text-xs font-medium uppercase tracking-wider ${stage.color}`}>
              {stage.label}
            </div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {stats?.by_pipeline_stage?.[stage.value] ?? 0}
            </div>
          </button>
        ))}
      </div>

      {/* Pipeline Stage Filter Pills */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setPipelineStage('all');
              setPage(1);
            }}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              pipelineStage === 'all'
                ? 'bg-gray-900 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {PIPELINE_STAGES.map((stage) => (
            <button
              key={stage.value}
              type="button"
              onClick={() => {
                setPipelineStage(stage.value);
                setPage(1);
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                pipelineStage === stage.value
                  ? `${stage.bgColor} ${stage.color} ring-2 ring-offset-1 ring-gray-300`
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {stage.label}
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
                      Pipeline Stage
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
                        <PipelineStageBadge stage={u.pipeline_stage} />
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            u.approval_status === 'approved'
                              ? 'bg-emerald-100 text-emerald-700'
                              : u.approval_status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : u.suspended
                              ? 'bg-red-100 text-red-700'
                              : u.is_active === false
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {u.suspended ? 'Suspended' : u.is_active === false ? 'Inactive' : u.approval_status}
                        </span>
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