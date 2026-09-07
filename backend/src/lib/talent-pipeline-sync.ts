import { supabaseAdmin } from '../config/supabase.js';
import { phoneMatchSuffix } from './phone.js';
import { leadStatusToPipelineStage } from './pipelineStageMapping.js';

/**
 * Resolve a talent_users row by last-10 phone digits. Same matching rule as
 * lookupTalentByPhone / link_leads_for_talent_user, so a mangled stored
 * number like +91916380873768 still hits +916380873768.
 */
export async function findTalentUserIdByPhone(
  phone: string | null | undefined,
): Promise<string | null> {
  const last10 = phoneMatchSuffix(phone);
  if (!last10 || last10.length !== 10) return null;

  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, phone, updated_at')
    .ilike('phone', `%${last10}`)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[talent-pipeline-sync] phone lookup failed:', error.message);
    return null;
  }

  const match = (data ?? []).find((u: { phone?: string | null }) => {
    const digits = String(u.phone ?? '').replace(/\D/g, '');
    return digits.slice(-10) === last10;
  }) as { id: string } | undefined;
  return match?.id ?? null;
}

/** Copy a mapped CRM/lead status onto talent_users.pipeline_stage. */
export async function applyLeadStatusToTalentUser(
  talentUserId: string,
  leadStatus: string,
): Promise<string | null> {
  const pipelineStage = leadStatusToPipelineStage(leadStatus);
  if (!pipelineStage) return null;

  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({ pipeline_stage: pipelineStage })
    .eq('id', talentUserId);
  if (error) {
    console.error('[talent-pipeline-sync] update failed:', error.message);
    return null;
  }
  return pipelineStage;
}
