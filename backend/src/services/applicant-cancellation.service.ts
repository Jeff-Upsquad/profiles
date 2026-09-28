import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { CancellationScope, CancellationReason, ApplicationCancellations } from '../lib/applicant-cancellation.js';

export async function cancelApplicantTracks(talentId: string, scope: CancellationScope, reason: CancellationReason) {
  const tracks = scope === 'both' ? ['partner', 'jobs'] : [scope];
  const { data, error } = await supabaseAdmin.rpc('cancel_applicant_tracks', {
    p_talent_id: talentId, p_tracks: tracks, p_reason: reason,
  });
  if (error) throw new AppError(409, error.message);
  const cancellations = data as ApplicationCancellations;
  const selected = tracks.filter(t => cancellations[t as 'partner' | 'jobs']);
  if (!selected.length) throw new AppError(409, 'No matching application was found. The team can help.');
  if (reason === 'not_interested') {
    const { error: reminderError } = await supabaseAdmin.from('talent_users')
      .update({ rc_anchor_at: null, rc_reminders_sent: 0, rc_last_sent_at: null })
      .eq('id', talentId);
    if (reminderError) throw new AppError(500, `Could not stop onboarding reminders: ${reminderError.message}`);
  }
  const { syncCrmHold } = await import('./automation.service.js');
  await syncCrmHold(talentId, reason === 'not_interested' ? 'squad_bot' : 'system');
  return selected;
}
