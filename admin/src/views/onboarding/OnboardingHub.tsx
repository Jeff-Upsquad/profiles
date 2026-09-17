'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useStageLabels } from '@/hooks/useStageLabels';
import { cleanPhoneForLink, formatIndianPhone } from '@/lib/phone';
import { crmLookupUrl } from '@/lib/crmUrl';
import TalentJourneyPanel from './TalentJourneyPanel';
import CrmChatDrawer from './CrmChatDrawer';
import {
  CATEGORY_BADGE,
  CATEGORY_TABS,
  JOURNEY_STEPS,
  PIPELINE_STAGES,
  STAGE_BY_VALUE,
  initials,
  timeAgo,
  type HubAttention,
  type HubCategory,
  type HubRow,
  type HubStats,
  type PipelineStage,
  type TalentPipelineConfig,
} from './hubTypes';

interface HubResponse {
  users: HubRow[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

const ATTENTION_CHIPS: { value: HubAttention; label: string; hint: string }[] = [
  { value: 'pending_approval', label: 'Pending approval', hint: 'New accounts waiting for approval' },
  { value: 'needs_review', label: 'Needs review', hint: 'Job profiles submitted for review' },
  { value: 'course_pending', label: 'Course not done', hint: 'Still on the onboarding course' },
  { value: 'basic_incomplete', label: 'Basic incomplete', hint: 'Course done, basic profile still missing sections' },
  { value: 'no_job_profile', label: 'No job profile', hint: 'Basic profile done, no job profile submitted yet' },
];

// pipeline_stage → lead status key, so CRM stage names from the mapping apply.
const STAGE_TO_LEAD_KEY: Record<PipelineStage, string> = {
  signed_up: 'signed_up',
  onboarding_course: 'onboarding_training',
  basic_profile: 'basic_profile',
  job_profile: 'job_profile',
  final_review: 'final_review',
  live: 'live',
  no_response: 'no_response',
};

/** Compact 5-dot journey strip for a row. */
function JourneyDots({ row }: { row: HubRow }) {
  const j = row.journey;
  return (
    <div className="flex items-center gap-1" title={
      JOURNEY_STEPS.map((s) => `${s.label}: ${j?.[s.key] ? 'done' : 'pending'}`).join('\n')
    }>
      {JOURNEY_STEPS.map((s, i) => {
        const done = !!j?.[s.key];
        const prevDone = i === 0 || !!j?.[JOURNEY_STEPS[i - 1].key];
        const current = !done && prevDone;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                done
                  ? 'bg-green-500 text-white'
                  : current
                    ? 'border-2 border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border border-gray-300 bg-white text-gray-400'
              }`}
              aria-label={s.label}
            >
              {done ? '✓' : i + 1}
            </span>
            {i < JOURNEY_STEPS.length - 1 && (
              <span className={`h-0.5 w-3 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ row }: { row: HubRow }) {
  const cls = row.suspended
    ? 'bg-red-100 text-red-700'
    : row.approval_status === 'rejected'
      ? 'bg-red-100 text-red-700'
      : row.approval_status === 'pending'
        ? 'bg-amber-100 text-amber-800'
        : row.is_active === false
          ? 'bg-gray-100 text-gray-600'
          : 'bg-emerald-100 text-emerald-700';
  const label = row.suspended
    ? 'Suspended'
    : row.approval_status === 'rejected'
      ? 'Rejected'
      : row.approval_status === 'pending'
        ? 'Pending'
        : row.is_active === false
          ? 'Inactive'
          : 'Approved';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

export default function OnboardingHub() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { can, isFullAdmin } = useAuth();
  const { labelFor } = useStageLabels();
  const canEdit = isFullAdmin || can('approvals', 'edit');

  // All list state lives in the URL so deep links + back/forward work.
  const category = (searchParams.get('category') || 'all') as HubCategory;
  const stage = searchParams.get('stage') || 'all';
  const talentStage = searchParams.get('talent_stage') || 'all';
  const attention = (searchParams.get('attention') || '') as HubAttention | '';
  const sort = searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';
  const search = searchParams.get('search') || '';
  const page = Number(searchParams.get('page') || '1');
  const selectedId = searchParams.get('selected');
  const chatPhone = searchParams.get('chat');
  const chatName = searchParams.get('chat_name');

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '' || v === 'all') params.delete(k);
        else params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Debounced search input → URL.
  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => updateQuery({ search: searchInput, page: null }), 350);
    return () => clearTimeout(t);
  }, [searchInput, search, updateQuery]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: stats } = useQuery<HubStats>({
    queryKey: ['onboarding-hub-stats', category],
    queryFn: async () => (await api.get('/admin/user-approvals/hub/stats', { params: { category } })).data,
  });

