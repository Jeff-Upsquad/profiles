import { supabaseAdmin } from '../config/supabase.js';

// The 'Elite'/'elite' tier has been renamed to 'Top Talents'. Data is
// backfilled and the CHECK constraints no longer accept the legacy value.
export type TierType = 'junior' | 'pro' | 'Top Talents' | 'custom';

// Predicate for the Top Talents bracket. Kept as a helper so callers don't
// hardcode the literal when displaying or filtering by tier.
export function isTopTalentsTier(t: string | null | undefined): boolean {
  return t === 'Top Talents';
}

export interface TalentTier {
  tier: TierType | null;
  tier_custom: string | null;
}

/**
 * Resolve the latest tier for each talent_user.
 *
 * Priority:
 *   1. Per-profile tier on talent_profiles (set from the Talents admin UI).
 *      Interim behavior writes the same tier to all of a user's profiles,
 *      so any non-null row gives the answer.
 *   2. Latest matching lead_submissions.profile_type (the original source).
 *
 * Returns a map keyed by talent_user_id. Talents with no resolvable tier
 * are absent from the map (caller can default to no badge).
 */
export async function getTalentTiersByUserIds(
  userIds: string[]
): Promise<Record<string, TalentTier>> {
  if (userIds.length === 0) return {};

  const result: Record<string, TalentTier> = {};

  // 1. Profile-level tier (preferred)
  const { data: profileTiers } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id, tier, tier_custom')
    .in('talent_user_id', userIds)
    .not('tier', 'is', null)
    .is('deleted_at', null);

  for (const row of profileTiers ?? []) {
    const id = row.talent_user_id as string | null;
    if (!id) continue;
    if (!result[id]) {
      result[id] = {
        tier: (row.tier as TierType) ?? null,
        tier_custom: (row.tier_custom as string | null) ?? null,
      };
    }
  }

  // 2. Lead-level fallback for users without a profile-level tier
  const remaining = userIds.filter((id) => !result[id]);
  if (remaining.length === 0) return result;

  const { data: leadTiers, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('linked_talent_user_id, profile_type, profile_type_custom, created_at')
    .in('linked_talent_user_id', remaining)
    .not('profile_type', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !leadTiers) return result;

  for (const row of leadTiers) {
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
