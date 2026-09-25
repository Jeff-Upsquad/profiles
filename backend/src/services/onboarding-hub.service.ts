// ---------------------------------------------------------------------------
// Onboarding hub — the admin's single view of every talent sign-up and how far
// they've got: course → basic profile → job profile → portfolio, the CRM
// candidate-pipeline stage (talent_users.pipeline_stage) and, once the CRM has
// handed the card to its *talent* pipeline, that board's stage too.
//
// Reads are batched per page (one query per table, never per row) so the list
// stays cheap at 25 rows. The journey detail for one talent is richer and may
// fan out (course progress reuses the talent-facing training payload).
// ---------------------------------------------------------------------------

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { isBasicProfileMandatoryComplete } from './talent.service.js';
import { getAdminSetting } from './admin.service.js';
import {
  parseSignupCategory,
  talentIdsForSignupCategory,
  signupCategoriesByTalentIds,
  formTypesForTalent,
} from '../lib/signup-category.js';
import { normalizeStage, type CrmStage } from './crm-stage-mapping.js';
import { isJobsKey, jobsPipelineKey } from './linked-tracks.service.js';
import { programProgressFor, type ProgramProgress } from './program-training-progress.service.js';
import { openChangeRequests, rcStatusFor } from './request-change-reminders.service.js';

// Graduated talents (talent-board "Onboarding completed") no longer belong in
// the onboarding queue — they live in Partner Program / Jobs modules where the
// live profiles appear. Match by normalized stage name so CRM renames/casing
// don't leak them back into the hub.
const GRADUATED_TALENT_STAGE = 'onboarding completed';
function isGraduatedTalentStageName(name: string | null | undefined): boolean {
  return normalizeStage(name ?? '') === GRADUATED_TALENT_STAGE;
}

// Columns needed to evaluate isBasicProfileMandatoryComplete + the checklist.
const BASIC_COLUMNS =
  'talent_user_id, created_at, updated_at, permanent_country, permanent_state, permanent_district, ' +
  'permanent_city, availability, job_type, employment_type, virtual_office_hours, ' +
  'daily_available_hours, freelance_available, education_courses, experience, ' +
  'profile_picture_url, resume_url';

export interface BasicChecklistItem {
  key: string;
  label: string;
  done: boolean;
  /** False for sections that don't gate "basic profile complete" for this talent. */
  required: boolean;
}

/**
 * Section-by-section view of the same rule isBasicProfileMandatoryComplete
 * applies, so the hub can say *which* part is missing rather than just "no".
 * Keep the gating logic in step with that function and the talent form.
 */
export function basicProfileChecklist(
  basic: Record<string, any> | null,
  talent: { full_name: string | null; languages_spoken: unknown },
): BasicChecklistItem[] {
  const b = basic ?? {};
  const langs = Array.isArray(talent.languages_spoken)
    ? (talent.languages_spoken as Array<{ proficiency?: string }>)
    : [];
  const courses = Array.isArray(b.education_courses)
    ? (b.education_courses as Array<{ course_name?: string; institution?: string }>)
    : [];
  const experiences = Array.isArray(b.experience)
    ? (b.experience as Array<{ company_name?: string; designation?: string }>)
    : [];
  const employment = Array.isArray(b.employment_type) ? (b.employment_type as string[]) : [];
  const office = Array.isArray(b.virtual_office_hours) ? b.virtual_office_hours : [];
  const daily = Array.isArray(b.daily_available_hours) ? b.daily_available_hours : [];

  const salary = employment.includes('salary');
  const freelance = employment.includes('freelance');
  const partner = employment.includes('partner_program');

  return [
    { key: 'name', label: 'Name', done: !!talent.full_name?.trim(), required: true },
    {
      key: 'work_type',
      label: 'Work preference',
      done: employment.length > 0,
      // Not part of the completion rule, but without it nothing else is gated —
      // surfaced so the admin can nudge the talent to pick one.
      required: false,
    },
    {
      key: 'language',
      label: 'Languages (one native)',
      done: langs.length > 0 && langs.some((l) => l?.proficiency === 'native'),
      required: true,
    },
    {
      key: 'address',
      label: 'Permanent address',
      done: !!(b.permanent_country && b.permanent_state && b.permanent_district && b.permanent_city),
      required: true,
    },
    {
      key: 'education',
      label: 'Education',
      done: courses.some((c) => !!c?.course_name?.trim() && !!c?.institution?.trim()),
      required: true,
    },
    {
      key: 'experience',
      label: 'Experience',
      done: experiences.some((e) => !!e?.company_name?.trim() && !!e?.designation?.trim()),
      required: true,
    },
    { key: 'photo', label: 'Profile photo', done: !!b.profile_picture_url, required: true },
    {
      key: 'job_preference',
      label: 'Job preference',
      done:
        Array.isArray(b.availability) && b.availability.length > 0 &&
        Array.isArray(b.job_type) && b.job_type.length > 0,
      required: salary,
    },
    { key: 'resume', label: 'Resume', done: !!b.resume_url, required: salary },
    {
      key: 'freelance',
      label: 'Freelance availability',
      done: !!b.freelance_available,
      required: freelance,
    },
    {
      key: 'partner_hours',
      label: 'Partner program hours',
      done:
        office.some((h: any) => h?.from && h?.to) &&
        daily.some((d: any) => typeof d?.hours === 'number' && d.hours > 0),
      required: partner,
    },
  ];
}

// ---------------------------------------------------------------------------
// CRM talent-pipeline config (snapshot of the CRM's talent board per category)
// ---------------------------------------------------------------------------

export interface TalentPipelineConfig {
  pipeline_name: string;
  stages: CrmStage[];
}

const jobsStageCache = new Map<string, { expires: number; stages: CrmStage[] }>();