  const { data: pipelines } = useQuery<{ pipelines: Record<string, TalentPipelineConfig> }>({
    queryKey: ['onboarding-talent-pipelines'],
    queryFn: async () => (await api.get('/admin/user-approvals/talent-pipelines')).data,
    staleTime: 60_000,
  });

  const { data, isLoading, isPlaceholderData } = useQuery<HubResponse>({
    queryKey: ['onboarding-hub', category, stage, talentStage, attention, sort, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25, category, sort };
      if (stage !== 'all') params.pipeline_stage = stage;
      if (talentStage !== 'all') params.talent_stage = talentStage;
      if (attention) params.attention = attention;
      if (search) params.search = search;
      return (await api.get('/admin/user-approvals/hub', { params })).data;
    },
    placeholderData: keepPreviousData,
  });

  const { data: autoApprove } = useQuery<{ enabled: boolean }>({
    queryKey: ['autoApproveSetting'],
    queryFn: async () => (await api.get('/admin/settings/auto-approve')).data,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['onboarding-hub'] });
    qc.invalidateQueries({ queryKey: ['onboarding-hub-stats'] });
  };

  const autoApproveMut = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await api.patch('/admin/settings/auto-approve', { enabled })).data as { enabled: boolean; approvedCount: number },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['autoApproveSetting'] });
      invalidate();
      toast.success(
        res.enabled
          ? res.approvedCount > 0
            ? `Auto-approval on — ${res.approvedCount} pending sign-up${res.approvedCount === 1 ? '' : 's'} approved`
            : 'Auto-approval on'
          : 'Auto-approval off',
      );
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update setting'),
  });

  const bulkApproveMut = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/admin/user-approvals/bulk-approve', { ids })).data,
    onSuccess: (res: any) => {
      const ok = (res.results ?? []).filter((r: any) => r.success).length;
      toast.success(`${ok} sign-up${ok === 1 ? '' : 's'} approved`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Bulk approve failed'),
  });

  const users = data?.users ?? [];
  const totalPages = data?.total_pages ?? 1;

  const selectedIndex = useMemo(() => {
    if (!selectedId) return null;
    const i = users.findIndex((u) => u.id === selectedId);
    return i === -1 ? null : i;
  }, [selectedId, users]);

  const openRow = (id: string) => updateQuery({ selected: id });
  const closeRow = useCallback(() => updateQuery({ selected: null }), [updateQuery]);
  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (selectedIndex === null) return;
      const next = users[selectedIndex + dir];
      if (next) updateQuery({ selected: next.id });
    },
    [selectedIndex, users, updateQuery],
  );
  const openChat = useCallback(
    (phone: string, name: string) => updateQuery({ chat: phone, chat_name: name }),
    [updateQuery],
  );
  const closeChat = useCallback(() => updateQuery({ chat: null, chat_name: null }), [updateQuery]);

  // Talent-board chips: union of stages across linked talent pipelines (for
  // "All"), or just the selected category's pipeline.
  const talentStages = useMemo(() => {
    const all = pipelines?.pipelines ?? {};
    const picked = category === 'all' ? Object.values(all) : all[category] ? [all[category]] : [];
    const seen = new Map<string, { id: string; name: string; sort_order: number }>();
    for (const p of picked) for (const s of p.stages) if (!seen.has(s.id)) seen.set(s.id, s);
    return [...seen.values()].sort((a, b) => a.sort_order - b.sort_order);
  }, [pipelines, category]);
  const talentPipelineLinked = talentStages.length > 0;

  const pendingOnPage = users.filter((u) => u.approval_status === 'pending');
  const allPendingSelected = pendingOnPage.length > 0 && pendingOnPage.every((u) => selected.has(u.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allPendingSelected) pendingOnPage.forEach((u) => n.delete(u.id));
      else pendingOnPage.forEach((u) => n.add(u.id));
      return n;
    });
  };

  const stageCount = (s: string) => stats?.by_pipeline_stage?.[s] ?? 0;
  const formTypeForLabels = category === 'all' ? 'creative' : category;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="mt-1 text-sm text-gray-500">
            Every sign-up and how far they&apos;ve got — course, basic profile, job profile, portfolio —
            with both CRM boards in sync. Click a row to assist.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && selected.size > 0 && (
            <button
              onClick={() => bulkApproveMut.mutate([...selected])}
              disabled={bulkApproveMut.isPending}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {bulkApproveMut.isPending ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
          {canEdit && (
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              title="When on, new accounts skip the approval queue"
            >
              <span>Auto-approve</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoApprove?.enabled === true}
                disabled={autoApproveMut.isPending}
                onClick={() => {
                  const next = !(autoApprove?.enabled === true);
                  if (next && (stats?.pending ?? 0) > 0) {
                    const n = stats?.pending ?? 0;
                    if (!confirm(`This will approve all ${n} pending sign-up${n === 1 ? '' : 's'} now. Continue?`)) return;
                  }
                  autoApproveMut.mutate(next);
                }}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  autoApprove?.enabled ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    autoApprove?.enabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>
          )}
          <Link
            href="/approvals/preview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Preview signup form ↗
          </Link>
        </div>
      </div>

      {/* Category tabs + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                updateQuery({ category: tab.value, talent_stage: null, page: null });
                setSelected(new Set());
              }}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${
                category === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, email, phone…"
            className="w-72 rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <svg className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
        </div>
      </div>

      {/* Funnel — candidate pipeline (synced with CRM) */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Sign-up journey · candidate pipeline
          </p>
          <p className="text-[11px] text-gray-400">{stats?.total ?? 0} total · synced with SquadHire CRM</p>
        </div>
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-7">
          {PIPELINE_STAGES.map((s) => {
            const active = stage === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => updateQuery({ stage: active ? null : s.value, page: null })}
                className={`rounded-xl border p-3 text-left transition ${
                  active ? `${s.chip} border-2 shadow-sm` : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span className="truncate text-[11px] font-medium text-gray-600">
                    {labelFor(formTypeForLabels, STAGE_TO_LEAD_KEY[s.value], s.label)}
                  </span>
                </div>
                <div className="mt-1 text-xl font-bold text-gray-900">{stageCount(s.value)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Talent board — CRM post-onboarding pipeline */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Talent board · after going live
          </p>
          <p className="text-[11px] text-gray-400">
            {talentPipelineLinked
              ? `${stats?.in_talent_pipeline ?? 0} on the board · synced with SquadHire CRM`
              : 'not linked'}
          </p>
        </div>
        {talentPipelineLinked ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {talentStages.map((s) => {
              const active = talentStage === s.id;
              const n = stats?.by_talent_stage?.[s.id] ?? 0;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => updateQuery({ talent_stage: active ? null : s.id, page: null })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'border-sky-300 bg-sky-50 text-sky-700 ring-2 ring-sky-200 ring-offset-1'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {s.name}
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-sky-100' : 'bg-gray-100 text-gray-600'}`}>{n}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => updateQuery({ talent_stage: talentStage === 'none' ? null : 'none', page: null })}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                talentStage === 'none'
                  ? 'border-gray-400 bg-gray-100 text-gray-800 ring-2 ring-gray-200 ring-offset-1'
                  : 'border-dashed border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              Not on board
            </button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            Link the CRM talent pipeline for each category under{' '}
            <Link href="/crm-mapping" className="text-indigo-600 underline">CRM Mapping</Link> to see and move
            talents through Welcome → Download App → Webinars → Onboarding completed here.
          </p>
        )}
      </div>

      {/* Attention chips + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Needs attention</span>
          {ATTENTION_CHIPS.map((c) => {
            const active = attention === c.value;
            const n =
              c.value === 'pending_approval'
                ? stats?.attention.pending_approval
                : c.value === 'needs_review'
                  ? stats?.attention.needs_review
                  : undefined;
            return (
              <button
                key={c.value}
                type="button"
                title={c.hint}
                onClick={() => updateQuery({ attention: active ? null : c.value, page: null })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c.label}
                {typeof n === 'number' && n > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-amber-100 text-amber-800'}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <select
          value={sort}
          onChange={(e) => updateQuery({ sort: e.target.value === 'oldest' ? 'oldest' : null, page: null })}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {/* List */}
      <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${isPlaceholderData ? 'opacity-70 transition-opacity' : ''}`}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm font-medium text-gray-700">No sign-ups match</p>
            <p className="text-sm text-gray-500">Clear a filter or wait for new talent to sign up.</p>
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="text-left text-[11px] font-medium uppercase tracking-wider text-gray-500">
                  <th className="w-8 px-3 py-2.5">
                    {canEdit && pendingOnPage.length > 0 && (
                      <input type="checkbox" checked={allPendingSelected} onChange={toggleAll} className="rounded border-gray-300" title="Select pending on this page" />
                    )}
                  </th>
                  <th className="px-3 py-2.5">Talent</th>
                  <th className="px-3 py-2.5">Journey</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isSel = u.id === selectedId;
                  const phone = cleanPhoneForLink(u.phone);
                  const st = STAGE_BY_VALUE[u.pipeline_stage] ?? STAGE_BY_VALUE.signed_up;
                  const j = u.journey;
                  const hint = j
                    ? !j.onboarding_completed
                      ? j.course_started ? 'On the course' : 'Course not started'
                      : !j.basic_profile_completed
                        ? `Basic: ${j.basic_missing.length} missing`
                        : !j.job_profile_completed
                          ? j.job_profiles.draft > 0 ? 'Job profile in draft' : 'No job profile'
                          : j.job_profiles.pending_review > 0
                            ? 'Profile awaiting review'
                            : !j.portfolio_completed
                              ? 'No portfolio yet'
                              : 'Journey complete'
                    : '';
                  return (
                    <tr
                      key={u.id}
                      onClick={() => openRow(u.id)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canEdit && u.approval_status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selected.has(u.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                const n = new Set(prev);
                                if (n.has(u.id)) n.delete(u.id);
                                else n.add(u.id);
                                return n;
                              })
                            }
                            className="rounded border-gray-300"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                            {initials(u.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-medium text-gray-900">{u.full_name}</p>
                              {u.categories.map((c) => {
                                const b = CATEGORY_BADGE[c];
                                return b ? (
                                  <span key={c} className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${b.cls}`}>{b.label}</span>
                                ) : null;
                              })}
                            </div>
                            <p className="truncate text-xs text-gray-500">
                              {u.phone ? formatIndianPhone(u.phone) : '—'}
                              {u.email ? ` · ${u.email}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <JourneyDots row={u} />
                        <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {labelFor(u.lead?.form_type ?? u.categories[0], STAGE_TO_LEAD_KEY[u.pipeline_stage], st.label)}
                          </span>
                          {u.crm_talent_stage_name && (
                            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700" title={`Talent board · ${u.crm_talent_pipeline_name ?? ''}`}>
                              {u.crm_talent_stage_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge row={u} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500" title={u.created_at}>
                        {timeAgo(u.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {phone && (
                            <button
                              type="button"
                              onClick={() => openChat(phone, u.full_name)}
                              title="CRM chat"
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-emerald-600 hover:bg-emerald-50"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                            </button>
                          )}
                          {phone && (
                            <a
                              href={crmLookupUrl(phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open in CRM"
                              className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:bg-gray-50"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => openRow(u.id)}
                            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Open
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
                <span>
                  Page {page} of {totalPages} · {data?.total} total
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => updateQuery({ page: String(page - 1) })}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => updateQuery({ page: String(page + 1) })}
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

      <TalentJourneyPanel
        userId={selectedId}
        onClose={closeRow}
        onNavigate={navigate}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < users.length - 1}
        currentIndex={selectedIndex}
        totalCount={users.length}
        onOpenChat={openChat}
        canEdit={canEdit}
      />
      <CrmChatDrawer phone={chatPhone} name={chatName} onClose={closeChat} />
    </div>
  );
}
