'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
import RejectDialog from './RejectDialog';
import Modal from '@/components/ui/Modal';
import {
  CATEGORY_BADGE,
  CATEGORY_TABS,
  JOURNEY_STEPS,
  PIPELINE_STAGES,
  STAGE_BY_VALUE,
  initials,
  requestChangesStepLabel,
  talentBoardSteps,
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
  { value: 'needs_review', label: 'Needs review', hint: 'Job profiles submitted for review — your turn' },
  { value: 'waiting_on_talent', label: 'Waiting on talent', hint: 'You asked for changes; the talent has not resubmitted yet' },
  { value: 'course_pending', label: 'Course not done', hint: 'Still on the onboarding course' },
  { value: 'basic_incomplete', label: 'Basic incomplete', hint: 'Course done, basic profile still missing sections' },
  { value: 'no_job_profile', label: 'No job profile', hint: 'Basic profile done, no job profile submitted yet' },
  { value: 'message_failed', label: 'WhatsApp failed', hint: 'A CRM WhatsApp message to this talent failed to send (24-hour window, Meta or technical issue)' },
];

// pipeline_stage → lead status key, so CRM stage names from the mapping apply.
const STAGE_TO_LEAD_KEY: Record<PipelineStage, string> = {
  applicants: 'form_filled',
  application_approved: 'signed_up',
  signed_up: 'signed_up',
  onboarding_course: 'onboarding_training',
  basic_profile: 'basic_profile',
  job_profile: 'job_profile',
  final_review: 'final_review',
  live: 'live',
  no_response: 'no_response',
  rejected: 'rejected',
};

