import { reconcileTalentCardDeliveries } from './talent-card-delivery.service.js';
import { supabaseAdmin } from '../config/supabase.js';

interface AgencySignals {
  services: Set<string>; // lowercased service names
  languages: Set<string>; // lowercased
  country: string; // lowercased
  state: string; // lowercased
}

async function loadAgencySignals(agencyUserId: string): Promise<AgencySignals | null> {
  const { data: profile } = await supabaseAdmin
    .from('agency_profiles')
    .select('services, languages, location_country, location_state')
    .eq('agency_user_id', agencyUserId)
    .maybeSingle();
  if (!profile) return null;
  const services = new Set<string>(
    (Array.isArray((profile as any).services) ? (profile as any).services : [])
      .map((s: string) => String(s).toLowerCase())
      .filter(Boolean),
  );
  const languages = new Set<string>(
    (Array.isArray((profile as any).languages) ? (profile as any).languages : [])
      .map((l: string) => String(l).toLowerCase())
      .filter(Boolean),
  );
  return {
    services,
    languages,
    country: String((profile as any).location_country ?? '').toLowerCase(),
    state: String((profile as any).location_state ?? '').toLowerCase(),
  };
}

type MatchRules = {
  category_ids?: string[];
  target_tiers?: string[];
  min_experience_years?: number;
  target_languages?: string[];
  target_country_names?: string[];
  target_regions?: Array<{ country_name?: string; region: string }>;
  min_age?: number;
  max_age?: number;
  target_genders?: string[];
  target_districts?: string[];
  [key: string]: unknown;
};

function doesAgencyMatchCard(
  signals: AgencySignals,
  matchRules: MatchRules,
  categoryNamesById: Map<string, string>,
): boolean {
  const categoryIds = Array.isArray(matchRules.category_ids)
    ? matchRules.category_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (categoryIds.length === 0) return false;
  const wantedServices = new Set(
    categoryIds.map((id) => (categoryNamesById.get(id) ?? '').toLowerCase()).filter(Boolean),
  );
  if (wantedServices.size === 0) return false;
  let catOk = false;
  for (const s of signals.services) if (wantedServices.has(s)) { catOk = true; break; }
  if (!catOk) return false;

  const langs = Array.isArray(matchRules.target_languages)
    ? matchRules.target_languages.filter((v): v is string => typeof v === 'string' && v.length > 0).map((l) => l.toLowerCase())
    : [];
  if (langs.length > 0) {
    const wanted = new Set(langs);
    let ok = false;
    for (const l of signals.languages) if (wanted.has(l)) { ok = true; break; }
    if (!ok) return false;
  }

  const countryNames = Array.isArray(matchRules.target_country_names)
    ? matchRules.target_country_names.filter((v): v is string => typeof v === 'string' && v.length > 0).map((c) => c.toLowerCase())
    : [];
  const regions = Array.isArray(matchRules.target_regions) ? matchRules.target_regions as Array<{ country_name?: string; region: string }> : [];
  if (countryNames.length > 0 || regions.length > 0) {
    const allCountries = new Set(countryNames);
    for (const r of regions) if (r.country_name) allCountries.add(String(r.country_name).toLowerCase());
    const regionPairs = regions
      .filter((r) => r.country_name && r.region)
      .map((r) => `${String(r.country_name).toLowerCase()}::${String(r.region).toLowerCase()}`);
    const regionPairSet = new Set(regionPairs);
    const countriesWithRegions = new Set(
      regions.filter((r) => r.country_name && r.region).map((r) => String(r.country_name).toLowerCase()),
    );
    const country = signals.country;
    const state = signals.state;
    let allowed = false;
    if (countriesWithRegions.has(country)) {
      allowed = regionPairSet.has(`${country}::${state}`);
    } else if (allCountries.has(country)) {
      allowed = true;
    }
    if (!allowed) return false;
  }

  return true;
}

export async function backfillCardsForTalent(talentUserId: string): Promise<number> {
  const result = await reconcileTalentCardDeliveries({ talentUserId, apply: true });
  return result.inserted;
}

export async function backfillCardsForAgency(agencyUserId: string): Promise<number> {
  const signals = await loadAgencySignals(agencyUserId);
  if (!signals) return 0;
  if (signals.services.size === 0) return 0;

  const [{ data: cards, error }, { data: cats }] = await Promise.all([
    supabaseAdmin
      .from('subscription_cards')
      .select('id, match_rules, distribution, status, archived_at')
      .eq('status', 'active')
      .is('archived_at', null)
      .limit(5000),
    supabaseAdmin.from('categories').select('id, name'),
  ]);
  if (error) {
    console.error('[card-backfill] failed to load cards for agency', error);
    return 0;
  }
  const categoryNamesById = new Map<string, string>();
  for (const c of (cats ?? []) as any[]) categoryNamesById.set(c.id as string, String(c.name));

  const eligibleCards = (cards ?? []).filter((c: any) => (c as any).distribution !== 'manual');
  const matchingIds: string[] = [];
  for (const c of eligibleCards as any[]) {
    const rules = (c.match_rules ?? {}) as MatchRules;
    if (doesAgencyMatchCard(signals, rules, categoryNamesById)) matchingIds.push(c.id as string);
  }
  if (matchingIds.length === 0) return 0;

  const { data: existing } = await supabaseAdmin
    .from('agency_card_recipients')
    .select('card_id')
    .eq('agency_user_id', agencyUserId)
    .is('cancelled_at', null)
    .in('card_id', matchingIds);
  const existingSet = new Set((existing ?? []).map((r: any) => r.card_id as string));
  const toInsert = matchingIds.filter((id) => !existingSet.has(id));
  if (toInsert.length === 0) return 0;

  const rows = toInsert.map((card_id) => ({
    card_id,
    agency_user_id: agencyUserId,
    status: 'pending' as const,
  }));
  const { error: insErr, count } = await supabaseAdmin
    .from('agency_card_recipients')
    .insert(rows, { count: 'exact' });
  if (insErr) {
    if ((insErr as any).code !== '23505') console.error('[card-backfill] agency insert failed', insErr);
    return 0;
  }
  const inserted = count ?? toInsert.length;
  if (inserted > 0) console.info('[card-backfill] agency backfilled', { agencyUserId, inserted });
  return inserted;
}

// Fan-out for newly published card -> agencies (mirrors talent fan-out in subscription.service)
export async function fanoutCardToAgencies(cardId: string, matchRules: MatchRules): Promise<number> {
  const { findMatchingAgencies } = await import('./agency-matcher.service.js');
  const eligibleIds = await findMatchingAgencies(matchRules as any);
  if (eligibleIds.length === 0) return 0;

  // Dedupe against existing
  const { data: existing } = await supabaseAdmin
    .from('agency_card_recipients')
    .select('agency_user_id')
    .eq('card_id', cardId)
    .is('cancelled_at', null)
    .in('agency_user_id', eligibleIds);
  const existingSet = new Set((existing ?? []).map((r: any) => r.agency_user_id as string));
  const newIds = eligibleIds.filter((id) => !existingSet.has(id));
  if (newIds.length === 0) return 0;

  const rows = newIds.map((agency_user_id) => ({ card_id: cardId, agency_user_id, status: 'pending' as const }));
  const { error: insErr, count } = await supabaseAdmin.from('agency_card_recipients').insert(rows, { count: 'exact' });
  if (insErr) {
    if ((insErr as any).code !== '23505') console.error('[card-backfill] fanout agency insert failed', insErr);
    return 0;
  }
  return count ?? newIds.length;
}
