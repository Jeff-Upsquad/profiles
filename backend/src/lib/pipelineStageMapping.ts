// Maps lead_submissions.status → talent_users.pipeline_stage
// Used to auto-sync the Sign-ups pipeline when a lead's status changes.

const LEAD_STATUS_TO_PIPELINE_STAGE: Record<string, string> = {
  signed_up: 'signed_up',
  onboarding_training: 'onboarding_course',
  basic_profile: 'basic_profile',
  job_profile: 'job_profile',
  final_review: 'final_review',
  live: 'live',
  no_response: 'no_response',
};

const VALID_PIPELINE_STAGES = new Set([
  'signed_up',
  'onboarding_course',
  'basic_profile',
  'job_profile',
  'final_review',
  'live',
  'no_response',
]);

/**
 * Maps a lead status to the corresponding talent pipeline stage.
 * Returns null if the lead status doesn't map to a pipeline stage.
 */
export function leadStatusToPipelineStage(leadStatus: string): string | null {
  const stage = LEAD_STATUS_TO_PIPELINE_STAGE[leadStatus];
  if (stage && VALID_PIPELINE_STAGES.has(stage)) return stage;
  return null;
}
