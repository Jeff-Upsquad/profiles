'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Badge from '@/components/ui/Badge';
import NotesSection from '@/views/leads/NotesSection';
import CandidateActivityPanel from '@/views/leads/CandidateActivityPanel';
import { useStageLabels } from '@/hooks/useStageLabels';
import { cleanPhoneForLink, formatIndianPhone } from '@/lib/phone';
import { formatDate } from '@/lib/formatDate';
import { crmLookupUrl } from '@/lib/crmUrl';
import {
  CATEGORY_BADGE,
  PIPELINE_STAGES,
  STAGE_BY_VALUE,
  initials,
  timeAgo,
  type CrmStage,
  type PipelineStage,
} from './hubTypes';

// ---------------------------------------------------------------------------
// Types (mirror GET /admin/user-approvals/:id/journey)
// ---------------------------------------------------------------------------

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

interface CourseItem {
  id: string;
  title: string;
  completed: number;
  total: number;
  started_at: string | null;
}

interface JobProfile {
  id: string;
  category_id: string;
  category_name: string | null;
  category_slug: string | null;
  status: string;
  is_active: boolean;
  tier: string | null;
  tier_custom: string | null;
  portfolio_items: number;
  created_at: string;
  updated_at: string;
  requested_changes?: { key: string; label: string; message: string; note?: string | null }[];
  changes_requested_at?: string | null;
  resubmitted_at?: string | null;
  changes_whatsapp_sent?: boolean | null;
}

interface Journey {
  user: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
    profile_photo_url: string | null;
    current_location: string | null;
    approval_status: string;
    rejection_reason: string | null;
    is_active: boolean;
    suspended: boolean;
    blacklisted: boolean;
    created_at: string;
    approved_at: string | null;
    languages_spoken: { language: string; proficiency: string }[];
    skip_onboarding: boolean;
    skip_onboarding_reason: string | null;
    pipeline_stage: PipelineStage;
    crm_talent_pipeline_name: string | null;
    crm_talent_stage_id: string | null;
    crm_talent_stage_name: string | null;
    crm_talent_stage_changed_at: string | null;
    categories: string[];
  };
  journey: {
    onboarding_completed: boolean;
    onboarding_bypassed: boolean;
    course: { items: CourseItem[]; completed: number; total: number };
    basic_profile_completed: boolean;
    basic_checklist: ChecklistItem[];
    job_profile_completed: boolean;
    portfolio_completed: boolean;
    portfolio_items: number;
  };
  basic: Record<string, any> | null;
  profiles: JobProfile[];
  lead: {
    id: string;
    form_type: string;
    status: string;
    form_data: Record<string, any>;
    resume_url: string | null;
    created_at: string;
  } | null;
  talent_pipeline: { form_type: string | null; pipeline_name: string; stages: CrmStage[] } | null;
}

interface Props {
  userId: string | null;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number | null;
  totalCount: number;
  onOpenChat: (phone: string, name: string) => void;
  canEdit: boolean;
}

// pipeline_stage key -> lead status key, so the CRM's live stage names (from
// the Status Mapping) can label the chips.
const STAGE_TO_LEAD_KEY: Record<PipelineStage, string> = {
  signed_up: 'signed_up',
  onboarding_course: 'onboarding_training',
  basic_profile: 'basic_profile',
  job_profile: 'job_profile',
  final_review: 'final_review',
  live: 'live',
  no_response: 'no_response',
};

const PROFILE_STATUS: Record<string, { label: string; variant: 'green' | 'yellow' | 'red' | 'gray' }> = {
  approved: { label: 'Approved', variant: 'green' },
  pending_review: { label: 'Pending review', variant: 'yellow' },
  changes_requested: { label: 'Waiting on talent', variant: 'gray' },
  rejected: { label: 'Rejected', variant: 'red' },
  draft: { label: 'Draft', variant: 'gray' },
  inactive: { label: 'Inactive', variant: 'gray' },
};

