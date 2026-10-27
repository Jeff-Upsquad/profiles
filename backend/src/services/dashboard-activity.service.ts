// ---------------------------------------------------------------------------
// Dashboard activity report — user counts split live / inactive / new, per
// onboarding module (Partner Program vs Jobs), plus weekly signup series and
// the latest sign-ups for the dashboard's report section.
//
// Definitions stay aligned with the rest of the admin:
//   live      = is_active = true, not suspended/blacklisted (talent board)
//   inactive  = is_active = false, not suspended/blacklisted
//   blocked   = suspended or blacklisted (the Exceptions section owns these)
//   partner   = partner_approval_status IS NOT NULL      (hubStats filter)
//   jobs      = wants_jobs = true                        (hubStats filter)
// Funnel numbers also drop cancelled + rejected + graduated rows so the cards
// match what the onboarding hubs show.
// ---------------------------------------------------------------------------

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { normalizeStage } from './crm-stage-mapping.js';
import { finalChecksFor } from './final-checks.service.js';
import type { FinalChecksState } from '../lib/final-checks.js';

const GRADUATED_TALENT_STAGE = 'onboarding completed';

interface TalentRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
  is_active: boolean | null;
  suspended: boolean | null;
  blacklisted: boolean | null;
  suspended_at: string | null;
  blacklisted_at: string | null;
  wants_jobs: boolean | null;
  partner_approval_status: string | null;
  approval_status: string | null;
  pipeline_stage: string | null;
  jobs_pipeline_stage: string | null;
  application_cancellations: Record<string, { at?: string }> | null;
  crm_talent_stage_name: string | null;
  crm_jobs_stage_name: string | null;
}

export interface ModuleStats {
  /** Every talent that ever signed up for this track (incl. blocked/cancelled). */
  total_users: number;
  /** Total users excluding blocked and cancelled — the headline "Total users". */
  total_users_net: number;
  blocked: number;
  cancelled: number;
  live: number;
  inactive: number;
  new_7d: number;
  new_30d: number;
  /** Logged into the platform (web or app) within the window. */
  active_7d: number;
  active_30d: number;
  /** Mobile app: downloaded + seen in the app within the window. */
  app_installed: number;
  engaged_7d: number;
  engaged_30d: number;
  /** Current onboarding-funnel size (excl. blocked/cancelled/rejected/graduated). */
  total: number;
  pending_approval: number;
  rejected: number;
  by_stage: Record<string, number>;
}

export interface RecentSignup {
  id: string;
  full_name: string | null;
  phone: string | null;
  tracks: ('partner' | 'jobs')[];
  stage: string;
  live: boolean;
  created_at: string | null;
}

export interface DashboardActivity {
  generated_at: string;
  users: {
    talent: {
      total: number;
      live: number;
      inactive: number;
      blocked: number;
      new_7d: number;
      new_30d: number;
      app_installed: number;
      engaged_7d: number;
      engaged_30d: number;
    };
    business: {
      total: number;
      new_7d: number;
      new_30d: number;
    };
  };
  modules: {
    partner: ModuleStats;
    jobs: ModuleStats;
  };
  /** False until the get_auth_user_signins RPC (20261022000000) is applied —
   *  active_7d/30d then fall back to app-install activity. */
  login_tracking_available: boolean;
  signups_weekly: { week_start: string; partner: number; jobs: number }[];
  /** Latest sign-ups per onboarding module (newest first, max 10 each). */
  recent_signups: { partner: RecentSignup[]; jobs: RecentSignup[] };
}

const TALENT_COLUMNS =
  'id, full_name, phone, created_at, is_active, suspended, blacklisted, suspended_at, blacklisted_at, ' +
  'wants_jobs, partner_approval_status, approval_status, pipeline_stage, jobs_pipeline_stage, ' +
  'application_cancellations, crm_talent_stage_name, crm_jobs_stage_name';

