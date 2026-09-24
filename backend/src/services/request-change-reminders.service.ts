// Request-change reminders → final warning → auto-cancel.
//
// A talent is "under request changes" while any ask is waiting on them: a job
// profile in changes_requested, a nudged draft, a live profile with an open
// ask, or an open basic-profile ask — resubmitted ones are back with us, not
// them. The onboarding hub groups and counts these; the sweeper below chases
// them:
//
//   request sent ──20h──▶ reminder 1 ──24h──▶ reminder 2 ──24h──▶ final
//   warning ("cancelled in 24 hours") ──24h──▶ application cancelled
//
// Each step is timed from the previous message (rc_last_sent_at), so a deploy
// or restart never fires several steps at once, and restoring a cancelled
// applicant restarts the sequence from the restore. Resolving every open ask
// (resubmitting) resets it.
//
// Only talents still in onboarding are chased — once a track graduates
// ("Onboarding completed") they are live partners/job seekers, and cancelling
// their account over a profile edit would pull them off live work.

import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { normalizeStage } from './crm-stage-mapping.js';
import { talentAccountUrl } from './profile-review-changes.service.js';

export const CHANGES_REMINDER_EVENT = 'talent_changes_reminder';
export const CANCEL_WARNING_EVENT = 'talent_application_cancel_warning';
export const AUTO_CANCEL_REASON = 'Requested changes were not made within the deadline';

const HOUR_MS = 60 * 60 * 1000;
/** Wait before each step, measured from the previous message. */
export const RC_STEP_DELAYS_MS = [20 * HOUR_MS, 24 * HOUR_MS, 24 * HOUR_MS, 24 * HOUR_MS] as const;
/** rc_reminders_sent values: 0 none, 1–2 reminders, 3 final warning sent. */
const FINAL_WARNING_STEP = 2;
const CANCEL_STEP = 3;

const SWEEP_EVERY_MS = 10 * 60 * 1000;
let lastSweepAt = 0;

export interface OpenChangeRequest {
  /** changes_requested_at of the oldest open ask — the sequence anchor. */
  anchor: string;
  /** Talent-app page to fix the oldest ask (for links). */
  path: string;
  /** "Designer", "Basic", … — the oldest ask's profile. */
  category: string;
  /** Labels of what was asked on the oldest ask. */
  labels: string[];
}

function labelsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((c: any) => String(c?.message ?? c?.label ?? '')).filter(Boolean) : [];
}

/**
 * Every talent with an ask waiting on them, keyed by talent id. Pass `ids` to
 * scope the lookup (hub page / one talent); omit for the whole platform.
 */
export async function openChangeRequests(ids?: string[]): Promise<Map<string, OpenChangeRequest>> {
  const out = new Map<string, OpenChangeRequest>();
  if (ids && ids.length === 0) return out;

  let profQ = supabaseAdmin
    .from('talent_profiles')
    .select('id, talent_user_id, requested_changes, changes_requested_at, categories(name)')
    .or('status.eq.changes_requested,and(status.eq.draft,changes_requested_at.not.is.null),and(status.eq.approved,changes_requested_at.not.is.null,reviewed_at.is.null,resubmitted_at.is.null)')
    .is('deleted_at', null);
  let basicQ = supabaseAdmin
    .from('talent_profiles_basic')
    .select('talent_user_id, requested_changes, changes_requested_at')
    .not('changes_requested_at', 'is', null)
    .is('reviewed_at', null)
    .is('resubmitted_at', null);
  if (ids) {
    profQ = profQ.in('talent_user_id', ids);
    basicQ = basicQ.in('talent_user_id', ids);
  }
  const [{ data: profs, error: pErr }, { data: basics, error: bErr }] = await Promise.all([profQ, basicQ]);
  if (pErr) throw new AppError(500, pErr.message);
  if (bErr) throw new AppError(500, bErr.message);

  const consider = (talentId: string, req: OpenChangeRequest) => {
    const prev = out.get(talentId);
    if (!prev || new Date(req.anchor).getTime() < new Date(prev.anchor).getTime()) out.set(talentId, req);
  };
  for (const p of (profs ?? []) as any[]) {
    // Legacy changes_requested rows without a timestamp have nothing to time from.
    if (!p.changes_requested_at) continue;
    consider(p.talent_user_id, {
      anchor: p.changes_requested_at,
      path: `/talent/profiles/${p.id}/edit`,
      category: p.categories?.name ?? 'job',
      labels: labelsOf(p.requested_changes),
    });
  }
  for (const b of (basics ?? []) as any[]) {
    consider(b.talent_user_id, {
      anchor: b.changes_requested_at,
      path: '/talent/basic-profile',
      category: 'Basic',
      labels: labelsOf(b.requested_changes),
    });
  }
  return out;
}

