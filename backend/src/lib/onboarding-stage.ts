/** Approval gates Partner Program placement; linked course progress is retained. */
export function onboardingStage(
  talent: { partner_approval_status?: string | null; pipeline_stage?: string | null; jobs_pipeline_stage?: string | null },
  track: 'partner' | 'jobs' = 'partner',
  finalChecks?: string,
): string {
  if (track === 'partner') {
    if (talent.partner_approval_status === 'rejected') return 'rejected';
    if (talent.partner_approval_status === 'pending') return 'applicants';
  }
  if (finalChecks === 'final_checks') return 'final_checks';
  return (track === 'jobs' ? talent.jobs_pipeline_stage : talent.pipeline_stage) ?? 'application_approved';
}