// ---------------------------------------------------------------------------
// Small presentational bits
// ---------------------------------------------------------------------------

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function StepIcon({ done, active }: { done: boolean; active?: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white">
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
        active ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white'
      }`}
    >
      {active && <span className="h-2 w-2 rounded-full bg-indigo-500" />}
    </span>
  );
}

function ActionButton({
  onClick,
  href,
  external,
  tone = 'default',
  children,
  title,
}: {
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: 'default' | 'primary' | 'success' | 'danger';
  children: ReactNode;
  title?: string;
}) {
  const cls = {
    default: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
    primary: 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700',
    success: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
    danger: 'border-red-200 bg-white text-red-600 hover:bg-red-50',
  }[tone];
  const base = `inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${cls}`;
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={base} title={title}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={base} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={base} title={title}>
      {children}
    </button>
  );
}

const PLACEHOLDER = <span className="italic text-gray-400">Not provided</span>;
const TITLE = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const WORK_TYPE_LABEL: Record<string, string> = {
  partner_program: 'Partner Program · Subscriptions',
  freelance: 'Partner Program · Assignments',
  salary: 'Jobs',
};

function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800">{children}</dd>
    </div>
  );
}

// Read-only, compact view of the basic profile — enough to review what the
// talent entered without leaving the hub. Editing stays on the user page.
function BasicProfileView({ basic, user }: { basic: Record<string, any> | null; user: Journey['user'] }) {
  const b = basic ?? {};
  const langs = user.languages_spoken ?? [];
  const address = [b.permanent_city, b.permanent_district, b.permanent_state, b.permanent_country]
    .filter(Boolean)
    .join(', ');
  const current = [b.city, b.current_district, b.state, b.country].filter(Boolean).join(', ');
  const employment: string[] = Array.isArray(b.employment_type) ? b.employment_type : [];
  const courses: any[] = Array.isArray(b.education_courses) ? b.education_courses : [];
  const exps: any[] = Array.isArray(b.experience) ? b.experience : [];

  return (
    <dl className="mt-3 grid gap-3 border-t border-gray-100 pt-3 sm:grid-cols-2">
      <KV label="Languages">
        {langs.length ? (
          <span className="flex flex-wrap gap-1">
            {langs.map((l, i) => (
              <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                {l.language} <span className="text-gray-400">· {TITLE(l.proficiency)}</span>
              </span>
            ))}
          </span>
        ) : PLACEHOLDER}
      </KV>
      <KV label="Work preference">
        {employment.length ? employment.map((e) => WORK_TYPE_LABEL[e] ?? TITLE(e)).join(' · ') : PLACEHOLDER}
      </KV>
      <KV label="Permanent address">{address || PLACEHOLDER}</KV>
      <KV label="Current location">{current || user.current_location || PLACEHOLDER}</KV>
      <div className="sm:col-span-2">
        <KV label="Education">
          {courses.length ? (
            <ul className="space-y-1">
              {courses.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.course_name || 'Untitled'}</span>
                  {c.institution ? <span className="text-gray-500"> · {c.institution}</span> : null}
                  {c.from_year ? (
                    <span className="text-xs text-gray-400"> ({c.from_year}–{c.to_year || 'now'})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : PLACEHOLDER}
        </KV>
      </div>
      <div className="sm:col-span-2">
        <KV label="Experience">
          {exps.length ? (
            <ul className="space-y-1">
              {exps.map((e, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{e.designation || 'Untitled role'}</span>
                  {e.company_name ? <span className="text-gray-500"> · {e.company_name}</span> : null}
                  {e.from_year ? (
                    <span className="text-xs text-gray-400"> ({e.from_year}–{e.to_year || 'now'})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : PLACEHOLDER}
        </KV>
      </div>
      {employment.includes('salary') && (
        <>
          <KV label="Availability">
            {Array.isArray(b.availability) && b.availability.length ? b.availability.map(TITLE).join(', ') : PLACEHOLDER}
          </KV>
          <KV label="Job type">
            {Array.isArray(b.job_type) && b.job_type.length ? b.job_type.map(TITLE).join(', ') : PLACEHOLDER}
          </KV>
        </>
      )}
      {employment.includes('partner_program') && (
        <KV label="Office hours">
          {Array.isArray(b.virtual_office_hours) && b.virtual_office_hours.some((h: any) => h?.from && h?.to)
            ? b.virtual_office_hours
                .filter((h: any) => h?.from && h?.to)
                .map((h: any) => `${TITLE(h.day)} ${h.from}–${h.to}`)
                .join(' · ')
            : PLACEHOLDER}
        </KV>
      )}
      <KV label="Photo">
        {b.profile_picture_url ? (
          <a href={b.profile_picture_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
            View photo
          </a>
        ) : PLACEHOLDER}
      </KV>
      <KV label="Resume">
        {b.resume_url ? (
          <a href={b.resume_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">
            Download
          </a>
        ) : PLACEHOLDER}
      </KV>
    </dl>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function TalentJourneyPanel({
  userId,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
  onOpenChat,
  canEdit,
}: Props) {
  const qc = useQueryClient();
  const { labelFor } = useStageLabels();
  const [showBasic, setShowBasic] = useState(false);
  const [showApplication, setShowApplication] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  // Keyboard: Esc closes, ←/→ move between rows (unless typing).
  useEffect(() => {
    if (!userId) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && hasPrev) onNavigate(-1);
      else if (e.key === 'ArrowRight' && hasNext) onNavigate(1);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [userId, hasPrev, hasNext, onNavigate, onClose]);

  useEffect(() => {
    setShowBasic(false);
    setShowApplication(false);
    setActivityOpen(false);
  }, [userId]);

  const { data, isLoading } = useQuery<Journey>({
    queryKey: ['onboarding-journey', userId],
    queryFn: async () => (await api.get(`/admin/user-approvals/${userId}/journey`)).data,
    enabled: !!userId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['onboarding-journey', userId] });
    qc.invalidateQueries({ queryKey: ['onboarding-hub'] });
    qc.invalidateQueries({ queryKey: ['onboarding-hub-stats'] });
  };

  const stageMut = useMutation({
    mutationFn: async (stage: PipelineStage) =>
      (await api.patch(`/admin/user-approvals/${userId}/pipeline-stage`, { stage })).data,
    onSuccess: () => {
      toast.success('Stage updated · synced to CRM');
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update stage'),
  });

  const talentStageMut = useMutation({
    mutationFn: async (stage_id: string) =>
      (await api.patch(`/admin/user-approvals/${userId}/talent-stage`, { stage_id })).data,
    onSuccess: () => {
      toast.success('Talent stage updated · synced to CRM');
      refresh();
    },
    onError: (e: any) =>
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to update talent stage'),
  });

  const approveMut = useMutation({
    mutationFn: async () => (await api.patch(`/admin/user-approvals/${userId}/approve`)).data,
    onSuccess: () => {
      toast.success('Approved');
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Approve failed'),
  });

  const rejectMut = useMutation({
    mutationFn: async (reason: string) =>
      (await api.patch(`/admin/user-approvals/${userId}/reject`, { reason })).data,
    onSuccess: () => {
      toast.success('Rejected');
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Reject failed'),
  });

  const bypassMut = useMutation({
    mutationFn: async ({ skip, reason }: { skip: boolean; reason?: string | null }) =>
      (
        await api.patch(`/admin/users/talent/${userId}/skip-onboarding`, {
          skip_onboarding: skip,
          reason: reason ?? null,
        })
      ).data,
    onSuccess: (_d, v) => {
      toast.success(v.skip ? 'Course bypassed for this talent' : 'Course bypass removed');
      refresh();
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to update bypass'),
  });

  if (!userId || typeof document === 'undefined') return null;

  const u = data?.user;
  const j = data?.journey;
  const phoneDigits = cleanPhoneForLink(u?.phone);
  const formType = data?.lead?.form_type ?? u?.categories?.[0];
  const stageLabel = (s: PipelineStage) =>
    labelFor(formType, STAGE_TO_LEAD_KEY[s], STAGE_BY_VALUE[s].label);

  // Which journey step is "current" (first not-done after signed up).
  const steps = j
    ? [
        { key: 'course', label: 'Onboarding course', done: j.onboarding_completed },
        { key: 'basic', label: 'Basic profile', done: j.basic_profile_completed },
        { key: 'job', label: 'Job profile', done: j.job_profile_completed },
        { key: 'portfolio', label: 'Portfolio', done: j.portfolio_completed },
      ]
    : [];
  const currentStep = steps.find((s) => !s.done)?.key ?? null;
  const missing = j?.basic_checklist.filter((c) => c.required && !c.done) ?? [];
  const optionalMissing = j?.basic_checklist.filter((c) => !c.required && !c.done) ?? [];
  const coursePct = j && j.course.total > 0 ? Math.round((j.course.completed / j.course.total) * 100) : 0;

  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <aside className="relative flex w-full max-w-2xl flex-col bg-gray-50 shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onNavigate(-1)}
              disabled={!hasPrev}
              title="Previous (←)"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Previous"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => onNavigate(1)}
              disabled={!hasNext}
              title="Next (→)"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
              aria-label="Next"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {currentIndex !== null && (
              <span className="ml-2 text-xs text-gray-500">
                {currentIndex + 1} of {totalCount} on this page
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {isLoading || !u || !j ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Identity */}
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                <div className="flex items-start gap-3">
                  {u.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.profile_photo_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-base font-semibold text-white">
                      {initials(u.full_name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900">{u.full_name}</h2>
                      {u.categories.map((c) => {
                        const b = CATEGORY_BADGE[c];
                        return b ? (
                          <span key={c} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${b.cls}`}>
                            {b.label}
                          </span>
                        ) : null;
                      })}
                      {u.suspended ? (
                        <Badge variant="red">Suspended</Badge>
                      ) : u.approval_status === 'pending' ? (
                        <Badge variant="yellow">Pending approval</Badge>
                      ) : u.approval_status === 'rejected' ? (
                        <Badge variant="red">Rejected</Badge>
                      ) : u.is_active === false ? (
                        <Badge variant="gray">Inactive</Badge>
                      ) : (
                        <Badge variant="green">Approved</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Joined {formatDate(u.created_at)} · {timeAgo(u.created_at)}
                      {u.current_location ? ` · ${u.current_location}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {u.phone && (
                        <a href={`tel:+${phoneDigits}`} className="text-gray-700 hover:text-indigo-700">
                          {formatIndianPhone(u.phone)}
                        </a>
                      )}
                      {u.email && (
                        <a href={`mailto:${u.email}`} className="truncate text-gray-700 hover:text-indigo-700">
                          {u.email}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {phoneDigits && (
                    <ActionButton tone="success" onClick={() => onOpenChat(phoneDigits, u.full_name)} title="Open the CRM WhatsApp thread here">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      CRM chat
                    </ActionButton>
                  )}
                  {phoneDigits && (
                    <ActionButton href={crmLookupUrl(phoneDigits)} external title="Open the card in SquadHire CRM">
                      Open in CRM ↗
                    </ActionButton>
                  )}
                  <ActionButton href={`/users/${u.id}`} title="Full user page with edit dialogs">
                    Full profile
                  </ActionButton>
                  {data?.lead && (
                    <ActionButton href={`/leads?form_type=${encodeURIComponent(data.lead.form_type)}&selected=${data.lead.id}`} title="Candidate record">
                      Candidate
                    </ActionButton>
                  )}
                  <ActionButton onClick={() => setActivityOpen(true)} title="Activity timeline">
                    Activity
                  </ActionButton>
                  {canEdit && u.approval_status === 'pending' && (
                    <span className="ml-auto flex gap-2">
                      <ActionButton tone="success" onClick={() => approveMut.mutate()}>
                        Approve
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        onClick={() => {
                          const r = prompt('Rejection reason (optional)');
                          if (r !== null) rejectMut.mutate(r);
                        }}
                      >
                        Reject
                      </ActionButton>
                    </span>
                  )}
                </div>
                {u.approval_status === 'rejected' && u.rejection_reason && (
                  <p className="mt-2 text-xs text-red-600">Rejected: {u.rejection_reason}</p>
                )}
              </div>

              {/* Journey */}
              <Section
                title="Journey"
                aside={
                  <span className="text-[11px] text-gray-500">
                    {steps.filter((s) => s.done).length + 1} of {steps.length + 1} steps
                  </span>
                }
              >
                <ol className="space-y-2">
                  {/* Signed up */}
                  <li className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                    <StepIcon done />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Signed up</p>
                      <p className="text-xs text-gray-500">{formatDate(u.created_at)}</p>
                    </div>
                  </li>

                  {/* Course */}
                  <li className={`rounded-lg px-2 py-2 ${currentStep === 'course' ? 'bg-indigo-50/60 ring-1 ring-indigo-100' : ''}`}>
                    <div className="flex items-center gap-3">
                      <StepIcon done={j.onboarding_completed} active={currentStep === 'course'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Onboarding course
                          {j.onboarding_bypassed && (
                            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-indigo-700">
                              Bypassed
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {j.onboarding_completed
                            ? j.onboarding_bypassed
                              ? u.skip_onboarding_reason || 'Admin bypass'
                              : 'Completed'
                            : j.course.total > 0
                              ? `${j.course.completed} of ${j.course.total} pages · ${coursePct}%`
                              : 'Not started'}
                        </p>
                      </div>
                      {canEdit && !j.onboarding_completed && (
                        <button
                          type="button"
                          onClick={() => {
                            const r = prompt('Bypass the course for this talent? Reason (optional):');
                            if (r !== null) bypassMut.mutate({ skip: true, reason: r || null });
                          }}
                          className="text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Bypass
                        </button>
                      )}
                      {canEdit && j.onboarding_bypassed && (
                        <button
                          type="button"
                          onClick={() => bypassMut.mutate({ skip: false })}
                          className="text-xs font-medium text-gray-500 hover:underline"
                        >
                          Undo bypass
                        </button>
                      )}
                    </div>
                    {!j.onboarding_completed && j.course.total > 0 && (
                      <div className="ml-9 mt-2 space-y-1.5">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full bg-amber-500" style={{ width: `${coursePct}%` }} />
                        </div>
                        {j.course.items.length > 1 && (
                          <ul className="text-[11px] text-gray-500">
                            {j.course.items.map((i) => (
                              <li key={i.id}>
                                {i.title}: {i.completed}/{i.total}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>

                  {/* Basic profile */}
                  <li className={`rounded-lg px-2 py-2 ${currentStep === 'basic' ? 'bg-indigo-50/60 ring-1 ring-indigo-100' : ''}`}>
                    <div className="flex items-center gap-3">
                      <StepIcon done={j.basic_profile_completed} active={currentStep === 'basic'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">Basic profile</p>
                        <p className="text-xs text-gray-500">
                          {j.basic_profile_completed
                            ? 'All mandatory sections filled'
                            : data.basic
                              ? `${missing.length} section${missing.length === 1 ? '' : 's'} missing`
                              : 'Not started'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBasic((v) => !v)}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        {showBasic ? 'Hide' : 'View'}
                      </button>
                      <Link href={`/users/${u.id}`} className="text-xs font-medium text-gray-500 hover:underline">
                        Edit
                      </Link>
                    </div>
                    <div className="ml-9 mt-2 flex flex-wrap gap-1.5">
                      {j.basic_checklist
                        .filter((c) => c.required || c.done || c.key === 'work_type')
                        .map((c) => (
                          <span
                            key={c.key}
                            title={c.required ? (c.done ? 'Done' : 'Missing — required') : 'Optional'}
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                              c.done
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : c.required
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-gray-200 bg-gray-50 text-gray-500'
                            }`}
                          >
                            {c.done ? '✓' : '✗'} {c.label}
                          </span>
                        ))}
                      {optionalMissing.length > 0 && missing.length === 0 && (
                        <span className="text-[11px] text-gray-400">
                          (optional: {optionalMissing.map((c) => c.label.toLowerCase()).join(', ')})
                        </span>
                      )}
                    </div>
                    {showBasic && (
                      <div className="ml-9">
                        <BasicProfileView basic={data.basic} user={u} />
                      </div>
                    )}
                  </li>

                  {/* Job profiles */}
                  <li className={`rounded-lg px-2 py-2 ${currentStep === 'job' ? 'bg-indigo-50/60 ring-1 ring-indigo-100' : ''}`}>
                    <div className="flex items-center gap-3">
                      <StepIcon done={j.job_profile_completed} active={currentStep === 'job'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">Job profile</p>
                        <p className="text-xs text-gray-500">
                          {data.profiles.length === 0
                            ? 'No job profile created yet'
                            : `${data.profiles.length} profile${data.profiles.length === 1 ? '' : 's'}`}
                          {data.profiles.some((p) => p.status === 'pending_review') && (
                            <span className="ml-1 font-medium text-amber-700">· needs your review</span>
                          )}
                          {data.profiles.some((p) => p.status === 'changes_requested') && (
                            <span className="ml-1 font-medium text-gray-600">· waiting on talent</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {data.profiles.length > 0 && (
                      <ul className="ml-9 mt-2 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        {data.profiles.map((p) => {
                          const st = PROFILE_STATUS[p.status] ?? { label: p.status, variant: 'gray' as const };
                          const asked = p.requested_changes ?? [];
                          return (
                            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-gray-900">
                                  {p.category_name ?? 'Profile'}
                                  {p.tier && (
                                    <span className="ml-2 text-xs text-gray-500">
                                      {p.tier === 'custom' ? p.tier_custom : TITLE(p.tier)}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-gray-500">
                                  {p.portfolio_items} portfolio item{p.portfolio_items === 1 ? '' : 's'} · updated {timeAgo(p.updated_at)}
                                </p>
                                {p.status === 'changes_requested' && asked.length > 0 && (
                                  <p className="mt-0.5 text-[11px] text-amber-800" title={asked.map((c) => c.message).join('\n')}>
                                    Asked {timeAgo(p.changes_requested_at)}: {asked.map((c) => c.label).join(', ')}
                                    {p.changes_whatsapp_sent === false && <span className="text-amber-600"> · WhatsApp not sent</span>}
                                  </p>
                                )}
                                {p.status === 'pending_review' && p.resubmitted_at && (
                                  <p className="mt-0.5 text-[11px] text-emerald-700">
                                    Resubmitted {timeAgo(p.resubmitted_at)} after changes were requested
                                  </p>
                                )}
                              </div>
                              <Badge variant={st.variant}>{st.label}</Badge>
                              {p.status === 'pending_review' ? (
                                <Link href={`/reviews/${p.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                                  Review
                                </Link>
                              ) : (
                                <Link href={`/talents/${p.category_id}/${p.id}`} className="text-xs font-medium text-gray-500 hover:underline">
                                  View
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>

                  {/* Portfolio */}
                  <li className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${currentStep === 'portfolio' ? 'bg-indigo-50/60 ring-1 ring-indigo-100' : ''}`}>
                    <StepIcon done={j.portfolio_completed} active={currentStep === 'portfolio'} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Portfolio</p>
                      <p className="text-xs text-gray-500">
                        {j.portfolio_items > 0 ? `${j.portfolio_items} item${j.portfolio_items === 1 ? '' : 's'}` : 'Nothing uploaded yet'}
                      </p>
                    </div>
                  </li>
                </ol>
              </Section>

              {/* Candidate pipeline stage */}
              <Section
                title="Pipeline stage"
                aside={
                  <span className="text-[11px] text-gray-500">
                    Synced with CRM{data.lead ? ' · candidate card' : ''}
                  </span>
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {PIPELINE_STAGES.map((s) => {
                    const active = s.value === u.pipeline_stage;
                    return (
                      <button
                        key={s.value}
                        type="button"
                        disabled={active || !canEdit || stageMut.isPending}
                        onClick={() => stageMut.mutate(s.value)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                          active
                            ? `${s.chip} shadow-sm ring-2 ring-offset-1 ring-indigo-200`
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60'
                        }`}
                        title={active ? 'Current stage' : `Move to ${stageLabel(s.value)}`}
                      >
                        {stageLabel(s.value)}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* CRM talent pipeline */}
              <Section
                title="Talent pipeline"
                aside={
                  data.talent_pipeline ? (
                    <span className="text-[11px] text-gray-500">
                      CRM · {data.talent_pipeline.pipeline_name}
                      {u.crm_talent_stage_changed_at ? ` · moved ${timeAgo(u.crm_talent_stage_changed_at)}` : ''}
                    </span>
                  ) : null
                }
              >
                {data.talent_pipeline ? (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {data.talent_pipeline.stages.map((s) => {
                        const active = s.id === u.crm_talent_stage_id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={active || !canEdit || talentStageMut.isPending}
                            onClick={() => talentStageMut.mutate(s.id)}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                              active
                                ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-sm ring-2 ring-sky-200 ring-offset-1'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60'
                            }`}
                            title={active ? 'Current stage' : `Move to ${s.name}`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                    {!u.crm_talent_stage_id && (
                      <p className="mt-2 text-xs text-gray-500">
                        Not on the talent board yet — it starts when the CRM hands the card over after
                        going live, or pick a stage above to move them now.
                      </p>
                    )}
                    {u.crm_talent_stage_id && !data.talent_pipeline.stages.some((s) => s.id === u.crm_talent_stage_id) && (
                      <p className="mt-2 text-xs text-amber-700">
                        Currently at “{u.crm_talent_stage_name}” — a stage not in the linked pipeline snapshot.
                        Refresh stages under CRM Mapping.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    {u.crm_talent_stage_name ? (
                      <>
                        CRM says: <span className="font-medium text-gray-800">{u.crm_talent_stage_name}</span>
                        {u.crm_talent_pipeline_name ? ` (${u.crm_talent_pipeline_name})` : ''}.{' '}
                      </>
                    ) : null}
                    Link this category&apos;s talent pipeline under{' '}
                    <Link href="/crm-mapping" className="text-indigo-600 underline">
                      CRM Mapping
                    </Link>{' '}
                    to move talents from here.
                  </p>
                )}
              </Section>

              {/* Notes (candidate notes live on the lead) */}
              {data.lead && (
                <Section title="Notes">
                  <NotesSection leadId={data.lead.id} />
                </Section>
              )}

              {/* Application form answers */}
              {data.lead && Object.keys(data.lead.form_data ?? {}).length > 0 && (
                <Section
                  title="Application"
                  aside={
                    <button
                      type="button"
                      onClick={() => setShowApplication((v) => !v)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {showApplication ? 'Hide' : 'Show'}
                    </button>
                  }
                >
                  <p className="text-xs text-gray-500">
                    {TITLE(data.lead.form_type)} form · applied {formatDate(data.lead.created_at)} · stage{' '}
                    {labelFor(data.lead.form_type, data.lead.status, TITLE(data.lead.status))}
                  </p>
                  {showApplication && (
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {Object.entries(data.lead.form_data).map(([k, v]) => (
                        <KV key={k} label={TITLE(k)}>
                          {typeof v === 'string' && /^https?:\/\//.test(v) ? (
                            <a href={v} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-600 underline">
                              {v}
                            </a>
                          ) : Array.isArray(v) ? (
                            v.join(', ')
                          ) : typeof v === 'boolean' ? (
                            v ? 'Yes' : 'No'
                          ) : (
                            String(v ?? '')
                          )}
                        </KV>
                      ))}
                    </dl>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      </aside>

      {activityOpen && u && (
        <CandidateActivityPanel talentUserId={u.id} title={u.full_name} onClose={() => setActivityOpen(false)} />
      )}
    </div>,
    document.body,
  );
}
