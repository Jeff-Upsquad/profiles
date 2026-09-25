/** Pure rules for a talent on both Jobs and Partner Program (see linked-tracks.service). */

export type Track = 'partner' | 'jobs';

export const CATCH_UP_GAP_MS = 60 * 60_000;

export interface TrackState {
  id: string;
  full_name: string | null;
  phone: string | null;
  tracks_linked: boolean | null;
  wants_jobs: boolean | null;
  partner_approval_status: string | null;
  pipeline_stage: string | null;
  jobs_pipeline_stage: string | null;
  partner_stage_changed_at: string | null;
  jobs_stage_changed_at: string | null;
}

/** Both tracks requested and neither rejected. */
export function bothOpen(t: Partial<TrackState> | null | undefined): boolean {
  return !!t && t.wants_jobs === true && t.jobs_pipeline_stage !== 'rejected' &&
    t.partner_approval_status != null && t.partner_approval_status !== 'rejected' &&
    t.pipeline_stage !== 'rejected';
}

/** Applied together — the two pipelines move in lockstep. */
export function isLinked(t: Partial<TrackState> | null | undefined): boolean {
  return !!t?.tracks_linked && bothOpen(t);
}

/** Second track added later — each pipeline moves on its own, catching up stepwise. */
export function isCatchUp(t: Partial<TrackState> | null | undefined): boolean {
  return !t?.tracks_linked && bothOpen(t);
}

/** A linked talent's Jobs card moves silently — the Partner Program card messages. */
export function jobsSilent(t: Partial<TrackState> | null | undefined): boolean {
  return isLinked(t);
}

/** Last move on this track was too recent for the next catch-up step. */
export function catchUpPaced(changedAt: string | null | undefined): boolean {
  if (!changedAt) return false;
  return Date.now() - Date.parse(changedAt) < CATCH_UP_GAP_MS;
}

/** Jobs candidate stages in order (talent_users.jobs_pipeline_stage). */
export const JOBS_STAGE_ORDER = [
  'applicants', 'application_approved', 'onboarding_course', 'basic_profile',
  'job_profile', 'final_review', 'live',
];

/** The next stage from `current` toward `target` in `order`, or null if not behind. */
export function nextStageToward(order: string[], current: string | null, target: string): string | null {
  const ci = order.indexOf(current ?? '');
  const ti = order.indexOf(target);
  if (ci === -1 || ti === -1 || ti <= ci) return null;
  return order[ci + 1];
}

/** A CRM mapping key that belongs to the Jobs program. */
export function isJobsKey(key: string): boolean {
  return key === 'jobs' || key.startsWith('jobs_');
}