export interface RcStatus {
  requested_at: string;
  reminders_sent: number;
  last_sent_at: string | null;
  /** When the next step (reminder / final warning / cancel) is due. */
  next_step_at: string | null;
  next_step: 'reminder' | 'final_warning' | 'cancel' | null;
}

/** Hub/journey view of where a talent is in the reminder sequence. */
export function rcStatusFor(
  req: OpenChangeRequest | undefined,
  t: { rc_anchor_at?: string | null; rc_reminders_sent?: number | null; rc_last_sent_at?: string | null },
): RcStatus | null {
  if (!req) return null;
  const sameCycle = !!t.rc_anchor_at && new Date(t.rc_anchor_at).getTime() === new Date(req.anchor).getTime();
  const sent = sameCycle ? t.rc_reminders_sent ?? 0 : 0;
  const last = sameCycle ? t.rc_last_sent_at ?? req.anchor : req.anchor;
  const step = Math.min(sent, CANCEL_STEP);
  return {
    requested_at: req.anchor,
    reminders_sent: sent,
    last_sent_at: sameCycle ? t.rc_last_sent_at ?? null : null,
    next_step_at: new Date(new Date(last).getTime() + RC_STEP_DELAYS_MS[step]).toISOString(),
    next_step: step < FINAL_WARNING_STEP ? 'reminder' : step === FINAL_WARNING_STEP ? 'final_warning' : 'cancel',
  };
}

const GRADUATED = 'onboarding completed';

/** Still in the onboarding queue on at least one track and graduated on none. */
function inOnboarding(t: any): boolean {
  if (t.suspended || t.blacklisted || t.application_cancelled_at) return false;
  if (normalizeStage(t.crm_talent_stage_name ?? '') === GRADUATED) return false;
  if (normalizeStage(t.crm_jobs_stage_name ?? '') === GRADUATED) return false;
  const partner = t.partner_approval_status != null && t.partner_approval_status !== 'rejected' && t.pipeline_stage !== 'rejected';
  const jobs = t.wants_jobs === true && t.jobs_pipeline_stage !== 'rejected';
  return partner || jobs;
}

function firstName(name: string | null | undefined): string {
  return name?.trim() ? name.trim().split(/\s+/)[0] : 'there';
}

function changesSummary(labels: string[]): string {
  const shown = labels.slice(0, 3);
  const rest = labels.length - shown.length;
  // Meta rejects template params containing newlines/tabs or 4+ spaces.
  const text = (shown.join('; ') + (rest > 0 ? `; and ${rest} more (see the app)` : '')).replace(/\s+/g, ' ').trim();
  return text || 'the items listed in your account';
}

async function notifyInApp(talentId: string, kind: string, title: string, body: string, route: string) {
  try {
    const { notifyTalentsInApp } = await import('./jobs.service.js');
    await notifyTalentsInApp([talentId], kind, title, body, route);
  } catch (e) {
    console.error(`[rc-reminders] in-app ${kind} failed:`, e);
  }
}

async function sendReminder(t: any, req: OpenChangeRequest, reminderNumber: number) {
  const profile = req.category === 'Basic' ? 'basic profile' : `${req.category} profile`;
  await notifyInApp(
    t.id,
    'profile_changes_reminder',
    `Reminder: your ${profile} still needs updates`,
    [...req.labels.map((l) => `• ${l}`), '', 'Make the changes and tap "Resubmit for review".'].join('\n').trim(),
    req.path,
  );
  if (!t.phone) return;
  await deliverCrmSystemEvent({
    audience: 'talent',
    event: CHANGES_REMINDER_EVENT,
    name: t.full_name ?? null,
    phone: t.phone,
    data: {
      talent_name: firstName(t.full_name),
      category: req.category,
      changes: changesSummary(req.labels),
      reminder_number: String(reminderNumber),
      account_url: talentAccountUrl(req.path),
    },
  });
}

async function sendFinalWarning(t: any, req: OpenChangeRequest) {
  const profile = req.category === 'Basic' ? 'basic profile' : `${req.category} profile`;
  await notifyInApp(
    t.id,
    'application_cancel_warning',
    'Your application will be cancelled in 24 hours',
    `We still haven't received the updates requested on your ${profile}. Make the changes and tap "Resubmit for review" within 24 hours, or your application will be cancelled.`,
    req.path,
  );
  if (!t.phone) return;
  await deliverCrmSystemEvent({
    audience: 'talent',
    event: CANCEL_WARNING_EVENT,
    name: t.full_name ?? null,
    phone: t.phone,
    data: {
      talent_name: firstName(t.full_name),
      category: req.category,
      changes: changesSummary(req.labels),
      account_url: talentAccountUrl(req.path),
    },
  });
}

async function cancelApplication(t: any) {
  await notifyInApp(
    t.id,
    'application_cancelled',
    'Your application has been cancelled',
    'The requested profile updates were not made in time, so your application has been cancelled. Please contact support if you would like to continue.',
    '/talent/contact-support',
  );
}

