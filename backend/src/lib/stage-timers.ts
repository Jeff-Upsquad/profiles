/**
 * Onboarding stage timers — pure rules (see services/stage-timers.service.ts).
 *
 * Each module (Partner Program / Jobs) gives every candidate stage a time limit
 * and says whose move it is. An applicant stage that runs out makes that track
 * inactive; an inactive track is cancelled after the stage's grace period. An
 * admin stage that runs out is only flagged as overdue in the hub.
 *
 * The clock starts at the latest of: entering the stage, the module being
 * switched on (so existing applicants are never timed out retroactively), and
 * the last reset (reactivation, or coming back from request changes).
 */

export type Track = 'partner' | 'jobs';

export const TIMED_STAGES = [
  'applicants', 'application_approved', 'onboarding_course', 'basic_profile', 'job_profile', 'final_review',
] as const;
export type TimedStage = (typeof TIMED_STAGES)[number];

export type TimerActor = 'applicant' | 'admin';
export type TimerUnit = 'hours' | 'days';

export interface StageTimerRule {
  enabled: boolean;
  amount: number;
  unit: TimerUnit;
  actor: TimerActor;
  /** Days an inactive applicant has to reactivate before the track is cancelled. */
  cancel_after_days: number;
}

export interface TrackTimerSettings {
  enabled: boolean;
  /** When the module was last switched on — clocks never start before it. */
  activated_at: string | null;
  stages: Record<TimedStage, StageTimerRule>;
}

export type StageTimerSettings = Record<Track, TrackTimerSettings>;

export interface TrackInactivity {
  at: string;
  stage: string;
  by: 'system' | 'admin';
}

export interface StageTimerState {
  reset?: Partial<Record<Track, string>>;
  notice?: Partial<Record<Track, { stage: string; at: string | null }>>;
  rc_paused?: boolean;
}

export const PROGRAM_NAMES: Record<Track, string> = {
  partner: 'UpSquad Partner Program',
  jobs: 'Jobs',
};

/** Admin-facing stage names. */
export const STAGE_LABELS: Record<TimedStage, string> = {
  applicants: 'Signed Up / Applicants',
  application_approved: 'Application Approved',
  onboarding_course: 'Onboarding Course',
  basic_profile: 'Basic Profile',
  job_profile: 'Job Profile',
  final_review: 'Final Review',
};

/**
 * What has to happen to leave each stage — a stage is the last step done, so
 * the task is the next one. Worded to follow "Please …".
 */
