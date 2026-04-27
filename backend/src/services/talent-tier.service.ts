import { supabaseAdmin } from '../config/supabase.js';

export type TierType = 'junior' | 'pro' | 'elite' | 'custom';

export interface TalentTier {
  tier: TierType | null;
  tier_custom: string | null;
}

/**
 * Resolve the latest tier for each talent_user via their linked lead_submissions.
 * Returns a map keyed by talent_user_id. Talents with no linked leads are absent
 * from the map (caller can default to no badge).
 */
export async function getTalentTiersByUserIds(
  userIds: string[]
): Promise<Record<string, TalentTier>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('linked_talent_user_id, profile_type, profile_type_custom, created_at')
    .in('linked_talent_user_id', userIds)
    .not('profile_type', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !data) return {};

  const result: Record<string, TalentTier> = {};
  for (const row of data) {
    const id = row.linked_talent_user_id as string | null;
    if (!id) continue;
    // First-seen wins, query is ordered DESC so this is the latest tier.
    if (!result[id]) {
      result[id] = {
        tier: (row.profile_type as TierType) ?? null,
        tier_custom: (row.profile_type_custom as string | null) ?? null,
      };
    }
  }
  return result;
}
