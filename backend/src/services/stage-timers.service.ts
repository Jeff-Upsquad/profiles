// Onboarding stage timers → inactive → cancelled.
//
// Settings live in admin_settings.stage_timers (one block per module). Every
// sweep, for each open track of each applicant:
//
//   entered a timed applicant stage ──▶ "complete <next step> within N" message
//   time limit passed               ──▶ track inactive (+ messages, CRM tag)
//   inactive past the grace period  ──▶ track cancelled (Cancelled Applicants)
//
// Admin stages are never acted on — the hub only flags them as overdue.
// A talent under request changes is paused: their own reminder sequence owns
// them, and the clock restarts when they are back to the normal flow.
// Reactivating (the talent, or an admin) restarts the clock from that moment.

import { onboardingNeedsYou } from './onboarding-needs-you.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import {
  PROGRAM_NAMES,
  STAGE_LABELS,
  STAGE_TASKS,
  TIMED_STAGES,
  cancelAtFor,
  normalizeSettings,
  normalizeTrackSettings,
  ruleText,
  stageEnteredAt,
  timeLeftText,
  timedStageOf,
  timerStatus,
  stagePauseTransition,
  type NeedsYouReason,
  trackOpen,
  wholeDays,
  type StageTimerSettings,
  type StageTimerState,
  type TimedStage,
  type TimerTalent,
  type Track,
  type TrackInactivity,
  type TrackTimerSettings,
} from '../lib/stage-timers.js';
import { getAdminSetting, setAdminSetting } from './admin.service.js';
import { openChangeRequests } from './request-change-reminders.service.js';
import { talentAccountUrl } from './profile-review-changes.service.js';
import { syncCrmInactivity } from './automation.service.js';

export const SETTINGS_KEY = 'stage_timers';
export const STAGE_DEADLINE_EVENT = 'talent_stage_deadline';
export const INACTIVE_EVENT = 'talent_application_inactive';
export const INACTIVE_CANCELLED_EVENT = 'talent_application_cancelled_inactive';

const TRACKS: Track[] = ['partner', 'jobs'];
const SWEEP_EVERY_MS = 5 * 60 * 1000;
let lastSweepAt = 0;

export const TIMER_TALENT_COLUMNS =
  'id, full_name, phone, tracks_linked, wants_jobs, partner_approval_status, pipeline_stage, jobs_pipeline_stage, ' +
  'partner_stage_changed_at, jobs_stage_changed_at, application_cancellations, track_inactivity, stage_timer_state, ' +
  'crm_talent_stage_name, crm_jobs_stage_name, suspended, blacklisted';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getStageTimerSettings(): Promise<StageTimerSettings> {
  return normalizeSettings(await getAdminSetting(SETTINGS_KEY));
}

