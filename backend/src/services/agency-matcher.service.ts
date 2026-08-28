import { supabaseAdmin } from '../config/supabase.js';

/**
 * Matcher for requirement cards → agencies.
 *
 * Mirrors subscription-matcher.service.ts but for the agency product line.
 * An agency matches when ALL of the following overlap (when the card sets them):
 *  - category (services) — card's category_ids vs agency_profiles.services (TEXT[] of category names)
 *  - language — card's target_languages vs agency_profiles.languages (TEXT[])
 *  - location — card's target_country_names / target_regions vs agency_profiles location_*
 *
 * Agencies have no tier gate, so no tier step. Keep the AND-across-keys rule.
 */

export interface AgencyMatchRules {
  category_ids?: string[];
  target_languages?: string[];
  target_country_names?: string[];
  target_regions?: Array<{ country_name?: string; region: string }>;
  [key: string]: unknown;
}

const MAX_MATCHES = 10_000;

export async function findMatchingAgencies(matchRules: AgencyMatchRules): Promise<string[]> {
  const categoryIds = Array.isArray(matchRules.category_ids)
    ? matchRules.category_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (categoryIds.length === 0) return [];

  // Resolve category ids → names so we can compare against agency_profiles.services (names)
  let categoryNames: string[] = [];
  try {
    const { data: catRows } = await supabaseAdmin.from('categories').select('id, name').in('id', categoryIds);
    categoryNames = (catRows ?? []).map((r: any) => String(r.name)).filter(Boolean);
  } catch {
    // if categories lookup fails, fall back to empty (no match)
    return [];
  }
  if (categoryNames.length === 0) return [];
  const wantedServices = new Set(categoryNames.map((n) => n.toLowerCase()));

  // Base query: approved agencies only, services overlap check is done in JS (TEXT[] overlap)
  // Fetch candidates with at least one service overlapping, plus languages + location columns needed for next steps
  let q = supabaseAdmin
    .from('agency_profiles')
    .select('agency_user_id, services, languages, location_country, location_state, location_district, location_city')
    .limit(MAX_MATCHES);

  const { data: rows, error } = await q;
  if (error) throw error;
  let candidates = (rows ?? []) as Array<{
    agency_user_id: string;
    services: string[] | null;
    languages: string[] | null;
    location_country: string | null;
    location_state: string | null;
    location_district: string | null;
    location_city: string | null;
  }>;

  // Step 1: category (services) overlap
  candidates = candidates.filter((r) => {
    const svcs = Array.isArray(r.services) ? r.services : [];
    return svcs.some((s) => wantedServices.has(String(s).toLowerCase()));
  });
  if (candidates.length === 0) return [];

  // Step 2: language overlap (if card specifies target_languages)
  const langs = Array.isArray(matchRules.target_languages)
    ? matchRules.target_languages.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (langs.length > 0) {
    const wanted = new Set(langs.map((l) => l.toLowerCase()));
    candidates = candidates.filter((r) => {
      const spoken = Array.isArray(r.languages) ? r.languages : [];
      return spoken.some((l) => wanted.has(String(l).toLowerCase()));
    });
    if (candidates.length === 0) return [];
  }

  // Step 3: location overlap (country / region)
  const countryNames = Array.isArray(matchRules.target_country_names)
    ? matchRules.target_country_names.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  const regions = Array.isArray(matchRules.target_regions) ? matchRules.target_regions : [];
  if (countryNames.length > 0 || regions.length > 0) {
    const allCountries = new Set(countryNames.map((c) => c.toLowerCase()));
    for (const r of regions) if (r.country_name) allCountries.add(r.country_name.toLowerCase());
    const regionPairs = regions
      .filter((r) => r.country_name && r.region)
      .map((r) => `${r.country_name!.toLowerCase()}::${r.region.toLowerCase()}`);
    const regionPairSet = new Set(regionPairs);
    const countriesWithRegions = new Set(
      regions.filter((r) => r.country_name && r.region).map((r) => r.country_name!.toLowerCase()),
    );

    candidates = candidates.filter((r) => {
      const country = String(r.location_country ?? '').toLowerCase();
      const state = String(r.location_state ?? '').toLowerCase();
      if (countriesWithRegions.has(country)) {
        return regionPairSet.has(`${country}::${state}`);
      }
      return allCountries.has(country);
    });
    if (candidates.length === 0) return [];
  }

  return [...new Set(candidates.map((r) => r.agency_user_id).filter(Boolean))];
}
