import { supabaseAdmin } from '../config/supabase.js';

/**
 * Matcher for subscription cards → talents.
 *
 * `match_rules` is AND-across-known-keys. Each known key maps to one query
 * clause. Unknown keys are logged and skipped (forward-compat: SquadHub can
 * start sending new rules before Profiles knows about them, without dropping
 * the card).
 */

const MAX_MATCHES = 10_000;

export interface MatchRules {
  category_ids?: string[];
  target_tiers?: string[];
  min_experience_years?: number;
  target_languages?: string[];
  target_country_names?: string[];
  target_regions?: Array<{ country_name?: string; region: string }>;
  [key: string]: unknown;
}

const KNOWN_RULE_KEYS = new Set<string>([
  'category_ids',
  'target_tiers',
  'min_experience_years',
  'target_languages',
  'target_country_ids',
  'target_country_names',
  'target_regions',
]);

export async function findMatchingTalents(matchRules: MatchRules): Promise<string[]> {
  for (const key of Object.keys(matchRules)) {
    if (!KNOWN_RULE_KEYS.has(key)) {
      console.warn(`[subscription-matcher] ignoring unknown match rule "${key}"`);
    }
  }

  const categoryIds = Array.isArray(matchRules.category_ids)
    ? matchRules.category_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];

  if (categoryIds.length === 0) {
    return [];
  }

  // Step 1: Base query — category + experience. Suspended, blacklisted, and
  // inactive talents are excluded here so every fan-out path (ingest, broadcast,
  // fresh broadcast, reopen, publish) is gated in one place.
  //
  // The is_active gates mirror the business-facing RLS policy on
  // talent_profiles (migration 00026): a talent is browseable by businesses
  // only when talent_profiles.is_active AND talent_users.is_active. The matcher
  // runs as the service role, which bypasses RLS, so without these clauses an
  // inactive talent — hidden from every business search — would still be pushed
  // new cards, accept one, and end up invisible to the business that "hired"
  // them. Suspension and blacklist are separate, stronger blocks (no new
  // opportunities at all); blacklist mirrors suspension as a second such flag.
  let qb = supabaseAdmin
    .from('talent_profiles')
    .select('id, talent_user_id, talent_users!inner(suspended, blacklisted, is_active)')
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.suspended', false)
    .eq('talent_users.blacklisted', false)
    .eq('talent_users.is_active', true)
    .in('category_id', categoryIds);

  const minExp = Number(matchRules.min_experience_years) || 0;
  if (minExp > 0) {
    qb = qb.gte('field_data->>years_experience', String(minExp));
  }

  const { data: baseRows, error: baseErr } = await qb.limit(MAX_MATCHES);
  if (baseErr) {
    console.error('[subscription-matcher] base query failed', baseErr);
    throw baseErr;
  }

  let rows = (baseRows ?? []) as Array<{ id: string; talent_user_id: string }>;
  if (rows.length === 0) return [];

  // Step 2: Tier filter — narrow by profile IDs.
  //
  // Fail-closed: a card with no target_tiers means no tier intent, which
  // historically caused the filter to be skipped and every category-matching
  // talent to receive the card regardless of skill bracket. SquadHub now
  // gates publish on a non-empty target_tiers, but we mirror the rule here
  // as a safety net for legacy cards / direct webhook calls.
  const tiers = Array.isArray(matchRules.target_tiers)
    ? matchRules.target_tiers.map((t) => String(t).toLowerCase()).filter(Boolean)
    : [];
  if (tiers.length === 0) {
    console.warn(
      '[subscription-matcher] refusing to match — match_rules.target_tiers is missing or empty; card would otherwise broadcast to every category-matching talent',
    );
    return [];
  }
  {
    const profileIds = rows.map((r) => r.id);
    // Case-insensitive tier match. The stored tier (v_talent_profile_tier.tier)
    // is PascalCase 'Top Talents' for the top bracket but lowercase for
    // junior/pro, while SquadHub sends PascalCase over the wire. A
    // PostgREST `.in('tier', tiers)` is case-sensitive, so it silently dropped
    // every 'Top Talents' talent (incoming was lowercased to 'top talents').
    // Compare on lowercased values both sides so casing never loses a match.
    const tierSet = new Set(tiers); // `tiers` is already lowercased above
    const { data: tierRows, error: tierErr } = await supabaseAdmin
      .from('v_talent_profile_tier')
      .select('talent_profile_id, tier')
      .in('talent_profile_id', profileIds);
    if (tierErr) {
      console.error('[subscription-matcher] tier query failed', tierErr);
      throw tierErr;
    }
    const allowed = new Set(
      (tierRows ?? [])
        .filter((r: any) => tierSet.has(String(r.tier ?? '').toLowerCase()))
        .map((r: any) => r.talent_profile_id as string),
    );
    rows = rows.filter((r) => allowed.has(r.id));
    if (rows.length === 0) return [];
  }

  // Step 3: Country / region filter — narrow by talent_user_id
  const countryNames = Array.isArray(matchRules.target_country_names)
    ? matchRules.target_country_names.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  const regions = Array.isArray(matchRules.target_regions) ? matchRules.target_regions : [];

  if (countryNames.length > 0 || regions.length > 0) {
    const allCountries = new Set(countryNames.map((c) => c.toLowerCase()));
    for (const r of regions) {
      if (r.country_name) allCountries.add(r.country_name.toLowerCase());
    }

    const talentUserIds = [...new Set(rows.map((r) => r.talent_user_id))];
    const { data: basicRows, error: basicErr } = await supabaseAdmin
      .from('talent_profiles_basic')
      .select('talent_user_id, country, state')
      .in('talent_user_id', talentUserIds);
    if (basicErr) {
      console.error('[subscription-matcher] location query failed', basicErr);
      throw basicErr;
    }

    const regionPairs = regions
      .filter((r) => r.country_name && r.region)
      .map((r) => `${r.country_name!.toLowerCase()}::${r.region.toLowerCase()}`);
    const regionPairSet = new Set(regionPairs);
    const countriesWithRegions = new Set(
      regions.filter((r) => r.country_name && r.region).map((r) => r.country_name!.toLowerCase()),
    );

    const allowedUsers = new Set<string>();
    for (const b of basicRows ?? []) {
      const uid = b.talent_user_id as string;
      const country = String(b.country ?? '').toLowerCase();
      const state = String(b.state ?? '').toLowerCase();

      if (countriesWithRegions.has(country)) {
        if (regionPairSet.has(`${country}::${state}`)) allowedUsers.add(uid);
      } else if (allCountries.has(country)) {
        allowedUsers.add(uid);
      }
    }

    rows = rows.filter((r) => allowedUsers.has(r.talent_user_id));
    if (rows.length === 0) return [];
  }

  // Step 4: Language filter — JS post-filter on JSONB languages_spoken
  const langs = Array.isArray(matchRules.target_languages)
    ? matchRules.target_languages.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (langs.length > 0) {
    const wanted = new Set(langs.map((l) => l.toLowerCase()));
    const talentUserIds = [...new Set(rows.map((r) => r.talent_user_id))];
    const { data: userRows, error: userErr } = await supabaseAdmin
      .from('talent_users')
      .select('id, languages_spoken')
      .in('id', talentUserIds);
    if (userErr) {
      console.error('[subscription-matcher] language query failed', userErr);
      throw userErr;
    }

    const allowedUsers = new Set<string>();
    for (const u of userRows ?? []) {
      const spoken = u.languages_spoken as Array<{ language?: string }> | null;
      if (
        Array.isArray(spoken) &&
        spoken.some((l) => wanted.has(String(l?.language ?? '').toLowerCase()))
      ) {
        allowedUsers.add(u.id as string);
      }
    }

    rows = rows.filter((r) => allowedUsers.has(r.talent_user_id));
    if (rows.length === 0) return [];
  }

  const unique = new Set<string>();
  for (const row of rows) {
    if (row.talent_user_id) unique.add(row.talent_user_id);
  }
  return Array.from(unique);
}