/** Save one module's settings. Switching it on (re)starts every clock from now. */
export async function saveTrackTimerSettings(track: Track, raw: unknown, adminId: string): Promise<TrackTimerSettings> {
  const all = await getStageTimerSettings();
  const next = normalizeTrackSettings(raw);
  next.activated_at = next.enabled
    ? (all[track].enabled ? all[track].activated_at : null) ?? new Date().toISOString()
    : all[track].activated_at;
  await setAdminSetting(SETTINGS_KEY, { ...all, [track]: next }, adminId);
  return next;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

function firstName(name: string | null | undefined): string {
  return name?.trim() ? name.trim().split(/\s+/)[0] : 'there';
}

async function notifyInApp(talentId: string, kind: string, title: string, body: string, route: string) {
  try {
    const { notifyTalentsInApp } = await import('./jobs.service.js');
    await notifyTalentsInApp([talentId], kind, title, body, route);
  } catch (e) {
    console.error(`[stage-timers] in-app ${kind} failed:`, e);
  }
}

async function whatsApp(t: { full_name: string | null; phone: string | null }, event: string, data: Record<string, string>) {
  if (!t.phone) return;
  try {
    await deliverCrmSystemEvent({ audience: 'talent', event, name: t.full_name ?? null, phone: t.phone, data });
  } catch (e) {
    console.error(`[stage-timers] CRM ${event} failed:`, e);
  }
}

/** "Complete <next step> within N" — sent when the applicant enters a timed stage. */
async function sendStageDeadline(t: any, track: Track, stage: TimedStage, settings: TrackTimerSettings) {
  const limit = ruleText(settings.stages[stage]);
  const task = STAGE_TASKS[stage];
  await notifyInApp(
    t.id,
    'stage_deadline',
    `Next step: ${task}`,
    `Please ${task} within ${limit}. If it isn't done in time, your ${PROGRAM_NAMES[track]} application will become inactive.`,
    '/talent/dashboard',
  );
  await whatsApp(t, STAGE_DEADLINE_EVENT, {
    talent_name: firstName(t.full_name),
    program: PROGRAM_NAMES[track],
    task,
    deadline: limit,
    account_url: talentAccountUrl('/talent/dashboard'),
  });
}

async function sendInactive(t: any, track: Track, stage: TimedStage, settings: TrackTimerSettings, silentWhatsApp: boolean) {
  const cancelIn = `${settings.stages[stage].cancel_after_days} day${settings.stages[stage].cancel_after_days === 1 ? '' : 's'}`;
  const task = STAGE_TASKS[stage];
  await notifyInApp(
    t.id,
    'application_inactive',
    `Your ${PROGRAM_NAMES[track]} application is inactive`,
    `You didn't ${task} in time. Log in and tap "Reactivate my profile" within ${cancelIn}, or your application will be cancelled.`,
    '/talent/dashboard',
  );
  if (silentWhatsApp) return;
  await whatsApp(t, INACTIVE_EVENT, {
    talent_name: firstName(t.full_name),
    program: PROGRAM_NAMES[track],
    task,
    cancel_in: cancelIn,
    account_url: talentAccountUrl('/talent/dashboard'),
  });
}

async function sendInactiveCancelled(t: any, track: Track) {
  await notifyInApp(
    t.id,
    'application_cancelled',
    'Your application has been cancelled',
    `Your ${PROGRAM_NAMES[track]} application stayed inactive past the deadline, so it has been cancelled. Please contact support if you would like to continue.`,
    '/talent/contact-support',
  );
  await whatsApp(t, INACTIVE_CANCELLED_EVENT, {
    talent_name: firstName(t.full_name),
    program: PROGRAM_NAMES[track],
    account_url: talentAccountUrl('/talent/contact-support'),
  });
}

// ---------------------------------------------------------------------------
// State changes
// ---------------------------------------------------------------------------

/**
 * Compare-and-set on the talent's timer columns, so two overlapping sweeps (or
 * a sweep and an admin click) never both act on the same transition.
 */
async function casUpdate(t: any, patch: Record<string, unknown>): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('talent_users')
    .update(patch)
    .eq('id', t.id)
    .eq('track_inactivity', JSON.stringify(t.track_inactivity ?? {}))
    .eq('stage_timer_state', JSON.stringify(t.stage_timer_state ?? {}))
    .select('id');
  if (!data?.length) return false;
  Object.assign(t, patch);
  return true;
}

