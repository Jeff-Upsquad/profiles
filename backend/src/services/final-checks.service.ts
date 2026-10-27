import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { finalChecksState, type FinalChecksState, type FinalChecksTrack } from '../lib/final-checks.js';

/**
 * Project the post-Live onboarding stage from its own track clock and the two
 * authoritative checks. No CRM/card move is sent: Live must remain Live in the
 * onboarded modules, and program-course progress does not gate final checks.
 * Recomputed on reads so app sync / attendance edits take effect automatically.
 */
export async function finalChecksFor(track: FinalChecksTrack, now = Date.now()) {
  const stageColumn = track === 'jobs' ? 'jobs_pipeline_stage' : 'pipeline_stage';
  const states = new Map<string, FinalChecksState>();
  for (let offset = 0; ; offset += 500) {
    const { data: rows, error } = await supabaseAdmin.from('talent_users')
      .select('id, pipeline_stage, jobs_pipeline_stage, partner_stage_changed_at, jobs_stage_changed_at, approved_at, created_at, onboarding_webinar_attended_at')
      .eq(stageColumn, 'live').order('id').range(offset, offset + 499);
    if (error) throw new AppError(500, `Failed to load final checks: ${error.message}`);
    if (!rows?.length) break;
    const { data: installs, error: installError } = await supabaseAdmin.from('partner_app_installs')
      .select('talent_user_id, first_seen_at').in('talent_user_id', rows.map(r => r.id));
    if (installError) throw new AppError(500, `Failed to load app sign-ins: ${installError.message}`);
    const signedIn = new Set((installs ?? []).filter(r => !!r.first_seen_at).map(r => r.talent_user_id));
    for (const row of rows) states.set(row.id, finalChecksState(row, track, signedIn.has(row.id), now)!);
    if (rows.length < 500) break;
  }
  return states;
}