export const STAGE_TASKS: Record<TimedStage, string> = {
  applicants: 'wait for your application to be reviewed',
  application_approved: 'complete the onboarding course',
  onboarding_course: 'complete your basic profile',
  basic_profile: 'complete your job profile',
  job_profile: 'finish your portfolio and submit your profile for review',
  final_review: 'wait for your profile to be reviewed',
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function rule(amount: number, unit: TimerUnit, actor: TimerActor): StageTimerRule {
  return { enabled: true, amount, unit, actor, cancel_after_days: 3 };
}

export function defaultTrackSettings(): TrackTimerSettings {
  return {
    enabled: false,
    activated_at: null,
    stages: {
      applicants: rule(24, 'hours', 'admin'),
      application_approved: rule(24, 'hours', 'applicant'),
      onboarding_course: rule(2, 'days', 'applicant'),
      basic_profile: rule(2, 'days', 'applicant'),
      job_profile: rule(3, 'days', 'applicant'),
      final_review: rule(2, 'days', 'admin'),
    },
  };
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalizeRule(raw: any, fallback: StageTimerRule): StageTimerRule {
  const unit: TimerUnit = raw?.unit === 'hours' || raw?.unit === 'days' ? raw.unit : fallback.unit;
  return {
    enabled: typeof raw?.enabled === 'boolean' ? raw.enabled : fallback.enabled,
    unit,
    amount: clampInt(raw?.amount, 1, unit === 'hours' ? 720 : 90, fallback.amount),
    actor: raw?.actor === 'applicant' || raw?.actor === 'admin' ? raw.actor : fallback.actor,
    cancel_after_days: clampInt(raw?.cancel_after_days, 1, 90, fallback.cancel_after_days),
  };
}

export function normalizeTrackSettings(raw: any): TrackTimerSettings {
  const base = defaultTrackSettings();
  const stages = {} as Record<TimedStage, StageTimerRule>;
  for (const s of TIMED_STAGES) stages[s] = normalizeRule(raw?.stages?.[s], base.stages[s]);
  return {
    enabled: raw?.enabled === true,
    activated_at: typeof raw?.activated_at === 'string' ? raw.activated_at : null,
    stages,
  };
}

export function normalizeSettings(raw: any): StageTimerSettings {
  return { partner: normalizeTrackSettings(raw?.partner), jobs: normalizeTrackSettings(raw?.jobs) };
}

export function ruleMs(r: StageTimerRule): number {
  return r.amount * (r.unit === 'hours' ? HOUR_MS : DAY_MS);
}

export function durationText(amount: number, unit: TimerUnit): string {
  const word = unit === 'hours' ? 'hour' : 'day';
  return `${amount} ${word}${amount === 1 ? '' : 's'}`;
}

export function ruleText(r: StageTimerRule): string {
  return durationText(r.amount, r.unit);
}

/** The subset of talent_users a timer needs. */
export interface TimerTalent {
  id: string;
  wants_jobs: boolean | null;
  partner_approval_status: string | null;
  pipeline_stage: string | null;
  jobs_pipeline_stage: string | null;
  partner_stage_changed_at: string | null;
  jobs_stage_changed_at: string | null;
  application_cancellations?: Record<string, unknown> | null;
  track_inactivity?: Partial<Record<Track, TrackInactivity>> | null;
  stage_timer_state?: StageTimerState | null;
  crm_talent_stage_name?: string | null;
  crm_jobs_stage_name?: string | null;
  suspended?: boolean | null;
  blacklisted?: boolean | null;
}

const GRADUATED = 'onboarding completed';

/** The track is requested, not rejected, not cancelled and not graduated. */
export function trackOpen(t: TimerTalent, track: Track): boolean {
  if (t.suspended || t.blacklisted || t.application_cancellations?.[track]) return false;
  const crmStage = (track === 'jobs' ? t.crm_jobs_stage_name : t.crm_talent_stage_name) ?? '';
  if (crmStage.trim().toLowerCase() === GRADUATED) return false;
  if (track === 'jobs') return t.wants_jobs === true && t.jobs_pipeline_stage !== 'rejected';
  return t.partner_approval_status != null && t.partner_approval_status !== 'rejected' && t.pipeline_stage !== 'rejected';
}

/**
 * The stage a track is timed on. A Partner application still awaiting approval
 * is waiting on the admin whatever stage its linked Jobs track has moved it to.
 */
export function timedStageOf(t: TimerTalent, track: Track): TimedStage | null {
  if (track === 'partner' && t.partner_approval_status === 'pending') return 'applicants';
  const raw = (track === 'jobs' ? t.jobs_pipeline_stage : t.pipeline_stage) ?? 'application_approved';
  const stage = raw === 'signed_up' ? 'application_approved' : raw;
  return (TIMED_STAGES as readonly string[]).includes(stage) ? stage as TimedStage : null;
}

export function stageEnteredAt(t: TimerTalent, track: Track): string | null {
  return (track === 'jobs' ? t.jobs_stage_changed_at : t.partner_stage_changed_at) ?? null;
}

function latest(...isos: Array<string | null | undefined>): number {
  return Math.max(0, ...isos.filter(Boolean).map((s) => Date.parse(s as string)).filter(Number.isFinite));
}

export interface TimerStatus {
  stage: TimedStage;
  actor: TimerActor;
  started_at: string;
  due_at: string;
  overdue: boolean;
  /** "2 days" — the stage's limit as configured. */
  limit_text: string;
}

/** Where a track stands on its stage timer, or null when it isn't timed. */
export function timerStatus(
  t: TimerTalent,
  track: Track,
  settings: TrackTimerSettings,
  now = Date.now(),
): TimerStatus | null {
  if (!settings.enabled || !trackOpen(t, track)) return null;
  const stage = timedStageOf(t, track);
  if (!stage) return null;
  const r = settings.stages[stage];
  if (!r?.enabled) return null;
  const start = latest(stageEnteredAt(t, track), settings.activated_at, t.stage_timer_state?.reset?.[track]);
  if (!start) return null;
  const due = start + ruleMs(r);
  return {
    stage,
    actor: r.actor,
    started_at: new Date(start).toISOString(),
    due_at: new Date(due).toISOString(),
    overdue: now >= due,
    limit_text: ruleText(r),
  };
}

/** When an inactive track gets cancelled (by the rule of the stage it went inactive on). */
export function cancelAtFor(inactivity: TrackInactivity, settings: TrackTimerSettings): string {
  const stage = (TIMED_STAGES as readonly string[]).includes(inactivity.stage) ? inactivity.stage as TimedStage : null;
  const days = stage ? settings.stages[stage].cancel_after_days : 3;
  return new Date(Date.parse(inactivity.at) + days * DAY_MS).toISOString();
}

export function wholeDays(ms: number): number {
  return Math.max(0, Math.floor(ms / DAY_MS));
}

/** "2 days" / "5 hours" left until `iso` (never below "1 hour"). */
export function timeLeftText(iso: string, now = Date.now()): string {
  const ms = Math.max(0, Date.parse(iso) - now);
  if (ms >= DAY_MS) return durationText(Math.ceil(ms / DAY_MS), 'days');
  return durationText(Math.max(1, Math.ceil(ms / HOUR_MS)), 'hours');
}
