import { CREATOR_ROLES } from '../../../shared/src/creatorRoles.js';
import type { MatchRules } from '../services/subscription-matcher.service.js';

export function isCreatorCard(rules: MatchRules): boolean {
  return rules.category_ids?.length === 1 && rules.category_ids[0] === CREATOR_ROLES[0].id;
}

// Half-open intervals give every follower count exactly one level.
const LEVELS: Record<string, [number, number]> = {
  'Below 5,000': [0, 5000], '5,000 to 10,000': [5000, 10000],
  '10,000 to 25,000': [10000, 25000], '25,000 to 50,000': [25000, 50000],
  '50,000 to 100k': [50000, 100000], '100k to 500k': [100000, 500000],
  '500k to 1 mil': [500000, 1000000], '1 million+': [1000000, Infinity],
};

/** Older CRM cards carry creator selections only in display content. Preserve
 * explicit rules, and recover the selections rather than matching talent tiers. */
export function creatorMatchRules(rules: MatchRules, content: Record<string, unknown> = {}): MatchRules {
  if (!isCreatorCard(rules)) return rules;
  const additional = (content.additional_requirements ?? {}) as Record<string, unknown>;
  const result = { ...rules };
  for (const key of ['services', 'niches', 'formats', 'levels'] as const) {
    const target = `target_creator_${key}`;
    if (result[target] === undefined && Array.isArray(additional[`creator_${key}`])) {
      result[target] = (additional[`creator_${key}`] as unknown[])
        .filter((v): v is string => typeof v === 'string')
        .map((v) => key === 'levels' ? v.replace(/\s*\(.*$/, '').trim() : v);
    }
  }
  if (result.target_creator_platforms === undefined && Array.isArray(additional.channels)) {
    result.target_creator_platforms = additional.channels;
  }
  return result;
}

export function matchesCreatorAudience(fieldData: Record<string, unknown>, rules: MatchRules): boolean {
  // The creator form requests Custom; avoid delivering standard-tier siblings.
  if (rules.target_tiers?.length && !rules.target_tiers.some((t) => t.toLowerCase() === 'custom')) return false;
  const levels = rules.target_creator_levels ?? [];
  const platforms = rules.target_creator_platforms ?? [];
  if (levels.length === 0) return false; // Missing creator intent must not broadcast.
  const entries = Array.isArray(fieldData.creator_platforms) ? fieldData.creator_platforms : [];
  return entries.some((p: { platform?: string; followers?: unknown }) => {
    if (platforms.length && !platforms.some((v) => v.toLowerCase() === String(p.platform ?? '').toLowerCase())) return false;
    if (p.followers === '' || p.followers == null) return false;
    const followers = Number(p.followers);
    return Number.isFinite(followers) && levels.some((level) => {
      const range = LEVELS[level];
      return range !== undefined && followers >= range[0] && followers < range[1];
    });
  });
}