/** Monday 00:00 UTC of the week containing `d`. */
function weekStart(d: Date): Date {
  const out = new Date(d);
  const day = (out.getUTCDay() + 6) % 7; // Mon = 0
  out.setUTCDate(out.getUTCDate() - day);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function emptyModule(): ModuleStats {
  return {
    total_users: 0,
    total_users_net: 0,
    blocked: 0,
    cancelled: 0,
    live: 0,
    inactive: 0,
    new_7d: 0,
    new_30d: 0,
    active_7d: 0,
    active_30d: 0,
    app_installed: 0,
    engaged_7d: 0,
    engaged_30d: 0,
    total: 0,
    pending_approval: 0,
    rejected: 0,
    by_stage: {},
  };
}

function isRejected(r: TalentRow, track: 'partner' | 'jobs'): boolean {
  return track === 'jobs'
    ? r.jobs_pipeline_stage === 'rejected'
    : r.pipeline_stage === 'rejected' || r.partner_approval_status === 'rejected';
}

function isCancelled(r: TalentRow, track: 'partner' | 'jobs'): boolean {
  return !!r.application_cancellations?.[track]?.at;
}

function stageFor(r: TalentRow, track: 'partner' | 'jobs'): string {
  return ((track === 'jobs' ? r.jobs_pipeline_stage : r.pipeline_stage) ?? 'application_approved') as string;
}

/**
 * Last platform sign-in (auth.users.last_sign_in_at) per talent user, as epoch
 * ms. Returns null when the get_auth_user_signins RPC (migration
 * 20261022000000) has not been applied yet — callers then degrade to
 * app-install activity instead of failing the dashboard.
 */
async function platformSigninsFor(
  ids: string[],
): Promise<Map<string, number> | null> {
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin.rpc('get_auth_user_signins', { id_list: ids });
  if (error) {
    if (/does not exist|Could not find the function/i.test(error.message)) return null;
    throw new AppError(500, `Failed to load sign-in activity: ${error.message}`);
  }
  const map = new Map<string, number>();
  for (const row of (data ?? []) as { id: string; last_sign_in_at: string | null }[]) {
    if (row.last_sign_in_at) {
      map.set(row.id, new Date(row.last_sign_in_at).getTime());
    }
  }
  return map;
}

/**
 * Latest talent-side activity per user from public tables — the "total active"
 * basis when exact login timestamps are unavailable (RPC not applied):
 * profile edits, course progress, opportunity views/responses. App opens are
 * merged in by the caller.
 */
async function publicActivityFor(): Promise<Map<string, number>> {
  const [profilesRes, progressRes, cardsRes] = await Promise.all([
    supabaseAdmin.from('talent_profiles').select('talent_user_id, updated_at').is('deleted_at', null),
    supabaseAdmin.from('training_lesson_progress').select('talent_user_id, completed_at'),
    supabaseAdmin.from('subscription_card_recipients').select('talent_user_id, viewed_at, responded_at'),
  ]);
  const map = new Map<string, number>();
  const stamp = (id: string | null | undefined, at: string | null | undefined) => {
    if (!id || !at) return;
    const t = new Date(at).getTime();
    map.set(id, Math.max(map.get(id) ?? 0, t));
  };
  for (const p of (profilesRes.data ?? []) as { talent_user_id: string; updated_at: string | null }[]) {
    stamp(p.talent_user_id, p.updated_at);
  }
  for (const p of (progressRes.data ?? []) as { talent_user_id: string; completed_at: string }[]) {
    stamp(p.talent_user_id, p.completed_at);
  }
  for (const c of (cardsRes.data ?? []) as { talent_user_id: string; viewed_at: string | null; responded_at: string | null }[]) {
    stamp(c.talent_user_id, c.viewed_at);
    stamp(c.talent_user_id, c.responded_at);
  }
  return map;
}

/** Merge two id→epoch maps keeping the latest timestamp per id. */
function mergeLatest(a: Map<string, number>, b: Map<string, number>): Map<string, number> {
  const out = new Map(a);
  for (const [id, t] of b) out.set(id, Math.max(out.get(id) ?? 0, t));
  return out;
}

/** Aggregates one onboarding track over its member rows (hub-consistent). */
function moduleStats(
  rows: TalentRow[],
  track: 'partner' | 'jobs',
  now: number,
  lastSeen: Map<string, number>,
  activityAt: Map<string, number>,
  finalChecks: Map<string, FinalChecksState>,
): ModuleStats {
  const out = emptyModule();
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;
  out.total_users = rows.length;
  for (const r of rows) {
    const blocked = r.suspended || r.blacklisted;
    const graduated = finalChecks.has(r.id) ? finalChecks.get(r.id) === 'completed' : normalizeStage(
      (track === 'jobs' ? r.crm_jobs_stage_name : r.crm_talent_stage_name) ?? '',
    ) === GRADUATED_TALENT_STAGE;
    const cancelled = isCancelled(r, track);
    const rejected = isRejected(r, track);

    // Overview numbers describe the net user pool (excl. blocked/cancelled);
    // funnel numbers additionally exclude rejected/graduated, like the hubs.
    if (blocked) {
      out.blocked += 1;
    } else if (cancelled) {
      out.cancelled += 1;
    } else {
      out.total_users_net += 1;
      if (r.is_active) out.live += 1;
      else out.inactive += 1;
      const created = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (created >= d7) out.new_7d += 1;
      if (created >= d30) out.new_30d += 1;

      // Active = last platform activity within the window (logins when the
      // RPC is applied, otherwise the public-activity approximation).
      const active = activityAt.get(r.id);
      if (active !== undefined) {
        if (active >= d7) out.active_7d += 1;
        if (active >= d30) out.active_30d += 1;
      }
    }

    const seen = lastSeen.get(r.id);
    if (seen !== undefined) {
      out.app_installed += 1;
      if (seen >= d7) out.engaged_7d += 1;
      if (seen >= d30) out.engaged_30d += 1;
    }
    if (rejected) out.rejected += 1;
    if (!blocked && !cancelled && !rejected && !graduated) {
      out.total += 1;
      const stage = finalChecks.get(r.id) === 'final_checks' ? 'final_checks' : stageFor(r, track);
      out.by_stage[stage] = (out.by_stage[stage] ?? 0) + 1;
      const pendingStatus = track === 'partner' ? r.partner_approval_status : r.approval_status;
      if (pendingStatus === 'pending') out.pending_approval += 1;
    }
  }
  return out;
}

export async function getDashboardActivity(): Promise<DashboardActivity> {
  const now = Date.now();
  const [partnerFinalChecks, jobsFinalChecks] = await Promise.all([
    finalChecksFor('partner', now), finalChecksFor('jobs', now),
  ]);

  const [talentRes, businessRes, partnerAppRes, talentAppRes] = await Promise.all([
    supabaseAdmin.from('talent_users').select(TALENT_COLUMNS),
    supabaseAdmin.from('business_users').select('created_at'),
    supabaseAdmin.from('partner_app_installs').select('talent_user_id, last_seen_at'),
    supabaseAdmin.from('talent_app_installs').select('user_id, last_seen_at'),
  ]);
  if (talentRes.error) throw new AppError(500, `Failed to load talent users: ${talentRes.error.message}`);
  if (businessRes.error) throw new AppError(500, `Failed to load business users: ${businessRes.error.message}`);
  // Install tables may be empty or missing rows — never fail the dashboard on them.

  const talents = (talentRes.data ?? []) as unknown as TalentRow[];
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;

  // --- Talent overview ------------------------------------------------------
  const talent = {
    total: talents.length,
    live: 0,
    inactive: 0,
    blocked: 0,
    new_7d: 0,
    new_30d: 0,
    app_installed: 0,
    engaged_7d: 0,
    engaged_30d: 0,
  };
  const talentIds = new Set(talents.map((t) => t.id));
  const lastSeen = new Map<string, number>();
  for (const row of (partnerAppRes.data ?? []) as { talent_user_id: string; last_seen_at: string }[]) {
    const t = new Date(row.last_seen_at).getTime();
    lastSeen.set(row.talent_user_id, Math.max(lastSeen.get(row.talent_user_id) ?? 0, t));
  }
  for (const row of (talentAppRes.data ?? []) as { user_id: string; last_seen_at: string }[]) {
    const t = new Date(row.last_seen_at).getTime();
    lastSeen.set(row.user_id, Math.max(lastSeen.get(row.user_id) ?? 0, t));
  }
  for (const [id, seen] of lastSeen) {
    if (!talentIds.has(id)) continue; // stale install rows for deleted users
    talent.app_installed += 1;
    if (seen >= d7) talent.engaged_7d += 1;
    if (seen >= d30) talent.engaged_30d += 1;
  }
  for (const r of talents) {
    if (r.suspended || r.blacklisted) {
      talent.blocked += 1;
      continue;
    }
    if (r.is_active) talent.live += 1;
    else talent.inactive += 1;
    const created = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (created >= d7) talent.new_7d += 1;
    if (created >= d30) talent.new_30d += 1;
  }

  // --- Onboarding modules ---------------------------------------------------
  const partnerRows = talents.filter((r) => r.partner_approval_status !== null);
  const jobsRows = talents.filter((r) => r.wants_jobs === true);

  // Platform sign-ins (null until the signin RPC migration is applied); the
  // activity basis for "active users" is exact logins when available and a
  // public-activity approximation (profile/course/card + app opens) otherwise.
  const loginAt = await platformSigninsFor(talents.map((t) => t.id));
  const activityAt = loginAt ?? mergeLatest(await publicActivityFor(), lastSeen);

  // --- Weekly signup series (last 8 full weeks + current week) --------------
  const weeks: { week_start: string; partner: number; jobs: number }[] = [];
  const weekIndex = new Map<string, number>();
  const thisWeek = weekStart(new Date(now));
  for (let i = 8; i >= 0; i -= 1) {
    const ws = new Date(thisWeek.getTime() - i * 7 * 86_400_000);
    const key = isoDate(ws);
    weekIndex.set(key, weeks.length);
    weeks.push({ week_start: key, partner: 0, jobs: 0 });
  }
  const addSignup = (rows: TalentRow[], key: 'partner' | 'jobs') => {
    for (const r of rows) {
      if (!r.created_at) continue;
      const ws = isoDate(weekStart(new Date(r.created_at)));
      const idx = weekIndex.get(ws);
      if (idx !== undefined) weeks[idx][key] += 1;
    }
  };
  addSignup(partnerRows, 'partner');
  addSignup(jobsRows, 'jobs');

  // --- Latest sign-ups per track ---------------------------------------------
  const recentFor = (rows: TalentRow[], track: 'partner' | 'jobs'): RecentSignup[] =>
    [...rows]
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
      .slice(0, 10)
      .map((r) => {
        const tracks: ('partner' | 'jobs')[] = [];
        if (r.partner_approval_status !== null) tracks.push('partner');
        if (r.wants_jobs === true) tracks.push('jobs');
        return {
          id: r.id,
          full_name: r.full_name,
          phone: r.phone,
          tracks,
          stage: stageFor(r, track),
          live: r.is_active === true,
          created_at: r.created_at,
        };
      });
  const recent_signups = {
    partner: recentFor(partnerRows, 'partner'),
    jobs: recentFor(jobsRows, 'jobs'),
  };

  // --- Business users --------------------------------------------------------
  const businessDates = ((businessRes.data ?? []) as { created_at: string | null }[])
    .map((b) => (b.created_at ? new Date(b.created_at).getTime() : 0));
  const business = {
    total: businessDates.length,
    new_7d: businessDates.filter((t) => t >= d7).length,
    new_30d: businessDates.filter((t) => t >= d30).length,
  };

  return {
    generated_at: new Date(now).toISOString(),
    users: { talent, business },
    modules: {
      partner: moduleStats(partnerRows, 'partner', now, lastSeen, activityAt, partnerFinalChecks),
      jobs: moduleStats(jobsRows, 'jobs', now, lastSeen, activityAt, jobsFinalChecks),
    },
    login_tracking_available: loginAt !== null,
    signups_weekly: weeks,
    recent_signups,
  };
}
