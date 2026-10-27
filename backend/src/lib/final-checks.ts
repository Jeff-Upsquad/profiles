/** Final checks are an onboarding view of Live, never a loss of Live eligibility. */
export const FINAL_CHECKS_DELAY_MS = 24 * 60 * 60 * 1000;
export type FinalChecksTrack = 'partner' | 'jobs';
export type FinalChecksState = 'live' | 'final_checks' | 'completed';

export interface FinalChecksTalent {
  pipeline_stage?: string | null;
  jobs_pipeline_stage?: string | null;
  partner_stage_changed_at?: string | null;
  jobs_stage_changed_at?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  onboarding_webinar_attended_at?: string | null;
}

export function finalChecksState(
  talent: FinalChecksTalent,
  track: FinalChecksTrack,
  appSignedIn: boolean,
  now = Date.now(),
): FinalChecksState | null {
  const stage = track === 'jobs' ? talent.jobs_pipeline_stage : talent.pipeline_stage;
  if (stage !== 'live') return null;
  const entered = (track === 'jobs' ? talent.jobs_stage_changed_at : talent.partner_stage_changed_at)
    // Legacy Live rows predate the stage timestamp trigger.
    ?? talent.approved_at ?? talent.created_at;
  const enteredAt = entered ? Date.parse(entered) : NaN;
  if (!Number.isFinite(enteredAt) || now - enteredAt < FINAL_CHECKS_DELAY_MS) return 'live';
  return appSignedIn && !!talent.onboarding_webinar_attended_at ? 'completed' : 'final_checks';
}