async function loadTalent(talentId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select(TIMER_TALENT_COLUMNS)
    .eq('id', talentId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Talent not found');
  return data;
}

/** Make one track inactive and tell the applicant (in-app, WhatsApp) and the CRM (tag). */
export async function markTrackInactive(
  talentId: string,
  track: Track,
  by: 'system' | 'admin',
  opts: { talent?: any; settings?: StageTimerSettings; silentWhatsApp?: boolean } = {},
): Promise<TrackInactivity> {
  const t = opts.talent ?? await loadTalent(talentId);
  const settings = opts.settings ?? await getStageTimerSettings();
  if (!trackOpen(t, track)) throw new AppError(400, `This ${PROGRAM_NAMES[track]} application is not in onboarding`);
  const stage = timedStageOf(t, track);
  if (!stage) throw new AppError(400, 'Only applicants still in onboarding can be marked inactive');
  if (t.track_inactivity?.[track]) throw new AppError(409, 'Already inactive');

  const inactivity: TrackInactivity = { at: new Date().toISOString(), stage, by };
  const ok = await casUpdate(t, { track_inactivity: { ...(t.track_inactivity ?? {}), [track]: inactivity } });
  if (!ok) throw new AppError(409, 'This applicant changed while updating. Please retry.');

  await sendInactive(t, track, stage, settings[track], !!opts.silentWhatsApp);
  await syncCrmInactivity(t.id, track, inactivity, by === 'admin' ? 'admin' : 'system')
    .catch((e) => console.error(`[stage-timers] CRM tag failed for ${t.id}`, e));
  return inactivity;
}

export interface ReactivatedTrack {
  track: Track;
  program: string;
  stage: TimedStage | null;
  task: string | null;
  /** "2 days" — how long they have for the current stage, from now. */
  deadline: string | null;
}

/** Clear inactivity on the given tracks (default: every inactive one) and restart their clocks. */
export async function reactivateTracks(
  talentId: string,
  by: 'talent' | 'admin',
  only?: Track,
): Promise<ReactivatedTrack[]> {
  const t = await loadTalent(talentId);
  const settings = await getStageTimerSettings();
  const inactive = (t.track_inactivity ?? {}) as Partial<Record<Track, TrackInactivity>>;
  const tracks = TRACKS.filter((tr) => inactive[tr] && (!only || only === tr));
  if (!tracks.length) throw new AppError(400, 'This application is not inactive');

  const now = new Date().toISOString();
  const nextInactivity = { ...inactive };
  const state: StageTimerState = { ...(t.stage_timer_state ?? {}), reset: { ...(t.stage_timer_state?.reset ?? {}) } };
  for (const tr of tracks) {
    delete nextInactivity[tr];
    state.reset![tr] = now;
  }
  const ok = await casUpdate(t, { track_inactivity: nextInactivity, stage_timer_state: state });
  if (!ok) throw new AppError(409, 'Your profile changed while reactivating. Please retry.');

  for (const tr of tracks) {
    await syncCrmInactivity(t.id, tr, null, by).catch((e) => console.error(`[stage-timers] CRM untag failed for ${t.id}`, e));
  }
  return tracks.map((tr) => {
    const stage = timedStageOf(t, tr);
    const r = stage ? settings[tr].stages[stage] : null;
    const timed = !!(stage && r?.enabled && r.actor === 'applicant' && settings[tr].enabled);
    return {
      track: tr,
      program: PROGRAM_NAMES[tr],
      stage,
      task: stage ? STAGE_TASKS[stage] : null,
      deadline: timed ? ruleText(r!) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Read models (talent lockout, hub)
// ---------------------------------------------------------------------------

export interface InactivitySummary {
  track: Track;
  program: string;
  stage: string;
  stage_label: string;
  task: string | null;
  /** "2 days" — time they get for the stage once reactivated (null: stage not timed). */
  deadline: string | null;
  inactive_at: string;
  days_inactive: number;
  cancel_at: string;
  cancels_in: string;
}

export function inactivitySummary(t: TimerTalent, settings: StageTimerSettings, now = Date.now()): InactivitySummary[] {
  const out: InactivitySummary[] = [];
  for (const tr of TRACKS) {
    const inactivity = t.track_inactivity?.[tr];
    if (!inactivity || !trackOpen(t, tr)) continue;
    const stage = (TIMED_STAGES as readonly string[]).includes(inactivity.stage) ? inactivity.stage as TimedStage : null;
    const cancelAt = cancelAtFor(inactivity, settings[tr]);
    const r = stage ? settings[tr].stages[stage] : null;
    out.push({
      track: tr,
      program: PROGRAM_NAMES[tr],
      stage: inactivity.stage,
      stage_label: stage ? STAGE_LABELS[stage] : inactivity.stage,
      task: stage ? STAGE_TASKS[stage] : null,
      deadline: r && r.enabled && r.actor === 'applicant' && settings[tr].enabled ? ruleText(r) : null,
      inactive_at: inactivity.at,
      days_inactive: wholeDays(now - Date.parse(inactivity.at)),
      cancel_at: cancelAt,
      cancels_in: timeLeftText(cancelAt, now),
    });
  }
  return out;
}

export interface HubTimer {
  actor: 'applicant' | 'admin';
  due_at: string;
  overdue: boolean;
  limit_text: string;
}

export interface HubInactivity {
  at: string;
  by: 'system' | 'admin';
  cancel_at: string;
}

/** Per-row timer data for the onboarding hub. */
export function hubTimerFor(
  t: TimerTalent,
  track: Track,
  settings: StageTimerSettings,
  underRequestChanges: boolean,
  now = Date.now(),
): { timer: HubTimer | null; inactive: HubInactivity | null } {
  const inactivity = t.track_inactivity?.[track];
  if (t.stage_timer_state?.needs_you?.length) return { timer: null, inactive: null };
  if (inactivity && trackOpen(t, track)) {
    return { timer: null, inactive: { at: inactivity.at, by: inactivity.by, cancel_at: cancelAtFor(inactivity, settings[track]) } };
  }
  if (underRequestChanges || t.stage_timer_state?.rc_paused) return { timer: null, inactive: null };
  const s = timerStatus(t, track, settings[track], now);
  return { timer: s ? { actor: s.actor, due_at: s.due_at, overdue: s.overdue, limit_text: s.limit_text } : null, inactive: null };
}

// ---------------------------------------------------------------------------
// Sweeper
// ---------------------------------------------------------------------------

/**
 * One pass over every applicant. Cheap to call every tick — self-throttles.
 * Opt-in via STAGE_TIMERS=on (prod only): local dev talks to the prod
 * database, so an unflagged local backend must never message talents.
 */
export async function sweepStageTimers(now = Date.now()): Promise<void> {
  if (process.env.STAGE_TIMERS !== 'on') return;
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;

  const settings = await getStageTimerSettings();
  const anyInactive = await supabaseAdmin.from('talent_users').select('id', { head: true, count: 'exact' })
    .neq('track_inactivity', '{}');
  if (!settings.partner.enabled && !settings.jobs.enabled && !anyInactive.count) return;

  const open = await openChangeRequests();
  const PAGE = 500;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select(TIMER_TALENT_COLUMNS)
      .is('application_cancelled_at', null)
      .or('wants_jobs.eq.true,partner_approval_status.not.is.null')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('[stage-timers] talent query failed', error.message);
      return;
    }
    // A failed attention lookup aborts this page: never time out someone whose pause is unknown.
    const needsYou = await onboardingNeedsYou((data ?? []) as any[]);
    for (const t of (data ?? []) as any[]) {
      try {
        await stepTalent(t, settings, open.has(t.id), now, needsYou.get(t.id) ?? []);
      } catch (err) {
        console.error(`[stage-timers] talent ${t.id} failed`, err);
      }
    }
    if (!data || data.length < PAGE) break;
  }
}

async function stepTalent(t: any, settings: StageTimerSettings, underRc: boolean, now: number, needsYou: NeedsYouReason[]) {
  const transition = stagePauseTransition(t.stage_timer_state ?? {}, needsYou, underRc, now);
  if (transition.changed) {
    const inactive = { ...(t.track_inactivity ?? {}) };
    const cleared = transition.needsYouCleared ? TRACKS.filter(tr => inactive[tr]) : [];
    for (const tr of cleared) delete inactive[tr];
    const ok = await casUpdate(t, { stage_timer_state: transition.state,
      ...(cleared.length ? { track_inactivity: inactive } : {}) });
    if (!ok) return;
    for (const tr of cleared) await syncCrmInactivity(t.id, tr, null).catch(() => {});
  }
  if (transition.paused) return;

  for (const track of TRACKS) {
    const inactivity = t.track_inactivity?.[track] as TrackInactivity | undefined;
    if (inactivity) {
      await stepInactive(t, track, inactivity, settings, now);
      continue;
    }
    if (!trackOpen(t, track)) continue;
    const status = timerStatus(t, track, settings[track], now);
    if (!status || status.actor !== 'applicant') continue;

    // A linked talent's Jobs card is silent (as on the CRM): the Partner
    // Program message already told them, unless Partner isn't timed here.
    const silent = track === 'jobs' && !!t.tracks_linked && trackOpen(t, 'partner')
      && timerStatus(t, 'partner', settings.partner, now)?.stage === status.stage;

    await maybeSendDeadline(t, track, status.stage, settings[track], silent);
    if (status.overdue) {
      await markTrackInactive(t.id, track, 'system', {
        talent: t,
        settings,
        silentWhatsApp: silent && !!t.track_inactivity?.partner,
      }).catch((e) => {
        if (!(e instanceof AppError && e.statusCode === 409)) throw e;
      });
    }
  }
}

/** Send the stage's "complete it within N" message once per stage entry. */
async function maybeSendDeadline(t: any, track: Track, stage: TimedStage, settings: TrackTimerSettings, silent: boolean) {
  const entered = stageEnteredAt(t, track);
  const state: StageTimerState = t.stage_timer_state ?? {};
  const prev = state.notice?.[track];
  if (prev && prev.stage === stage && prev.at === entered) return;
  const claimed = await casUpdate(t, {
    stage_timer_state: { ...state, notice: { ...(state.notice ?? {}), [track]: { stage, at: entered } } },
  });
  if (!claimed) return;
  // Applicants already sitting in a stage when the module was switched on keep
  // their current state quietly — only new stage entries get the message.
  const fresh = !!entered && !!settings.activated_at && Date.parse(entered) >= Date.parse(settings.activated_at);
  if (fresh && !silent) await sendStageDeadline(t, track, stage, settings);
}

async function stepInactive(t: any, track: Track, inactivity: TrackInactivity, settings: StageTimerSettings, now: number) {
  // Moved on (completed the step, or an admin moved them) → active again.
  const current = trackOpen(t, track) ? timedStageOf(t, track) : null;
  if (!trackOpen(t, track) || current !== inactivity.stage) {
    const next = { ...(t.track_inactivity ?? {}) };
    delete next[track];
    if (await casUpdate(t, { track_inactivity: next })) {
      await syncCrmInactivity(t.id, track, null).catch(() => {});
    }
    return;
  }
  if (now < Date.parse(cancelAtFor(inactivity, settings[track]))) return;

  const { cancelApplicantTracks } = await import('./applicant-cancellation.service.js');
  await cancelApplicantTracks(t.id, track, 'inactive');
  await syncCrmInactivity(t.id, track, null).catch(() => {});
  await sendInactiveCancelled(t, track);
}