/** Compact journey strip for a row (4 dots when there's no portfolio step). */
function JourneyDots({ row }: { row: HubRow }) {
  const j = row.journey;
  // Sales and accountant talents have no portfolio step.
  const steps = JOURNEY_STEPS.filter(
    (s) => s.key !== 'portfolio_completed' || j?.portfolio_required !== false,
  );
  return (
    <div className="flex items-center gap-1" title={
      steps.map((s) => `${s.label}: ${j?.[s.key] ? 'done' : 'pending'}`).join('\n')
    }>
      {steps.map((s, i) => {
        const done = !!j?.[s.key];
        const prevDone = i === 0 || !!j?.[steps[i - 1].key];
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
            {i < steps.length - 1 && (
              <span className={`h-0.5 w-3 ${done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Talent-board checklist strip for a Live row: App downloaded → Webinar
 * attended → Partner and/or Jobs course (whichever the talent applied for).
 */
function TalentBoardDots({ row }: { row: HubRow }) {
  const j = row.journey;
  if (!j) return null;
  const steps = talentBoardSteps({
    wants_jobs: row.wants_jobs,
    partner_approval_status: row.partner_approval_status,
    talent_board: j.talent_board,
    program_courses: j.program_courses,
  });
  const next = steps.find((s) => !s.done);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1" title={steps.map((s) => `${s.label}: ${s.done ? 'done' : 'pending'} — ${s.detail}`).join('\n')}>
        {steps.map((s, i) => {
          const current = s === next;
          return (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold ${
                  s.done
                    ? 'bg-sky-500 text-white'
                    : current
                      ? 'border-2 border-sky-500 bg-sky-50 text-sky-700'
                      : 'border border-gray-300 bg-white text-gray-400'
                }`}
                aria-label={s.label}
              >
                {s.done ? '✓' : i + 1}
              </span>
              {i < steps.length - 1 && (
                <span className={`h-0.5 w-3 ${s.done ? 'bg-sky-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        Talent board · {next ? `Next: ${next.label}` : 'Checklist complete'}
      </p>
    </div>
  );
}

function StatusBadge({ row, track }: { row: HubRow; track: 'partner' | 'jobs' }) {
  const approvalStatus = row.pipeline_stage === 'rejected'
    ? 'rejected'
    : track === 'partner' ? row.partner_approval_status : row.approval_status;
  const cls = row.suspended
    ? 'bg-red-100 text-red-700'
    : approvalStatus === 'rejected'
      ? 'bg-red-100 text-red-700'
      : approvalStatus === 'pending'
        ? 'bg-amber-100 text-amber-800'
        : row.is_active === false
          ? 'bg-gray-100 text-gray-600'
          : 'bg-emerald-100 text-emerald-700';
  const label = row.suspended
    ? 'Suspended'
    : approvalStatus === 'rejected'
      ? 'Rejected'
      : approvalStatus === 'pending'
        ? 'Pending'
        : row.is_active === false
          ? 'Inactive'
          : 'Approved';
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{label}</span>;
}

/** Small amber "N under request changes" count shown beside a stage's total. */
function RcCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      title={`${n} under request changes`}
      className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold leading-4 text-amber-800"
    >
      <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
      </svg>
      {n}
    </span>
  );
}

export default function OnboardingHub({
  track = 'partner',
  rejectedOnly = false,
  cancelledOnly = false,
}: { track?: 'partner' | 'jobs'; rejectedOnly?: boolean; cancelledOnly?: boolean }) {
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
  const view = cancelledOnly ? 'cancelled' : rejectedOnly ? 'rejected' : 'active';
  // Rejected / Cancelled are standalone sections: no funnel, no attention chips.
  const sectionOnly = rejectedOnly || cancelledOnly;

  useEffect(() => {
    if (!sectionOnly && searchParams.get('view') === 'rejected') {
      router.replace(`/rejected-candidates${track === 'jobs' ? '?track=jobs' : ''}`);
    }
  }, [sectionOnly, router, searchParams, track]);

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
    queryKey: ['onboarding-hub-stats', track, category],
    queryFn: async () => (await api.get('/admin/user-approvals/hub/stats', { params: { category, track } })).data,
  });

  const { data: pipelines } = useQuery<{ pipelines: Record<string, TalentPipelineConfig> }>({
    queryKey: ['onboarding-talent-pipelines'],
    queryFn: async () => (await api.get('/admin/user-approvals/talent-pipelines')).data,
    staleTime: 60_000,
  });

  const { data, isLoading, isPlaceholderData } = useQuery<HubResponse>({
    queryKey: ['onboarding-hub', track, view, category, stage, talentStage, attention, sort, search, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 25, category, sort, track, view };
      if (view === 'active') {
        if (stage !== 'all') params.pipeline_stage = stage;
        if (talentStage !== 'all') params.talent_stage = talentStage;
        if (attention) params.attention = attention;
      }
      if (search) params.search = search;
      return (await api.get('/admin/user-approvals/hub', { params })).data;
    },
    placeholderData: keepPreviousData,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['onboarding-hub'] });
    qc.invalidateQueries({ queryKey: ['onboarding-hub-stats'] });
  };

  const bulkApproveMut = useMutation({
    mutationFn: async (ids: string[]) => (await api.post('/admin/user-approvals/bulk-approve-partner', { ids })).data,
    onSuccess: (res: any) => {
      const ok = (res.results ?? []).filter((r: any) => r.success).length;
      toast.success(`${ok} sign-up${ok === 1 ? '' : 's'} approved`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Bulk approve failed'),
  });

  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const decisionPath = (id: string, decision: 'approve' | 'reject') =>
    `/admin/user-approvals/${id}/${decision === 'approve'
      ? track === 'partner' ? 'approve-partner' : 'reinstate-jobs'
      : track === 'partner' ? 'reject-partner' : 'reject-jobs'}`;
  const approveMut = useMutation({
    mutationFn: async (id: string) => (await api.patch(decisionPath(id, 'approve'))).data,
    onSuccess: () => {
      toast.success('Approved · moved to Application Approved');
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Approve failed'),
  });
  const rejectMut = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.patch(decisionPath(id, 'reject'), { reason })).data,
    onSuccess: () => {
      toast.success('Rejected · talent notified');
      setRejectTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reject failed'),
  });

  const restoreCancelledMut = useMutation({
    mutationFn: async (id: string) => (await api.patch(`/admin/user-approvals/${id}/restore-cancelled`)).data,
    onSuccess: () => {
      toast.success('Restored to onboarding');
      updateQuery({ selected: null });
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Restore failed'),
  });

  const [restoreTarget, setRestoreTarget] = useState<HubRow | null>(null);
  const restoreMut = useMutation({
    mutationFn: async ({ id, selectedTrack }: { id: string; selectedTrack: 'partner' | 'jobs' | 'both' }) =>
      (await api.patch(`/admin/user-approvals/${id}/restore-rejected`, { track: selectedTrack })).data,
    onSuccess: () => {
      toast.success('Restored to Signed Up / Applicants');
      setRestoreTarget(null);
      updateQuery({ selected: null });
      invalidate();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Restore failed'),
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
  // Graduated stage ("Onboarding completed") is hidden — those talents live in
  // Partner Program / Jobs now, not in the onboarding queue.
  // Jobs has a board per category (jobs_<category>) plus the shared `jobs`
  // board; same-named stages across boards collapse into one chip whose id is
  // the comma-joined stage ids.
  const talentStages = useMemo(() => {
    const all = pipelines?.pipelines ?? {};
    const isJobsKey = (key: string) => key === 'jobs' || key.startsWith('jobs_');
    const inTrack = Object.entries(all).filter(([key]) => (track === 'jobs') === isJobsKey(key));
    const picked = category === 'all'
      ? inTrack.map(([, cfg]) => cfg)
      : inTrack.filter(([key]) => key === (track === 'jobs' ? `jobs_${category}` : category)).map(([, cfg]) => cfg);
    const byName = new Map<string, { ids: string[]; name: string; sort_order: number }>();
    for (const p of picked) {
      for (const s of p.stages) {
        const key = s.name.trim().toLowerCase();
        const hit = byName.get(key);
        if (hit) hit.ids.push(s.id);
        else byName.set(key, { ids: [s.id], name: s.name, sort_order: s.sort_order });
      }
    }
    return [...byName.entries()]
      .filter(([key]) => key !== 'onboarding completed')
      .map(([, s]) => ({ id: s.ids.join(','), name: s.name, sort_order: s.sort_order }))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [pipelines, category, track]);
  const talentPipelineLinked = talentStages.length > 0;

  // Live candidates are grouped under the talent-board tabs — every Live
  // candidate sits in exactly one tab ('none' = not on the board yet).
  const liveTabs = useMemo(
    () => [...talentStages.map((s) => ({ id: s.id, name: s.name })), { id: 'none', name: 'Not on board' }],
    [talentStages],
  );
  const sumIds = (m: Record<string, number> | undefined, id: string) =>
    id.split(',').reduce((n, part) => n + (m?.[part] ?? 0), 0);
  const liveCount = (id: string) => sumIds(stats?.live_by_talent_stage, id);
  const liveRcCount = (id: string) => sumIds(stats?.rc_live_by_talent_stage, id);
  const showLiveTabs = !sectionOnly && stage === 'live' && talentPipelineLinked;
  useEffect(() => {
    if (!showLiveTabs || !stats) return;
    if (liveTabs.some((t) => t.id === talentStage)) return;
    const first = liveTabs.find((t) => sumIds(stats.live_by_talent_stage, t.id) > 0) ?? liveTabs[0];
    updateQuery({ talent_stage: first.id, page: null });
  }, [showLiveTabs, stats, liveTabs, talentStage, updateQuery]);

  const pendingOnPage = users.filter((u) => track === 'partner' && u.partner_approval_status === 'pending');
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
  const stageRcCount = (s: string) => stats?.rc_by_pipeline_stage?.[s] ?? 0;
  const formTypeForLabels = category === 'all' ? 'creative' : category;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cancelledOnly ? 'Cancelled Applicants' : rejectedOnly ? 'Rejected / Disqualified' : track === 'partner' ? 'Partner Program Onboarding' : 'Jobs Onboarding'}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {cancelledOnly
              ? 'Applications cancelled after requested changes went unanswered (2 reminders + a final warning). The talent is locked out except Contact Support until you restore them.'
              : rejectedOnly
              ? 'Review rejection reasons, open the full talent journey, and restore applications to the start of onboarding.'
              : <>Every sign-up and how far they&apos;ve got — course, basic profile, job profile, portfolio —
                with both CRM boards in sync. Click a row to assist.</>}
          </p>
        </div>
        {!sectionOnly && <div className="flex flex-wrap items-center gap-2">
          {canEdit && selected.size > 0 && (
            <button
              onClick={() => bulkApproveMut.mutate([...selected])}
              disabled={bulkApproveMut.isPending}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {bulkApproveMut.isPending ? 'Approving…' : `Approve ${selected.size} selected`}
            </button>
          )}
          <Link
            href={`https://squadhire.upsquadconnect.com/apply/${category === 'all' ? 'creative' : category}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Preview role signup ↗
          </Link>
        </div>}
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
      {!sectionOnly && (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Sign-up journey · candidate pipeline
          </p>
          <p className="text-[11px] text-gray-400">
            {stats?.total ?? 0} total
            {(stats?.attention.waiting_on_talent ?? 0) > 0 && (
              <> · <span className="text-amber-700">{stats?.attention.waiting_on_talent} under request changes</span></>
            )}
            {' '}· synced with SquadHire CRM
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {PIPELINE_STAGES.map((s) => {
            const active = stage === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => updateQuery({
                  stage: active ? null : s.value,
                  // The talent board only applies to Live — drop its filter when leaving Live.
                  ...(s.value === 'live' && !active ? {} : { talent_stage: null }),
                  page: null,
                })}
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
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-xl font-bold text-gray-900">{Math.max(0, stageCount(s.value) - stageRcCount(s.value))}</span>
                  <RcCount n={stageRcCount(s.value)} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Talent board — Live candidates grouped by CRM talent-board stage */}
      {!sectionOnly && stage === 'live' && (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Talent board · after going live
          </p>
          <p className="text-[11px] text-gray-400">
            {talentPipelineLinked
              ? `${stageCount('live')} live · synced with SquadHire CRM · completed move to ${track === 'jobs' ? 'Jobs' : 'Partner Program'}`
              : 'not linked'}
          </p>
        </div>
        {talentPipelineLinked ? (
          <div className="flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist" aria-label="Talent board stage">
            {liveTabs.map((t) => {
              const active = talentStage === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => updateQuery({ talent_stage: t.id, page: null, selected: null })}
                  className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    active ? 'border-sky-500 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t.name}
                  <span className={`rounded-full px-1.5 text-[11px] ${active ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-600'}`}>
                    {Math.max(0, liveCount(t.id) - liveRcCount(t.id))}
                  </span>
                  <RcCount n={liveRcCount(t.id)} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
            Link the CRM talent pipeline for each category under{' '}
            <Link href="/crm-mapping" className="text-indigo-600 underline">CRM Mapping</Link> to see and move
            talents through Welcome → Download App → Onboarding webinar → Webinar registered here. Completed talents graduate to {track === 'jobs' ? 'Jobs' : 'Partner Program'}.
          </p>
        )}
      </div>
      )}

      {/* Attention chips + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!sectionOnly && <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Needs attention</span>
          {ATTENTION_CHIPS.map((c) => {
            const active = attention === c.value;
            const n =
              c.value === 'pending_approval'
                ? stats?.attention.pending_approval
                : c.value === 'needs_review'
                  ? stats?.attention.needs_review
                  : c.value === 'waiting_on_talent'
                    ? stats?.attention.waiting_on_talent
                    : c.value === 'message_failed'
                      ? stats?.attention.message_failed
                      : undefined;
            return (
              <button
                key={c.value}
                type="button"
                title={c.hint}
                // Chip counts span the whole funnel, so a chip lists every match —
                // drop the stage / talent-board tab or the list can come up empty.
                onClick={() => updateQuery(active
                  ? { attention: null, page: null }
                  : { attention: c.value, stage: null, talent_stage: null, page: null })}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {c.label}
                {typeof n === 'number' && n > 0 && (
                  <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : c.value === 'message_failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>}
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
            <p className="text-sm font-medium text-gray-700">{view === 'cancelled' ? 'No cancelled applicants' : view === 'rejected' ? 'No rejected talents' : 'No sign-ups match'}</p>
            <p className="text-sm text-gray-500">
              {view === 'cancelled'
                ? 'Talents who don\'t make requested changes after the reminders and final warning land here.'
                : view === 'rejected'
                ? 'Talents you reject or disqualify land here, with the reason.'
                : 'Clear a filter or wait for new talent to sign up.'}
            </p>
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
                  <th className="px-3 py-2.5">{view !== 'active' ? 'Reason' : 'Journey'}</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u, idx) => {
                  const isSel = u.id === selectedId;
                  // Talents under request changes are grouped after the rest
                  // (server orders them that way); mark where the group starts.
                  const rcGroupStart = view === 'active' && u.under_request_changes
                    && (idx === 0 || !users[idx - 1].under_request_changes);
                  const phone = cleanPhoneForLink(u.phone);
                  const st = STAGE_BY_VALUE[u.pipeline_stage] ?? STAGE_BY_VALUE.application_approved;
                  const isPending = track === 'partner' && u.partner_approval_status === 'pending' && u.pipeline_stage !== 'rejected';
                  const j = u.journey;
                  const hint = j
                    ? !j.onboarding_completed
                      ? j.course_started ? 'On the course' : 'Course not started'
                      : !j.basic_profile_completed
                        ? `Basic: ${j.basic_missing.length} missing`
                        : !j.job_profile_completed
                          ? j.job_profiles.draft > 0 ? 'Job profile in draft' : 'No job profile'
                          : j.job_profiles.changes_requested > 0
                            ? `Waiting on talent · ${timeAgo(j.changes_requested_at)}${j.requested_change_labels.length ? ` · ${j.requested_change_labels.slice(0, 3).join(', ')}${j.requested_change_labels.length > 3 ? ` +${j.requested_change_labels.length - 3}` : ''}` : ''}`
                            : j.job_profiles.pending_review > 0
                              ? j.resubmitted_at ? `Resubmitted ${timeAgo(j.resubmitted_at)} · review` : 'Profile awaiting review'
                              : !j.portfolio_completed && j.portfolio_required !== false
                              ? 'No portfolio yet'
                              : 'Journey complete'
                    : '';
                  return (
                    <Fragment key={u.id}>
                    {rcGroupStart && (
                      <tr className="bg-amber-50/70">
                        <td colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                          Under request changes · waiting on the talent
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => openRow(u.id)}
                      className={`cursor-pointer transition-colors ${isSel ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canEdit && isPending && (
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
                      {view === 'cancelled' ? (
                        <td className="max-w-xs px-3 py-2.5">
                          <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Cancelled</span>
                          <p className="mt-1 text-sm text-gray-800">{u.application_cancelled_reason || '—'}</p>
                          {u.application_cancelled_at && (
                            <p className="mt-0.5 text-[11px] text-gray-500" title={u.application_cancelled_at}>Cancelled {timeAgo(u.application_cancelled_at)}</p>
                          )}
                        </td>
                      ) : view === 'rejected' ? (
                        <td className="max-w-xs px-3 py-2.5">
                          <p className="text-sm text-gray-800">{u.rejection_reason || '—'}</p>
                          {u.rejected_at && (
                            <p className="mt-0.5 text-[11px] text-gray-500" title={u.rejected_at}>Rejected {timeAgo(u.rejected_at)}</p>
                          )}
                        </td>
                      ) : (
                        <td className="px-3 py-2.5">
                          <JourneyDots row={u} />
                          <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
                          {u.request_changes && (
                            <p className="mt-1 inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                              title={`Changes requested ${timeAgo(u.request_changes.requested_at)}`}>
                              Changes requested · {requestChangesStepLabel(u.request_changes)}
                            </p>
                          )}
                          {u.pipeline_stage === 'live' && <TalentBoardDots row={u} />}
                        </td>
                      )}
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
                          {u.message_failed && (
                            <span
                              className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
                              title={`${u.message_failed.reason ?? 'WhatsApp send failed'}${u.message_failed.template ? ` · ${u.message_failed.template}` : ''} · ${timeAgo(u.message_failed.at)}`}
                            >
                              WhatsApp failed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                          <StatusBadge row={u} track={track} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500" title={u.created_at}>
                        {timeAgo(u.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {canEdit && isPending && (
                            <>
                              <button
                                type="button"
                                onClick={() => approveMut.mutate(u.id)}
                                disabled={approveMut.isPending}
                                title="Approve · moves to Application Approved"
                                className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectTarget({ id: u.id, name: u.full_name })}
                                title="Reject with a reason"
                                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canEdit && view === 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => restoreCancelledMut.mutate(u.id)}
                              disabled={restoreCancelledMut.isPending}
                              title="Restore to onboarding — reminders restart if changes are still open"
                              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              Restore
                            </button>
                          )}
                          {canEdit && view !== 'cancelled' && u.pipeline_stage === 'rejected' && (
                            <button
                              type="button"
                              onClick={() => setRestoreTarget(u)}
                              disabled={restoreMut.isPending}
                              title="Restore to Signed Up / Applicants"
                              className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              Restore
                            </button>
                          )}
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
                    </Fragment>
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
        track={track}
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
      <Modal isOpen={!!restoreTarget} onClose={() => !restoreMut.isPending && setRestoreTarget(null)}
        title={`Restore ${restoreTarget?.full_name ?? 'candidate'}`} size="sm">
        <p className="mb-4 text-sm text-gray-600">
          Return the selected application to Signed Up / Applicants for review. Existing profile and course work is kept.
        </p>
        <div className="space-y-2">
          {restoreTarget?.partner_rejected && (
            <button type="button" disabled={restoreMut.isPending}
              onClick={() => restoreMut.mutate({ id: restoreTarget.id, selectedTrack: 'partner' })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              Restore Partner Program
            </button>
          )}
          {restoreTarget?.jobs_rejected && (
            <button type="button" disabled={restoreMut.isPending}
              onClick={() => restoreMut.mutate({ id: restoreTarget.id, selectedTrack: 'jobs' })}
              className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
              Restore Jobs
            </button>
          )}
          {restoreTarget?.partner_rejected && restoreTarget.jobs_rejected && (
            <button type="button" disabled={restoreMut.isPending}
              onClick={() => restoreMut.mutate({ id: restoreTarget.id, selectedTrack: 'both' })}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-left text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              Restore both
            </button>
          )}
        </div>
      </Modal>
      <RejectDialog
        open={!!rejectTarget}
        talentName={rejectTarget?.name ?? ''}
        programLabel={track === 'partner' ? 'Partner Program' : 'Jobs track'}
        pending={rejectMut.isPending}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => rejectTarget && rejectMut.mutate({ id: rejectTarget.id, reason })}
      />
    </div>
  );
}