async function discoverJobsStages(webhookUrl: string, pipelineName: string): Promise<CrmStage[]> {
  const cached = jobsStageCache.get(pipelineName);
  if (cached && cached.expires > Date.now()) return cached.stages;
  const secret = process.env.SQUADHIRE_CRM_INBOUND_SECRET;
  if (!webhookUrl || !secret) return [];
  try {
    const url = new URL(webhookUrl);
    const endpoint = `${url.origin}/integrations/profiles/pipelines/${encodeURIComponent(pipelineName)}/stages?kind=talent`;
    const response = await fetch(endpoint, {
      headers: { 'X-SquadHire-Admin-Signature': secret },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const body = await response.json() as { data?: { stages?: CrmStage[] } };
    const stages = body.data?.stages ?? [];
    jobsStageCache.set(pipelineName, { expires: Date.now() + 60_000, stages });
    return stages;
  } catch {
    return [];
  }
}

/** { formType -> talent pipeline snapshot } from the CRM Status Mapping setting. */
export async function getTalentPipelineConfig(): Promise<Record<string, TalentPipelineConfig>> {
  const mapping = await getAdminSetting<{ crm_webhook_url?: string; talent_pipelines?: Record<string, TalentPipelineConfig> }>(
    'crm_status_mapping',
  );
  const out: Record<string, TalentPipelineConfig> = {};
  for (const [formType, cfg] of Object.entries(mapping?.talent_pipelines ?? {})) {
    if (!cfg?.pipeline_name) continue;
    out[formType] = {
      pipeline_name: cfg.pipeline_name,
      stages: [...(cfg.stages ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    };
  }
  // Jobs talent boards are discovered live when no snapshot was saved.
  for (const [key, cfg] of Object.entries(out)) {
    if (isJobsKey(key) && cfg.stages.length === 0) {
      cfg.stages = await discoverJobsStages(mapping?.crm_webhook_url ?? '', cfg.pipeline_name);
    }
  }
  return out;
}

/** Pick the talent pipeline that applies to a talent (by stored name, else category). */
async function talentPipelineFor(
  talentUserId: string,
  storedPipelineName: string | null,
  track: 'partner' | 'jobs' = 'partner',
): Promise<{ formType: string | null; config: TalentPipelineConfig | null }> {
  const all = await getTalentPipelineConfig();
  const inTrack = Object.entries(all).filter(([key]) => (track === 'jobs') === isJobsKey(key));
  if (storedPipelineName) {
    const hit = inTrack.find(
      ([, c]) => normalizeStage(c.pipeline_name) === normalizeStage(storedPipelineName),
    );
    if (hit) return { formType: hit[0], config: hit[1] };
  }
  if (track === 'jobs') {
    const key = await jobsPipelineKey(talentUserId, all);
    return { formType: key, config: all[key] ?? null };
  }
  const types = await formTypesForTalent(talentUserId);
  const formType = types.find((t) => all[t]) ?? null;
  return { formType, config: formType ? all[formType] : null };
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type HubAttention =
  | 'pending_approval'
  | 'needs_review'
  | 'waiting_on_talent'
  | 'course_pending'
  | 'basic_incomplete'
  | 'no_job_profile'
  | 'message_failed';

export interface HubListFilters {
  track?: 'partner' | 'jobs';
  search?: string;
  category?: string;
  pipeline_stage?: string;
  talent_stage?: string;
  attention?: HubAttention;
  sort?: 'newest' | 'oldest';
  page?: number;
  limit?: number;
  /**
   * `rejected` = the Rejected / Disqualified section; `cancelled` = Cancelled
   * Applicants (auto-cancelled after unanswered change requests); default is
   * the active queue.
   */
  view?: 'active' | 'rejected' | 'cancelled';
}

/** The track's rejection record — Partner and Jobs keep their own. */
function rejectionFor(u: any, track: 'partner' | 'jobs' | undefined) {
  return track === 'jobs'
    ? { reason: u.jobs_rejection_reason ?? u.rejection_reason ?? null, at: u.jobs_rejected_at ?? u.rejected_at ?? null }
    : { reason: u.partner_rejection_reason ?? u.rejection_reason ?? null, at: u.partner_rejected_at ?? u.rejected_at ?? null };
}

interface JourneySummary {
  signed_up: boolean;
  onboarding_completed: boolean;
  onboarding_bypassed: boolean;
  course_started: boolean;
  program_courses: ProgramProgress;
  basic_profile_completed: boolean;
  basic_missing: string[];
  job_profile_completed: boolean;
  job_profiles: {
    total: number;
    draft: number;
    pending_review: number;
    changes_requested: number;
    approved: number;
    rejected: number;
  };
  /** Oldest open "request changes" ask, when any profile is in changes_requested. */
  changes_requested_at: string | null;
  /** Labels the reviewer asked for on that profile (for the row hint). */
  requested_change_labels: string[];
  /** Set when a profile was resubmitted after a request and is back in review. */
  resubmitted_at: string | null;
  portfolio_completed: boolean;
  portfolio_items: number;
  talent_board: TalentBoardChecklist;
}

/**
 * Talent-board (post-live) checklist inputs. The courses come from
 * `program_courses`; these are the other two ticks.
 *  - App downloaded: first check-in from the talent mobile app, which fires on
 *    every sign-in — so the first login ticks it with no admin action.
 *  - Webinar attended: marked by an admin (one common webinar for both tracks).
 */
export interface TalentBoardChecklist {
  app_downloaded_at: string | null;
  app_platform: string | null;
  webinar_attended_at: string | null;
}

/** Batch first-app-login lookup: talent id -> { first_seen_at, platform }. */
async function appInstallsFor(ids: string[]): Promise<Map<string, { first_seen_at: string; platform: string }>> {
  const out = new Map<string, { first_seen_at: string; platform: string }>();
  if (ids.length === 0) return out;
  const { data, error } = await supabaseAdmin
    .from('talent_app_installs')
    .select('user_id, first_seen_at, platform')
    .in('user_id', ids);
  if (error) {
    console.error('[onboarding-hub] app installs lookup failed:', error.message);
    return out;
  }
  for (const r of data ?? []) out.set((r as any).user_id, { first_seen_at: (r as any).first_seen_at, platform: (r as any).platform });
  return out;
}

function talentBoardChecklist(
  install: { first_seen_at: string; platform: string } | undefined,
  webinarAttendedAt: string | null | undefined,
): TalentBoardChecklist {
  return {
    app_downloaded_at: install?.first_seen_at ?? null,
    app_platform: install?.platform ?? null,
    webinar_attended_at: webinarAttendedAt ?? null,
  };
}

/**
 * Batch-compute the journey for a set of talents. One query per table.
 */
async function journeysFor(
  talents: Array<{
    id: string;
    full_name: string | null;
    languages_spoken: unknown;
    onboarding_completed?: boolean | null;
    skip_onboarding?: boolean | null;
    onboarding_webinar_attended_at?: string | null;
  }>,
): Promise<Map<string, JourneySummary>> {
  const out = new Map<string, JourneySummary>();
  const ids = talents.map((t) => t.id);
  if (ids.length === 0) return out;

  const [basicRes, profRes, startsRes, programProgress, installs] = await Promise.all([
    supabaseAdmin.from('talent_profiles_basic').select(BASIC_COLUMNS).in('talent_user_id', ids),
    supabaseAdmin
      .from('talent_profiles')
      .select('id, talent_user_id, status, requested_changes, changes_requested_at, resubmitted_at, reviewed_at')
      .in('talent_user_id', ids)
      .is('deleted_at', null),
    supabaseAdmin.from('training_course_starts').select('talent_user_id').in('talent_user_id', ids),
    programProgressFor(ids),
    appInstallsFor(ids),
  ]);

  const basicBy = new Map<string, Record<string, any>>();
  for (const row of basicRes.data ?? []) basicBy.set((row as any).talent_user_id, row as any);

  interface ProfileLite {
    id: string;
    status: string;
    requested_changes: unknown;
    changes_requested_at: string | null;
    resubmitted_at: string | null;
    reviewed_at: string | null;
  }
  const profilesBy = new Map<string, ProfileLite[]>();
  for (const row of profRes.data ?? []) {
    const r = row as any;
    const arr = profilesBy.get(r.talent_user_id) ?? [];
    arr.push({
      id: r.id,
      status: r.status,
      requested_changes: r.requested_changes ?? null,
      changes_requested_at: r.changes_requested_at ?? null,
      resubmitted_at: r.resubmitted_at ?? null,
      reviewed_at: r.reviewed_at ?? null,
    });
    profilesBy.set(r.talent_user_id, arr);
  }

  const started = new Set<string>((startsRes.data ?? []).map((r: any) => r.talent_user_id));

  const allProfileIds = [...profilesBy.values()].flat().map((p) => p.id);
  const portfolioCountByProfile = new Map<string, number>();
  if (allProfileIds.length > 0) {
    const { data: rows } = await supabaseAdmin
      .from('portfolio_items')
      .select('profile_id')
      .in('profile_id', allProfileIds);
    for (const r of rows ?? []) {
      const pid = (r as any).profile_id as string;
      portfolioCountByProfile.set(pid, (portfolioCountByProfile.get(pid) ?? 0) + 1);
    }
  }

  for (const t of talents) {
    const basic = basicBy.get(t.id) ?? null;
    const checklist = basicProfileChecklist(basic, {
      full_name: t.full_name ?? null,
      languages_spoken: t.languages_spoken,
    });
    const profiles = profilesBy.get(t.id) ?? [];
    const counts = {
      total: profiles.length,
      draft: 0,
      pending_review: 0,
      changes_requested: 0,
      approved: 0,
      rejected: 0,
    };
    let changesRequestedAt: string | null = null;
    let requestedLabels: string[] = [];
    let resubmittedAt: string | null = null;
    for (const p of profiles) {
      if (p.status in counts) (counts as any)[p.status] += 1;
      const liveChangesOpen = p.status === 'approved' && !!p.changes_requested_at && p.reviewed_at === null;
      if (liveChangesOpen) {
        counts[p.resubmitted_at ? 'pending_review' : 'changes_requested'] += 1;
      }
      const draftNudged = p.status === 'draft' && !!p.changes_requested_at;
      if ((p.status === 'changes_requested' || draftNudged || (liveChangesOpen && !p.resubmitted_at)) && p.changes_requested_at) {
        if (!changesRequestedAt || p.changes_requested_at < changesRequestedAt) {
          changesRequestedAt = p.changes_requested_at;
          requestedLabels = Array.isArray(p.requested_changes)
            ? p.requested_changes.map((c: any) => String(c?.label ?? '')).filter(Boolean)
            : [];
        }
      }
      if ((p.status === 'pending_review' || liveChangesOpen) && p.resubmitted_at) {
        if (!resubmittedAt || p.resubmitted_at > resubmittedAt) resubmittedAt = p.resubmitted_at;
      }
    }
    const portfolioItems = profiles.reduce(
      (sum, p) => sum + (portfolioCountByProfile.get(p.id) ?? 0),
      0,
    );
    out.set(t.id, {
      signed_up: true,
      onboarding_completed: !!t.onboarding_completed || !!t.skip_onboarding,
      onboarding_bypassed: !!t.skip_onboarding,
      course_started: started.has(t.id),
      program_courses: programProgress.get(t.id) ?? { jobs: null, partner: null },
      basic_profile_completed: isBasicProfileMandatoryComplete(basic, {
        full_name: t.full_name ?? null,
        languages_spoken: t.languages_spoken,
      }),
      basic_missing: checklist.filter((c) => c.required && !c.done).map((c) => c.key),
      // changes_requested counts as submitted: the talent did their part once;
      // the funnel shouldn't yank them back to "Job Profile".
      job_profile_completed: counts.pending_review + counts.changes_requested + counts.approved > 0,
      job_profiles: counts,
      changes_requested_at: changesRequestedAt,
      requested_change_labels: requestedLabels,
      resubmitted_at: resubmittedAt,
      portfolio_completed: portfolioItems > 0,
      portfolio_items: portfolioItems,
      talent_board: talentBoardChecklist(installs.get(t.id), t.onboarding_webinar_attended_at),
    });
  }
  return out;
}

const TALENT_LIST_COLUMNS =
  'id, full_name, phone, current_location, approval_status, wants_jobs, partner_approval_status, is_active, suspended, blacklisted, ' +
  'created_at, approved_at, pipeline_stage, jobs_pipeline_stage, onboarding_completed, skip_onboarding, languages_spoken, ' +
  'crm_talent_pipeline_name, crm_talent_stage_id, crm_talent_stage_name, crm_talent_stage_changed_at, ' +
  'crm_jobs_pipeline_name, crm_jobs_stage_id, crm_jobs_stage_name, crm_jobs_stage_changed_at, ' +
  'rejection_reason, rejected_at, partner_rejection_reason, partner_rejected_at, jobs_rejection_reason, jobs_rejected_at, ' +
  'application_cancelled_at, application_cancelled_reason, rc_anchor_at, rc_reminders_sent, rc_last_sent_at, ' +
  'onboarding_webinar_attended_at, crm_message_failed_at, crm_message_failed_template, crm_message_failed_reason';

/** Latest failed CRM WhatsApp send, or null (see crm_message_failed_* columns). */
function messageFailedFor(u: any): { at: string; template: string | null; reason: string | null } | null {
  return u.crm_message_failed_at
    ? { at: u.crm_message_failed_at, template: u.crm_message_failed_template ?? null, reason: u.crm_message_failed_reason ?? null }
    : null;
}

/**
 * Talent ids matching an "attention" filter. Each is a cheap id-set query so
 * it can be AND-ed into the main talent_users query as an `in` filter.
 * Returns null for "no restriction".
 */
async function attentionIds(attention: HubAttention | undefined, track?: 'partner' | 'jobs'): Promise<string[] | null> {
  if (!attention) return null;
  const ids = new Set<string>();

  if (attention === 'pending_approval') {
    const { data } = await supabaseAdmin.from('talent_users').select('id')
      .eq(track === 'partner' ? 'partner_approval_status' : 'approval_status', 'pending');
    for (const r of data ?? []) ids.add((r as any).id);
    return [...ids];
  }

  if (attention === 'needs_review' || attention === 'waiting_on_talent') {
    const { data } = await supabaseAdmin
      .from('talent_profiles')
      .select('talent_user_id')
      .or(attention === 'needs_review'
        ? 'status.eq.pending_review,and(status.eq.approved,changes_requested_at.not.is.null,reviewed_at.is.null,resubmitted_at.not.is.null)'
        : 'status.eq.changes_requested,and(status.eq.draft,changes_requested_at.not.is.null),and(status.eq.approved,changes_requested_at.not.is.null,reviewed_at.is.null,resubmitted_at.is.null)')
      .is('deleted_at', null);
    for (const r of data ?? []) ids.add((r as any).talent_user_id);
    // Basic-profile change requests live on talent_profiles_basic (always
    // live, no status): resubmitted → needs review, open → waiting on talent.
    const { data: basicRows } = await supabaseAdmin
      .from('talent_profiles_basic')
      .select('talent_user_id')
      .not('changes_requested_at', 'is', null)
      .is('reviewed_at', null)
      .filter('resubmitted_at', attention === 'needs_review' ? 'not.is' : 'is', null);
    for (const r of basicRows ?? []) ids.add((r as any).talent_user_id);
    return [...ids];
  }

  if (attention === 'message_failed') {
    const { data } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .not('crm_message_failed_at', 'is', null);
    for (const r of data ?? []) ids.add((r as any).id);
    return [...ids];
  }

  if (attention === 'course_pending') {
    const { data } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .eq('onboarding_completed', false)
      .eq('skip_onboarding', false);
    for (const r of data ?? []) ids.add((r as any).id);
    return [...ids];
  }

  // basic_incomplete / no_job_profile need per-row evaluation: pull the
  // candidates that have passed the course (the stage where these matter)
  // and evaluate in memory. Bounded — talents who finished onboarding.
  const { data: talents } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, languages_spoken, onboarding_completed, skip_onboarding')
    .or('onboarding_completed.eq.true,skip_onboarding.eq.true');
  const journeys = await journeysFor((talents ?? []) as any[]);
  for (const [id, j] of journeys) {
    if (attention === 'basic_incomplete' && !j.basic_profile_completed) ids.add(id);
    if (attention === 'no_job_profile' && j.basic_profile_completed && !j.job_profile_completed) {
      ids.add(id);
    }
  }
  return [...ids];
}

export async function listHub(filters: HubListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const view = filters.view ?? 'active';

  // Id-set exclusions and restrictions are resolved up front so the talent
  // query can be built twice (see grouping below) without refetching them.
  let excludeIds: string[] = [];
  if (view === 'active' && (filters.track === 'partner' || filters.track === 'jobs')) {
    // Graduated talents (talent-board "Onboarding completed") live in Partner
    // Program / Jobs now — keep the onboarding hub as the active queue.
    // Excluded here at the DB level so pagination/counts stay correct.
    // Uses id exclusion (not `not.ilike`) so NULL stage rows are kept.
    const graduatedColumn = filters.track === 'jobs' ? 'crm_jobs_stage_name' : 'crm_talent_stage_name';
    const { data: graduatedRows } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .ilike(graduatedColumn, GRADUATED_TALENT_STAGE);
    excludeIds.push(...(graduatedRows ?? []).map((r: any) => r.id).filter(Boolean));
  } else if (view === 'active') {
    const [{ data: g1 }, { data: g2 }] = await Promise.all([
      supabaseAdmin.from('talent_users').select('id').ilike('crm_talent_stage_name', GRADUATED_TALENT_STAGE),
      supabaseAdmin.from('talent_users').select('id').ilike('crm_jobs_stage_name', GRADUATED_TALENT_STAGE),
    ]);
    excludeIds.push(...[...(g1 ?? []), ...(g2 ?? [])].map((r: any) => r.id).filter(Boolean));
  }
  // Rejected / disqualified talents live in their own section, never the
  // active queue. Id exclusion (not `neq`) so NULL-stage rows are kept.
  if (view === 'active') {
    const rejectedQuery = supabaseAdmin.from('talent_users').select('id');
    const { data: rejectedRows } = filters.track === 'jobs'
      ? await rejectedQuery.eq('jobs_pipeline_stage', 'rejected')
      : await rejectedQuery.or('pipeline_stage.eq.rejected,partner_approval_status.eq.rejected');
    excludeIds.push(...(rejectedRows ?? []).map((r: any) => r.id).filter(Boolean));
  }
  excludeIds = [...new Set(excludeIds)];

  const cat = parseSignupCategory(filters.category);
  const categoryIds = await talentIdsForSignupCategory(cat);
  const attention = await attentionIds(filters.attention, filters.track);
  const restrict = intersect(categoryIds, attention);
  if (restrict && restrict.length === 0) {
    return { users: [], total: 0, page, limit, total_pages: 0 };
  }

  let searchOr: string | null = null;
  const search = filters.search?.trim();
  if (search) {
    const like = `%${search.replace(/[%_,]/g, (c) => `\\${c}`)}%`;
    const digits = search.replace(/\D/g, '').slice(-10);
    const orParts = [`full_name.ilike.${like}`];
    if (digits.length >= 4) orParts.push(`phone.ilike.%${digits}%`);
    const { data: emailHits } = await supabaseAdmin
      .from('admin_talent_search')
      .select('id')
      .ilike('email', like)
      .limit(200);
    const emailIds = (emailHits ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    if (emailIds.length) orParts.push(`id.in.(${emailIds.join(',')})`);
    searchOr = orParts.join(',');
  }

  const stageColumn = filters.track === 'jobs' ? 'jobs_pipeline_stage' : 'pipeline_stage';
  const talentStage = (filters.talent_stage ?? '').trim();
  const talentStageColumn = filters.track === 'jobs' ? 'crm_jobs_stage_id' : 'crm_talent_stage_id';
  const stage = (filters.pipeline_stage ?? '').trim().toLowerCase();

  const build = (opts: { head?: boolean } = {}) => {
    let qb = supabaseAdmin
      .from('talent_users')
      .select(TALENT_LIST_COLUMNS, { count: 'exact', head: opts.head })
      .order('created_at', { ascending: filters.sort === 'oldest' });
    if (filters.track === 'partner') qb = qb.not('partner_approval_status', 'is', null);
    if (filters.track === 'jobs') qb = qb.eq('wants_jobs', true);
    // Suspended / blacklisted talents live in Blocked Users, never the hub.
    qb = qb.not('suspended', 'is', true).not('blacklisted', 'is', true);
    // Cancelled applicants live in their own section until restored.
    qb = view === 'cancelled'
      ? qb.not('application_cancelled_at', 'is', null)
      : qb.is('application_cancelled_at', null);
    if (excludeIds.length > 0) qb = qb.not('id', 'in', `(${excludeIds.join(',')})`);
    if (view === 'rejected') {
      qb = filters.track === 'jobs'
        ? qb.eq('jobs_pipeline_stage', 'rejected')
        : qb.or('pipeline_stage.eq.rejected,partner_approval_status.eq.rejected');
    } else if (view === 'active' && stage && stage !== 'all') {
      qb = qb.eq(stageColumn, stage);
    }
    // A talent-board tab can span several boards' same-named stage (id,id,…).
    if (talentStage === 'none') qb = qb.is(talentStageColumn, null);
    else if (talentStage && talentStage !== 'all') qb = qb.in(talentStageColumn, talentStage.split(','));
    if (restrict) qb = qb.in('id', restrict);
    if (searchOr) qb = qb.or(searchOr);
    return qb;
  };

  // Within a stage, talents waiting on requested changes sit below the rest:
  // page through "others" first, then continue into the request-changes group.
  const open = await openChangeRequests();
  const rcIds = view === 'active' ? [...open.keys()] : [];
  let rows: any[];
  let total: number;
  if (rcIds.length === 0) {
    const { data, error, count } = await build().range(offset, offset + limit - 1);
    if (error) throw new AppError(500, error.message);
    rows = (data ?? []) as any[];
    total = count ?? 0;
  } else {
    const rcList = `(${rcIds.join(',')})`;
    // Count both groups first — PostgREST rejects a range past the end (416).
    const [othersRes, rcRes] = await Promise.all([
      build({ head: true }).not('id', 'in', rcList),
      build({ head: true }).in('id', rcIds),
    ]);
    if (othersRes.error) throw new AppError(500, othersRes.error.message);
    if (rcRes.error) throw new AppError(500, rcRes.error.message);
    const others = othersRes.count ?? 0;
    const rcCount = rcRes.count ?? 0;
    rows = [];
    if (offset < others) {
      const { data, error } = await build()
        .not('id', 'in', rcList)
        .range(offset, Math.min(offset + limit, others) - 1);
      if (error) throw new AppError(500, error.message);
      rows = (data ?? []) as any[];
    }
    const rcOffset = Math.max(0, offset - others);
    const rcNeeded = limit - rows.length;
    if (rcNeeded > 0 && rcOffset < rcCount) {
      const { data, error } = await build()
        .in('id', rcIds)
        .range(rcOffset, Math.min(rcOffset + rcNeeded, rcCount) - 1);
      if (error) throw new AppError(500, error.message);
      rows = [...rows, ...((data ?? []) as any[])];
    }
    total = others + rcCount;
  }

  const ids = rows.map((u) => u.id as string);

  const [emailMap, catMap, journeys, leadMap] = await Promise.all([
    emailsFor(ids),
    signupCategoriesByTalentIds(ids),
    journeysFor(rows),
    leadsFor(ids),
  ]);

  const users = rows.map((u) => ({
    id: u.id,
    full_name: u.full_name,
    phone: u.phone,
    email: emailMap.get(u.id) ?? null,
    current_location: u.current_location,
    approval_status: u.approval_status,
    wants_jobs: u.wants_jobs,
    partner_approval_status: u.partner_approval_status,
    is_active: u.is_active,
    suspended: u.suspended,
    blacklisted: u.blacklisted,
    created_at: u.created_at,
    approved_at: u.approved_at,
    pipeline_stage: (filters.track === 'partner' && u.partner_approval_status === 'rejected'
      ? 'rejected' : filters.track === 'jobs' ? u.jobs_pipeline_stage : u.pipeline_stage) ?? 'application_approved',
    rejection_reason: rejectionFor(u, filters.track).reason,
    rejected_at: rejectionFor(u, filters.track).at,
    partner_rejected: u.partner_approval_status === 'rejected' || u.pipeline_stage === 'rejected',
    jobs_rejected: u.jobs_pipeline_stage === 'rejected',
    application_cancelled_at: u.application_cancelled_at ?? null,
    application_cancelled_reason: u.application_cancelled_reason ?? null,
    under_request_changes: open.has(u.id),
    request_changes: rcStatusFor(open.get(u.id), u),
    message_failed: messageFailedFor(u),
    crm_talent_pipeline_name: (filters.track === 'jobs' ? u.crm_jobs_pipeline_name : u.crm_talent_pipeline_name) ?? null,
    crm_talent_stage_id: (filters.track === 'jobs' ? u.crm_jobs_stage_id : u.crm_talent_stage_id) ?? null,
    crm_talent_stage_name: (filters.track === 'jobs' ? u.crm_jobs_stage_name : u.crm_talent_stage_name) ?? null,
    crm_talent_stage_changed_at: (filters.track === 'jobs' ? u.crm_jobs_stage_changed_at : u.crm_talent_stage_changed_at) ?? null,
    categories: catMap.get(u.id) ?? [],
    lead: leadMap.get(u.id) ?? null,
    journey: journeys.get(u.id) ?? null,
  }));

  return {
    users,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

function intersect(a: string[] | null, b: string[] | null): string[] | null {
  if (!a) return b;
  if (!b) return a;
  const set = new Set(b);
  return a.filter((id) => set.has(id));
}

async function emailsFor(ids: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!ids.length) return map;
  const { data } = await supabaseAdmin.rpc('get_auth_users_by_ids', { id_list: ids });
  for (const row of (data ?? []) as { id: string; email: string | null }[]) {
    map.set(row.id, row.email ?? null);
  }
  return map;
}

/** Latest non-deleted candidate lead per talent (id, form_type, status). */
async function leadsFor(
  ids: string[],
): Promise<Map<string, { id: string; form_type: string; status: string }>> {
  const map = new Map<string, { id: string; form_type: string; status: string }>();
  if (!ids.length) return map;
  const { data } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, form_type, status, linked_talent_user_id, created_at')
    .in('linked_talent_user_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  for (const row of (data ?? []) as any[]) {
    if (!map.has(row.linked_talent_user_id)) {
      map.set(row.linked_talent_user_id, {
        id: row.id,
        form_type: row.form_type,
        status: row.status,
      });
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Stats — counts for the funnel strips and attention chips
// ---------------------------------------------------------------------------

export async function hubStats(category?: string, track?: 'partner' | 'jobs') {
  const cat = parseSignupCategory(category);
  const categoryIds = await talentIdsForSignupCategory(cat);
  const empty = {
    total: 0,
    pending: 0,
    by_pipeline_stage: {} as Record<string, number>,
    by_talent_stage: {} as Record<string, number>,
    live_by_talent_stage: {} as Record<string, number>,
    in_talent_pipeline: 0,
    rejected: 0,
    cancelled: 0,
    rc_by_pipeline_stage: {} as Record<string, number>,
    rc_live_by_talent_stage: {} as Record<string, number>,
    attention: { pending_approval: 0, needs_review: 0, waiting_on_talent: 0, message_failed: 0 },
  };
  if (categoryIds && categoryIds.length === 0) return empty;

  let qb = supabaseAdmin
    .from('talent_users')
    .select('id, approval_status, partner_approval_status, wants_jobs, pipeline_stage, jobs_pipeline_stage, crm_talent_stage_id, crm_jobs_stage_id, crm_talent_stage_name, crm_jobs_stage_name, application_cancelled_at, crm_message_failed_at')
    .not('suspended', 'is', true)
    .not('blacklisted', 'is', true);
  if (categoryIds) qb = qb.in('id', categoryIds);
  if (track === 'partner') qb = qb.not('partner_approval_status', 'is', null);
  if (track === 'jobs') qb = qb.eq('wants_jobs', true);
  const [{ data: allRows, error }, open] = await Promise.all([qb, openChangeRequests()]);
  if (error) throw new AppError(500, error.message);
  // Cancelled applicants are counted for their own section only.
  const cancelled = ((allRows ?? []) as any[]).filter((r) => r.application_cancelled_at).length;
  const data = ((allRows ?? []) as any[]).filter((r) => !r.application_cancelled_at);

  // Same graduation rule as listHub: hide "Onboarding completed" from the queue.
  const visible = data.filter((r) => {
    const stageName = track === 'jobs' ? r.crm_jobs_stage_name : track === 'partner' ? r.crm_talent_stage_name : null;
    if (track) return !isGraduatedTalentStageName(stageName);
    return !isGraduatedTalentStageName(r.crm_talent_stage_name) && !isGraduatedTalentStageName(r.crm_jobs_stage_name);
  });
  // Rejected talents are counted for the Rejected section only — they are
  // out of the funnel, the totals and the attention chips.
  const isRejected = (r: any) => track === 'jobs'
    ? r.jobs_pipeline_stage === 'rejected'
    : r.pipeline_stage === 'rejected' || r.partner_approval_status === 'rejected';
  const rejected = data.filter(isRejected).length;
  const rows = visible.filter((r) => !isRejected(r));
  const byStage: Record<string, number> = {};
  const byTalentStage: Record<string, number> = {};
  // Live candidates grouped by talent-board stage ('none' = not on the board),
  // so the Live tabs' counts match the list they filter.
  const liveByTalentStage: Record<string, number> = {};
  // The small "under request changes" count shown under each big number.
  const rcByStage: Record<string, number> = {};
  const rcLiveByTalentStage: Record<string, number> = {};
  let waitingOnTalent = 0;
  let messageFailed = 0;
  let pending = 0;
  let inTalent = 0;
  for (const r of rows) {
    const s = (track === 'jobs' ? r.jobs_pipeline_stage : r.pipeline_stage) ?? 'application_approved';
    byStage[s] = (byStage[s] ?? 0) + 1;
    if ((track === 'partner' ? r.partner_approval_status : r.approval_status) === 'pending') pending += 1;
    const talentStageId = track === 'jobs' ? r.crm_jobs_stage_id : r.crm_talent_stage_id;
    if (talentStageId) {
      inTalent += 1;
      byTalentStage[talentStageId] = (byTalentStage[talentStageId] ?? 0) + 1;
    }
    if (r.crm_message_failed_at) messageFailed += 1;
    const rc = open.has(r.id);
    if (rc) {
      waitingOnTalent += 1;
      rcByStage[s] = (rcByStage[s] ?? 0) + 1;
    }
    if (s === 'live') {
      const key = talentStageId || 'none';
      liveByTalentStage[key] = (liveByTalentStage[key] ?? 0) + 1;
      if (rc) rcLiveByTalentStage[key] = (rcLiveByTalentStage[key] ?? 0) + 1;
    }
  }

  const idSet = new Set(rows.map((r) => r.id));
  const { data: reviewRows } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id, status, changes_requested_at, reviewed_at, resubmitted_at')
    .or('status.in.(pending_review,changes_requested),and(status.eq.draft,changes_requested_at.not.is.null),and(status.eq.approved,changes_requested_at.not.is.null,reviewed_at.is.null)')
    .is('deleted_at', null);
  const needsReview = new Set<string>();
  for (const r of reviewRows ?? []) {
    const id = (r as any).talent_user_id as string;
    if (!idSet.has(id)) continue;
    if ((r as any).status === 'pending_review' || ((r as any).status === 'approved' && (r as any).resubmitted_at)) needsReview.add(id);
  }

  return {
    total: rows.length,
    pending,
    by_pipeline_stage: byStage,
    by_talent_stage: byTalentStage,
    live_by_talent_stage: liveByTalentStage,
    in_talent_pipeline: inTalent,
    rejected,
    cancelled,
    rc_by_pipeline_stage: rcByStage,
    rc_live_by_talent_stage: rcLiveByTalentStage,
    attention: {
      pending_approval: pending,
      needs_review: needsReview.size,
      waiting_on_talent: waitingOnTalent,
      message_failed: messageFailed,
    },
  };
}

// ---------------------------------------------------------------------------
// Journey detail for one talent
// ---------------------------------------------------------------------------

export async function talentJourney(userId: string, track: 'partner' | 'jobs' = 'partner') {
  const { data: talent, error } = await supabaseAdmin
    .from('talent_users')
    .select(
      TALENT_LIST_COLUMNS +
        ', profile_photo_url, skip_onboarding_reason, skip_onboarding_at, signup_form_type',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!talent) throw new AppError(404, 'Talent not found');
  const t = talent as any;

  const [basicRes, profilesRes, authRes, leadRes, cats, programProgress, installs] = await Promise.all([
    supabaseAdmin.from('talent_profiles_basic').select('*').eq('talent_user_id', userId).maybeSingle(),
    supabaseAdmin
      .from('talent_profiles')
      .select('id, category_id, status, is_active, tier, tier_custom, field_data, created_at, updated_at, requested_changes, changes_requested_at, resubmitted_at, reviewed_at, changes_whatsapp_sent, paused_at, paused_by_role, paused_by_name, categories(name, slug)')
      .eq('talent_user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from('lead_submissions')
      .select('id, form_type, status, form_data, resume_url, profile_type, profile_type_custom, created_at')
      .eq('linked_talent_user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    signupCategoriesByTalentIds([userId]),
    programProgressFor([userId]),
    appInstallsFor([userId]),
  ]);

  const basic = (basicRes.data ?? null) as Record<string, any> | null;
  const profiles = (profilesRes.data ?? []) as any[];
  const profileIds = profiles.map((p) => p.id as string);

  const portfolioByProfile = new Map<string, number>();
  if (profileIds.length) {
    const { data: rows } = await supabaseAdmin
      .from('portfolio_items')
      .select('profile_id')
      .in('profile_id', profileIds);
    for (const r of rows ?? []) {
      const pid = (r as any).profile_id as string;
      portfolioByProfile.set(pid, (portfolioByProfile.get(pid) ?? 0) + 1);
    }
  }

  // Drafts: which required form fields are still empty, so the admin
  // "Request changes" nudge can pre-tick exactly what blocks submission.
  const draftCategoryIds = [...new Set(profiles.filter((p) => p.status === 'draft').map((p) => p.category_id as string))];
  const requiredByCategory = new Map<string, string[]>();
  if (draftCategoryIds.length) {
    const { data: rows } = await supabaseAdmin
      .from('category_fields')
      .select('category_id, field_key')
      .in('category_id', draftCategoryIds)
      .eq('is_active', true)
      .eq('is_required', true);
    for (const r of rows ?? []) {
      const cid = (r as any).category_id as string;
      requiredByCategory.set(cid, [...(requiredByCategory.get(cid) ?? []), (r as any).field_key as string]);
    }
  }
  const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  // Course progress — reuse the talent-facing payload so the numbers match
  // what the talent sees on their dashboard.
  let course: {
    items: Array<{ id: string; title: string; completed: number; total: number; started_at: string | null }>;
    completed: number;
    total: number;
  } = { items: [], completed: 0, total: 0 };
  try {
    const { getOnboardingItems, getStartedGateCategoryIds } = await import(
      './training-content.service.js'
    );
    const categoryIds = [...new Set(profiles.map((p) => p.category_id as string).filter(Boolean))];
    const gate = await getStartedGateCategoryIds(userId).catch(() => [] as string[]);
    const items = await getOnboardingItems(userId, [...new Set([...categoryIds, ...gate])]);
    course = {
      items: items.map((i) => ({
        id: i.id,
        title: i.title,
        completed: i.completed_count,
        total: i.total_count,
        started_at: i.started_at,
      })),
      completed: items.reduce((s, i) => s + i.completed_count, 0),
      total: items.reduce((s, i) => s + i.total_count, 0),
    };
  } catch (err) {
    console.error('[onboarding-hub] course progress failed:', err);
  }

  const checklist = basicProfileChecklist(basic, {
    full_name: t.full_name ?? null,
    languages_spoken: t.languages_spoken,
  });
  const portfolioItems = profileIds.reduce((s, id) => s + (portfolioByProfile.get(id) ?? 0), 0);

  const talentPipeline = await talentPipelineFor(userId, track === 'jobs' ? t.crm_jobs_pipeline_name : t.crm_talent_pipeline_name, track);

  return {
    user: {
      id: t.id,
      full_name: t.full_name,
      phone: t.phone,
      email: authRes.data?.user?.email ?? null,
      profile_photo_url: t.profile_photo_url ?? basic?.profile_picture_url ?? null,
      current_location: t.current_location,
      approval_status: t.approval_status,
      wants_jobs: t.wants_jobs,
      partner_approval_status: t.partner_approval_status,
      rejection_reason: rejectionFor(t, track).reason,
      rejected_at: rejectionFor(t, track).at,
      partner_rejected: t.partner_approval_status === 'rejected' || t.pipeline_stage === 'rejected',
      jobs_rejected: t.jobs_pipeline_stage === 'rejected',
      application_cancelled_at: t.application_cancelled_at ?? null,
      application_cancelled_reason: t.application_cancelled_reason ?? null,
      request_changes: rcStatusFor((await openChangeRequests([userId])).get(userId), t),
      message_failed: messageFailedFor(t),
      is_active: t.is_active,
      suspended: t.suspended,
      blacklisted: t.blacklisted,
      created_at: t.created_at,
      approved_at: t.approved_at,
      languages_spoken: t.languages_spoken ?? [],
      skip_onboarding: !!t.skip_onboarding,
      skip_onboarding_reason: t.skip_onboarding_reason ?? null,
      pipeline_stage: (track === 'partner' && t.partner_approval_status === 'rejected'
        ? 'rejected' : track === 'jobs' ? t.jobs_pipeline_stage : t.pipeline_stage) ?? 'application_approved',
      crm_talent_pipeline_name: (track === 'jobs' ? t.crm_jobs_pipeline_name : t.crm_talent_pipeline_name) ?? null,
      crm_talent_stage_id: (track === 'jobs' ? t.crm_jobs_stage_id : t.crm_talent_stage_id) ?? null,
      crm_talent_stage_name: (track === 'jobs' ? t.crm_jobs_stage_name : t.crm_talent_stage_name) ?? null,
      crm_talent_stage_changed_at: (track === 'jobs' ? t.crm_jobs_stage_changed_at : t.crm_talent_stage_changed_at) ?? null,
      categories: cats.get(userId) ?? [],
    },
    journey: {
      signed_up: true,
      onboarding_completed: !!t.onboarding_completed || !!t.skip_onboarding,
      onboarding_bypassed: !!t.skip_onboarding,
      course,
      program_courses: programProgress.get(userId) ?? { jobs: null, partner: null },
      basic_profile_completed: isBasicProfileMandatoryComplete(basic, {
        full_name: t.full_name ?? null,
        languages_spoken: t.languages_spoken,
      }),
      basic_checklist: checklist,
      job_profile_completed: profiles.some(
        (p) => p.status === 'approved' || p.status === 'pending_review',
      ),
      portfolio_completed: portfolioItems > 0,
      portfolio_items: portfolioItems,
      talent_board: talentBoardChecklist(installs.get(userId), t.onboarding_webinar_attended_at),
    },
    basic,
    profiles: profiles.map((p) => ({
      id: p.id,
      category_id: p.category_id,
      category_name: p.categories?.name ?? null,
      category_slug: p.categories?.slug ?? null,
      status: p.status,
      is_active: p.is_active,
      tier: p.tier ?? null,
      tier_custom: p.tier_custom ?? null,
      portfolio_items: portfolioByProfile.get(p.id) ?? 0,
      missing_required_fields: p.status === 'draft'
        ? (requiredByCategory.get(p.category_id) ?? []).filter((k) => isEmpty(p.field_data?.[k]))
        : [],
      created_at: p.created_at,
      updated_at: p.updated_at,
      requested_changes: Array.isArray(p.requested_changes) ? p.requested_changes : [],
      changes_requested_at: p.changes_requested_at ?? null,
      resubmitted_at: p.resubmitted_at ?? null,
      reviewed_at: p.reviewed_at ?? null,
      changes_whatsapp_sent: p.changes_whatsapp_sent ?? null,
      paused_at: p.paused_at ?? null,
      paused_by_role: p.paused_by_role ?? null,
      paused_by_name: p.paused_by_name ?? null,
    })),
    lead: leadRes.data ?? null,
    talent_pipeline: talentPipeline.config
      ? { form_type: talentPipeline.formType, ...talentPipeline.config }
      : null,
  };
}

// ---------------------------------------------------------------------------
// CRM talent-pipeline stage — inbound (webhook) and outbound (admin move)
// ---------------------------------------------------------------------------

/** Called by the inbound CRM webhook when a card moves inside a talent pipeline. */
export async function applyInboundTalentStage(
  talentUserId: string,
  input: { pipeline_name: string | null; stage_id: string | null; stage_name: string },
  /**
   * Linked Jobs + Partner talent: mirror onto the other track's board.
   * 'forward' (default, CRM echoes) never moves the other card back — a Jobs
   * card's first arrival must not drag the Partner card to Welcome; 'any' is
   * an admin's explicit move; false skips.
   */
  opts: { mirror?: 'forward' | 'any' | false } = {},
): Promise<'partner' | 'jobs'> {
  const jobs = Object.entries(await getTalentPipelineConfig()).some(([key, cfg]) =>
    isJobsKey(key) && normalizeStage(cfg.pipeline_name) === normalizeStage(input.pipeline_name ?? ''));
  const { error } = await supabaseAdmin
    .from('talent_users')
    .update(jobs ? {
      crm_jobs_pipeline_name: input.pipeline_name,
      crm_jobs_stage_id: input.stage_id ?? normalizeStage(input.stage_name),
      crm_jobs_stage_name: input.stage_name,
      crm_jobs_stage_changed_at: new Date().toISOString(),
    } : {
      crm_talent_pipeline_name: input.pipeline_name,
      crm_talent_stage_id: input.stage_id ?? normalizeStage(input.stage_name),
      crm_talent_stage_name: input.stage_name,
      crm_talent_stage_changed_at: new Date().toISOString(),
    })
    .eq('id', talentUserId);
  if (error) throw new AppError(500, error.message);

  // Reached "Webinar registered" outside Training (WhatsApp button / admin
  // move) — give them an actual registration so the Webinars module lists them.
  if (normalizeStage(input.stage_name) === WEBINAR_REGISTERED_STAGE) {
    try {
      const { ensureRegisteredForUpcomingWebinar } = await import('./webinars.service.js');
      await ensureRegisteredForUpcomingWebinar(talentUserId);
    } catch (err) {
      console.error('[onboarding-hub] webinar auto-registration failed:', err);
    }
  }

  const track = jobs ? 'jobs' : 'partner';
  if (opts.mirror !== false) {
    await mirrorTalentStage(talentUserId, track, input.stage_name, opts.mirror ?? 'forward').catch((err) =>
      console.error('[onboarding-hub] talent-board mirror failed:', err));
  }
  return track;
}

/**
 * A linked Jobs + Partner talent moved on one track's talent board — put the
 * other track's card on the same-named stage. The Partner Program card
 * messages; the Jobs card moves silently. Skipped until the other track is
 * Live itself (its own qualify handoff puts it on the board), and when it is
 * already there — which is also what stops CRM echoes from looping.
 */
async function mirrorTalentStage(
  talentUserId: string,
  fromTrack: 'partner' | 'jobs',
  stageName: string,
  mode: 'forward' | 'any',
) {
  const { loadTrackState, isLinked } = await import('./linked-tracks.service.js');
  const t = await loadTrackState(talentUserId);
  if (!t || !isLinked(t)) return;
  const other = fromTrack === 'jobs' ? 'partner' : 'jobs';
  if ((other === 'jobs' ? t.jobs_pipeline_stage : t.pipeline_stage) !== 'live') return;

  const { data: cur } = await supabaseAdmin
    .from('talent_users')
    .select('crm_talent_pipeline_name, crm_talent_stage_name, crm_jobs_pipeline_name, crm_jobs_stage_name')
    .eq('id', talentUserId)
    .maybeSingle();
  const currentName = other === 'jobs' ? (cur as any)?.crm_jobs_stage_name : (cur as any)?.crm_talent_stage_name;
  if (normalizeStage(currentName ?? '') === normalizeStage(stageName)) return;

  const { config } = await talentPipelineFor(talentUserId,
    other === 'jobs' ? (cur as any)?.crm_jobs_pipeline_name ?? null : (cur as any)?.crm_talent_pipeline_name ?? null,
    other);
  const stage = config?.stages.find((s) => normalizeStage(s.name) === normalizeStage(stageName));
  if (!config || !stage) return;
  if (mode === 'forward') {
    const current = config.stages.find((s) => normalizeStage(s.name) === normalizeStage(currentName ?? ''));
    if (current && current.sort_order >= stage.sort_order) return;
  }

  await applyInboundTalentStage(talentUserId, {
    pipeline_name: config.pipeline_name,
    stage_id: stage.id,
    stage_name: stage.name,
  }, { mirror: false });
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(talentUserId);
  const { notifyCrmTalentStageChanged } = await import('./automation.service.js');
  await notifyCrmTalentStageChanged({
    talentUserId,
    adminUserId: null,
    name: t.full_name ?? '',
    email: authUser?.user?.email ?? null,
    phone: t.phone ?? null,
    pipelineName: config.pipeline_name,
    stageId: stage.id,
    stageName: stage.name,
    silent: other === 'jobs',
  });
}

/**
 * A card moved back onto a candidates board (or an admin moved the talent off
 * Live) — it's no longer on that track's talent board.
 */
export async function clearTalentStage(talentUserId: string, track: 'partner' | 'jobs' = 'partner') {
  await supabaseAdmin
    .from('talent_users')
    .update(track === 'jobs' ? {
      crm_jobs_pipeline_name: null,
      crm_jobs_stage_id: null,
      crm_jobs_stage_name: null,
      crm_jobs_stage_changed_at: null,
    } : {
      crm_talent_pipeline_name: null,
      crm_talent_stage_id: null,
      crm_talent_stage_name: null,
      crm_talent_stage_changed_at: null,
    })
    .eq('id', talentUserId)
    .not(track === 'jobs' ? 'crm_jobs_stage_id' : 'crm_talent_stage_id', 'is', null);
}

/**
 * Admin moved a talent on the hub's talent-pipeline strip. Persist locally,
 * then push to the CRM so the WhatsApp card follows (fire-and-log; the local
 * change stands even if the CRM is unreachable, mirroring pipeline_stage).
 */
export async function setTalentStage(
  talentUserId: string,
  input: { stage_id: string; track?: 'partner' | 'jobs' },
  adminUserId: string | null,
) {
  const { data: talent, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone, crm_talent_pipeline_name, crm_talent_stage_id, crm_jobs_pipeline_name, crm_jobs_stage_id')
    .eq('id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!talent) throw new AppError(404, 'Talent not found');

  const { config } = await talentPipelineFor(talentUserId,
    input.track === 'jobs' ? talent.crm_jobs_pipeline_name : talent.crm_talent_pipeline_name,
    input.track ?? 'partner');
  if (!config) {
    throw new AppError(
      400,
      'No CRM talent pipeline is linked for this talent\'s category. Link one under CRM Mapping first.',
    );
  }
  const stage = config.stages.find((s) => s.id === input.stage_id);
  if (!stage) throw new AppError(400, 'Unknown talent-pipeline stage');

  await applyInboundTalentStage(talentUserId, {
    pipeline_name: config.pipeline_name,
    stage_id: stage.id,
    stage_name: stage.name,
  }, { mirror: 'any' });

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(talentUserId);
  const { loadTrackState, jobsSilent } = await import('./linked-tracks.service.js');
  const silent = input.track === 'jobs' && jobsSilent(await loadTrackState(talentUserId));
  try {
    const { notifyCrmTalentStageChanged } = await import('./automation.service.js');
    await notifyCrmTalentStageChanged({
      talentUserId,
      adminUserId,
      silent,
      name: talent.full_name ?? '',
      email: authUser?.user?.email ?? null,
      phone: talent.phone ?? null,
      pipelineName: config.pipeline_name,
      stageId: stage.id,
      stageName: stage.name,
    });
  } catch (err) {
    console.error('[onboarding-hub] CRM talent-stage push failed:', err);
  }

  return { stage_id: stage.id, stage_name: stage.name, pipeline_name: config.pipeline_name };
}

/** The talent-board stages the webinar-registration auto-move connects. */
const WEBINAR_STAGE = 'onboarding webinar';
const WEBINAR_REGISTERED_STAGE = 'webinar registered';

/**
 * A talent registered for a webinar in the Training module. Anyone sitting on
 * the talent board's "Onboarding webinar" stage moves on to "Webinar
 * registered" (and the CRM card follows) — same outcome as tapping the
 * Registered button on the WhatsApp message. Other stages are left alone.
 */
export async function advanceOnWebinarRegistration(talentUserId: string): Promise<void> {
  const { data: t } = await supabaseAdmin
    .from('talent_users')
    .select('crm_talent_pipeline_name, crm_talent_stage_name, crm_jobs_pipeline_name, crm_jobs_stage_name')
    .eq('id', talentUserId)
    .maybeSingle();
  if (!t) return;
  const tracks: Array<{ track: 'partner' | 'jobs'; pipeline: string | null; stage: string | null }> = [
    { track: 'partner', pipeline: (t as any).crm_talent_pipeline_name, stage: (t as any).crm_talent_stage_name },
    { track: 'jobs', pipeline: (t as any).crm_jobs_pipeline_name, stage: (t as any).crm_jobs_stage_name },
  ];
  for (const { track, pipeline, stage } of tracks) {
    if (normalizeStage(stage ?? '') !== WEBINAR_STAGE) continue;
    const { config } = await talentPipelineFor(talentUserId, pipeline, track);
    const target = config?.stages.find((s) => normalizeStage(s.name) === WEBINAR_REGISTERED_STAGE);
    if (!target) continue;
    try {
      await setTalentStage(talentUserId, { stage_id: target.id, track }, null);
    } catch (err) {
      console.error('[onboarding-hub] webinar-registered auto-move failed:', err);
    }
  }
}

/** Admin dismissed the "WhatsApp message failed" flag. */
export async function clearMessageFailed(talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({ crm_message_failed_at: null, crm_message_failed_template: null, crm_message_failed_reason: null })
    .eq('id', talentUserId)
    .select('id')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Talent not found');
  return { success: true };
}

/**
 * Tick / untick the common onboarding webinar on the talent-board checklist.
 * There's no attendance feed from the meeting tool, so this is the admin's call.
 */
export async function setWebinarAttended(talentUserId: string, attended: boolean, adminUserId: string) {
  const attendedAt = attended ? new Date().toISOString() : null;
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({
      onboarding_webinar_attended_at: attendedAt,
      onboarding_webinar_attended_by: attended ? adminUserId : null,
    })
    .eq('id', talentUserId)
    .select('id')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Talent not found');
  return { webinar_attended_at: attendedAt };
}