const TALENT_COLUMNS =
  'id, full_name, phone, suspended, blacklisted, wants_jobs, partner_approval_status, pipeline_stage, jobs_pipeline_stage, ' +
  'crm_talent_stage_name, crm_jobs_stage_name, application_cancelled_at, rc_anchor_at, rc_reminders_sent, rc_last_sent_at';

/**
 * One pass of the reminder sequence. Cheap to call every tick — self-throttles.
 * Opt-in via REQUEST_CHANGE_REMINDERS=on (prod only): local dev talks to the
 * prod database, so an unflagged local backend must never message talents.
 */
export async function sweepRequestChangeReminders(now = Date.now()): Promise<void> {
  if (process.env.REQUEST_CHANGE_REMINDERS !== 'on') return;
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;

  const open = await openChangeRequests();

  // Asks resolved (resubmitted / accepted / profile deleted) → clear the sequence.
  const { data: tracked } = await supabaseAdmin
    .from('talent_users')
    .select('id')
    .not('rc_anchor_at', 'is', null)
    .is('application_cancelled_at', null);
  const resolved = (tracked ?? []).map((r: any) => r.id as string).filter((id) => !open.has(id));
  for (let i = 0; i < resolved.length; i += 200) {
    await supabaseAdmin
      .from('talent_users')
      .update({ rc_anchor_at: null, rc_reminders_sent: 0, rc_last_sent_at: null })
      .in('id', resolved.slice(i, i + 200));
  }

  const ids = [...open.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: talents, error } = await supabaseAdmin
      .from('talent_users')
      .select(TALENT_COLUMNS)
      .in('id', ids.slice(i, i + 200));
    if (error) {
      console.error('[rc-reminders] talent query failed', error.message);
      continue;
    }
    for (const t of (talents ?? []) as any[]) {
      try {
        await stepTalent(t, open.get(t.id)!, now);
      } catch (err) {
        console.error(`[rc-reminders] talent ${t.id} failed`, err);
      }
    }
  }
}

async function stepTalent(t: any, req: OpenChangeRequest, now: number) {
  if (!inOnboarding(t)) return;

  // New ask (or first time we see this one) → start a sequence at the ask.
  const sameCycle = !!t.rc_anchor_at && new Date(t.rc_anchor_at).getTime() === new Date(req.anchor).getTime();
  if (!sameCycle) {
    const { data } = await supabaseAdmin
      .from('talent_users')
      .update({ rc_anchor_at: req.anchor, rc_reminders_sent: 0, rc_last_sent_at: req.anchor })
      .eq('id', t.id)
      .is('application_cancelled_at', null)
      .select('rc_anchor_at, rc_reminders_sent, rc_last_sent_at')
      .maybeSingle();
    if (!data) return;
    Object.assign(t, data);
  }

  const step = t.rc_reminders_sent ?? 0;
  if (step > CANCEL_STEP) return;
  const last = new Date(t.rc_last_sent_at ?? req.anchor).getTime();
  if (now - last < RC_STEP_DELAYS_MS[step]) return;

  // Claim the step first so an overlapping tick can't double-send.
  const nowIso = new Date(now).toISOString();
  const claim: Record<string, unknown> = { rc_reminders_sent: step + 1, rc_last_sent_at: nowIso };
  if (step === CANCEL_STEP) {
    claim.application_cancelled_at = nowIso;
    claim.application_cancelled_reason = AUTO_CANCEL_REASON;
  }
  const { data: claimed } = await supabaseAdmin
    .from('talent_users')
    .update(claim)
    .eq('id', t.id)
    .eq('rc_reminders_sent', step)
    .is('application_cancelled_at', null)
    .select('id');
  if (!claimed?.length) return;

  if (step < FINAL_WARNING_STEP) await sendReminder(t, req, step + 1);
  else if (step === FINAL_WARNING_STEP) await sendFinalWarning(t, req);
  else await cancelApplication(t);
}

/** Admin restores a cancelled applicant back into the onboarding hub. */
export async function restoreCancelledApplication(talentId: string) {
  const { data: t, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, application_cancelled_at')
    .eq('id', talentId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!t) throw new AppError(404, 'Talent not found');
  if (!t.application_cancelled_at) throw new AppError(400, 'This application is not cancelled');

  // Still-open asks restart their reminder sequence from now.
  const req = (await openChangeRequests([talentId])).get(talentId);
  const now = new Date().toISOString();
  const { data, error: upErr } = await supabaseAdmin
    .from('talent_users')
    .update({
      application_cancelled_at: null,
      application_cancelled_reason: null,
      rc_anchor_at: req?.anchor ?? null,
      rc_reminders_sent: 0,
      rc_last_sent_at: req ? now : null,
    })
    .eq('id', talentId)
    .select('id, application_cancelled_at')
    .single();
  if (upErr) throw new AppError(500, upErr.message);
  return data;
}
