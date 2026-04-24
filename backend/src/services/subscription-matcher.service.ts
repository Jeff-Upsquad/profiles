import { supabaseAdmin } from '../config/supabase.js';

/**
 * Matcher for subscription cards → talents.
 *
 * `match_rules` is AND-across-known-keys. Each known key maps to one query
 * clause. Unknown keys are logged and skipped (forward-compat: SquadHub can
 * start sending new rules before Profiles knows about them, without dropping
 * the card).
 *
 * New rules plug in as new helper functions — resist inventing a DSL; add
 * shape one rule at a time when a concrete need exists.
 */

const MAX_MATCHES = 10_000;

export interface MatchRules {
  category_ids?: string[];
  [key: string]: unknown;
}

const KNOWN_RULE_KEYS = new Set<keyof MatchRules>(['category_ids']);

export async function findMatchingTalents(matchRules: MatchRules): Promise<string[]> {
  for (const key of Object.keys(matchRules)) {
    if (!KNOWN_RULE_KEYS.has(key as keyof MatchRules)) {
      console.warn(`[subscription-matcher] ignoring unknown match rule "${key}"`);
    }
  }

  const categoryIds = Array.isArray(matchRules.category_ids)
    ? matchRules.category_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];

  if (categoryIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .eq('status', 'approved')
    .in('category_id', categoryIds)
    .limit(MAX_MATCHES);

  if (error) {
    console.error('[subscription-matcher] query failed', error);
    throw error;
  }

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.talent_user_id) unique.add(row.talent_user_id as string);
  }
  return Array.from(unique);
}
