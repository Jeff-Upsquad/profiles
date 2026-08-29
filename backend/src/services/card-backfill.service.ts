import { supabaseAdmin } from '../config/supabase.js';

interface TalentSignals {
  isEligible: boolean;
  profileCategoryIds: Set<string>;
  profileIdsByCategory: Map<string, string[]>; // category_id -> profile ids
  profileExperienceById: Map<string, number>; // profile id -> years_experience
  tiersByProfileId: Map<string, string>; // profile id -> tier (lowercased)
  country: string;
  state: string;
  currentDistrict: string;
  languages: Set<string>; // lowercased language names
  age: number | null;
  gender: string; // lowercased
  optedIn: boolean;
  preferredDistricts: Set<string>; // lowercased
}

interface AgencySignals {
  services: Set<string>; // lowercased service names
  languages: Set<string>; // lowercased
  country: string; // lowercased
  state: string; // lowercased
}

async function loadTalentSignals(talentUserId: string): Promise<TalentSignals | null> {
  const { data: user, error: userErr } = await supabaseAdmin
    .from('talent_users')
    .select('id, is_active, suspended, blacklisted, age, gender, languages_spoken')
    .eq('id', talentUserId)
    .maybeSingle();
  if (userErr || !user) return null;
  const isEligible =
    (user as any).is_active !== false &&
    (user as any).suspended === false &&
    (user as any).blacklisted === false;
  if (!isEligible) {
    // Still return signals so caller knows it's ineligible (no matches)
    return {
      isEligible: false,
      profileCategoryIds: new Set(),
      profileIdsByCategory: new Map(),
      profileExperienceById: new Map(),
      tiersByProfileId: new Map(),
      country: '',
      state: '',
      currentDistrict: '',
      languages: new Set(),
      age: (user as any).age ?? null,
      gender: String((user as any).gender ?? '').toLowerCase(),
      optedIn: false,
      preferredDistricts: new Set(),
    };
  }

  const [{ data: profiles }, { data: basic }, { data: prefRows }] = await Promise.all([
    supabaseAdmin
      .from('talent_profiles')
      .select('id, category_id, field_data')
      .eq('talent_user_id', talentUserId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .is('deleted_at', null),
    supabaseAdmin
      .from('talent_profiles_basic')
      .select('country, state, current_district')
      .eq('talent_user_id', talentUserId)
      .maybeSingle(),
    supabaseAdmin
      .from('talent_job_preferences')
      .select('talent_user_id, preferred_districts, opted_in_at')
      .eq('talent_user_id', talentUserId)
      .maybeSingle(),
  ]);

  const profileCategoryIds = new Set<string>();
  const profileIdsByCategory = new Map<string, string[]>();
  const profileExperienceById = new Map<string, number>();
  const tids = (profiles ?? []).map((p: any) => p.id as string);
  for (const p of (profiles ?? []) as any[]) {
    profileCategoryIds.add(p.category_id as string);
    const arr = profileIdsByCategory.get(p.category_id as string) ?? [];
    arr.push(p.id as string);
    profileIdsByCategory.set(p.category_id as string, arr);
    const years = Number(p.field_data?.years_experience ?? p.field_data?._experience?.years ?? 0) || 0;
    profileExperienceById.set(p.id as string, years);
  }

  // Tier lookup
  const tiersByProfileId = new Map<string, string>();
  if (tids.length > 0) {
    const { data: tierRows } = await supabaseAdmin
      .from('v_talent_profile_tier')
      .select('talent_profile_id, tier')
      .in('talent_profile_id', tids);
    for (const r of (tierRows ?? []) as any[]) {
      if (r.tier) tiersByProfileId.set(r.talent_profile_id as string, String(r.tier).toLowerCase());
    }
  }

  const langsRaw = (user as any).languages_spoken as Array<{ language?: string }> | null;
  const languages = new Set(
    (Array.isArray(langsRaw) ? langsRaw : [])
      .map((l) => String(l?.language ?? '').toLowerCase())
      .filter(Boolean),
  );

  const country = String((basic as any)?.country ?? '').toLowerCase();
  const state = String((basic as any)?.state ?? '').toLowerCase();
  const currentDistrict = String((basic as any)?.current_district ?? '').toLowerCase();

  const optedIn = !!(prefRows as any)?.opted_in_at;
  const preferredDistricts = new Set<string>(
    (Array.isArray((prefRows as any)?.preferred_districts) ? (prefRows as any).preferred_districts : [])
      .map((d: string) => String(d).toLowerCase())
      .filter(Boolean),
  );

  return {
    isEligible: true,
    profileCategoryIds,
    profileIdsByCategory,
    profileExperienceById,
    tiersByProfileId,
    country,
    state,
    currentDistrict,
    languages,
    age: typeof (user as any).age === 'number' ? (user as any).age : null,
    gender: String((user as any).gender ?? '').toLowerCase(),
    optedIn,
    preferredDistricts,
  };
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

function doesTalentMatchCard(signals: TalentSignals, matchRules: MatchRules, cardType: string): boolean {
  if (!signals.isEligible) return false;

  const categoryIds = Array.isArray(matchRules.category_ids)
    ? matchRules.category_ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (categoryIds.length === 0) return false;

  // Category overlap: at least one approved profile in requested categories
  const hasCategory = categoryIds.some((cid) => signals.profileCategoryIds.has(cid));
  if (!hasCategory) return false;

  // Experience: at least one profile in matching categories meets min
  const minExp = Number(matchRules.min_experience_years) || 0;
  if (minExp > 0) {
    let ok = false;
    for (const cid of categoryIds) {
      const pids = signals.profileIdsByCategory.get(cid) ?? [];
      for (const pid of pids) {
        const yrs = signals.profileExperienceById.get(pid) ?? 0;
        if (yrs >= minExp) { ok = true; break; }
      }
      if (ok) break;
    }
    if (!ok) return false;
  }

  // Tier filter
  const tiers = Array.isArray(matchRules.target_tiers)
    ? matchRules.target_tiers.map((t) => String(t).toLowerCase()).filter(Boolean)
    : [];
  if (tiers.length === 0 && cardType !== 'hiring') {
    // Fail-closed for subscription/assignment with missing tiers
    return false;
  }
  if (tiers.length > 0) {
    const wanted = new Set(tiers);
    let ok = false;
    for (const cid of categoryIds) {
      const pids = signals.profileIdsByCategory.get(cid) ?? [];
      for (const pid of pids) {
        const tier = signals.tiersByProfileId.get(pid);
        if (tier && wanted.has(tier)) { ok = true; break; }
      }
      if (ok) break;
    }
    if (!ok) return false;
  }

  // Country / region
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

  // Language
  const langs = Array.isArray(matchRules.target_languages)
    ? matchRules.target_languages.filter((v): v is string => typeof v === 'string' && v.length > 0).map((l) => l.toLowerCase())
    : [];
  if (langs.length > 0) {
    const wanted = new Set(langs);
    let ok = false;
    for (const l of signals.languages) if (wanted.has(l)) { ok = true; break; }
    if (!ok) return false;
  }

  // Hiring-only steps
  if (cardType === 'hiring') {
    if (!signals.optedIn) return false;

    const minAge = Number(matchRules.min_age) || 0;
    const maxAge = Number(matchRules.max_age) || 0;
    const genders = Array.isArray(matchRules.target_genders)
      ? matchRules.target_genders.map((g) => String(g).toLowerCase()).filter(Boolean)
      : [];
    if (minAge > 0 || maxAge > 0 || genders.length > 0) {
      const age = signals.age;
      if (minAge > 0 && (age === null || age < minAge)) return false;
      if (maxAge > 0 && (age === null || age > maxAge)) return false;
      if (genders.length > 0 && !new Set(genders).has(signals.gender)) return false;
    }

    const districts = Array.isArray(matchRules.target_districts)
      ? matchRules.target_districts.filter((v): v is string => typeof v === 'string' && v.length > 0).map((d) => d.toLowerCase())
      : [];
    if (districts.length > 0) {
      const wanted = new Set(districts);
      const byPreferred = [...signals.preferredDistricts].some((d) => wanted.has(d));
      const byCurrent = signals.currentDistrict && wanted.has(signals.currentDistrict);
      if (!byPreferred && !byCurrent) return false;
    }
  }

  return true;
}

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
  const signals = await loadTalentSignals(talentUserId);
  if (!signals || !signals.isEligible) return 0;
  if (signals.profileCategoryIds.size === 0) return 0;

  // Fetch eligible cards
  const { data: cards, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, match_rules, card_type, distribution, status, archived_at')
    .eq('status', 'active')
    .is('archived_at', null)
    .limit(5000);
  if (error) {
    console.error('[card-backfill] failed to load cards for talent', error);
    return 0;
  }
  const eligibleCards = (cards ?? []).filter((c: any) => {
    const dist = (c as any).distribution as string | null;
    // Manual cards only surface via hand-pick, never backfill
    if (dist === 'manual') return false;
    return true;
  });
  if (eligibleCards.length === 0) return 0;

  const matchingCardIds: string[] = [];
  for (const c of eligibleCards as any[]) {
    const rules = (c.match_rules ?? {}) as MatchRules;
    const cardType = (c.card_type ?? 'subscription') as string;
    if (doesTalentMatchCard(signals, rules, cardType)) matchingCardIds.push(c.id as string);
  }
  if (matchingCardIds.length === 0) return 0;

  // Existing active recipients
  const { data: existing } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('card_id')
    .eq('talent_user_id', talentUserId)
    .is('cancelled_at', null)
    .in('card_id', matchingCardIds);
  const existingSet = new Set((existing ?? []).map((r: any) => r.card_id as string));
  const toInsert = matchingCardIds.filter((id) => !existingSet.has(id));
  if (toInsert.length === 0) return 0;

  const rows = toInsert.map((card_id) => ({
    card_id,
    talent_user_id: talentUserId,
    status: 'pending' as const,
  }));
  const { error: insErr, count } = await supabaseAdmin
    .from('subscription_card_recipients')
    .insert(rows, { count: 'exact' });
  if (insErr) {
    if ((insErr as any).code !== '23505') {
      console.error('[card-backfill] insert failed for talent', insErr);
    }
    return 0;
  }
  const inserted = count ?? toInsert.length;
  if (inserted > 0) {
    console.info('[card-backfill] talent backfilled', { talentUserId, inserted });
  }
  return inserted;
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
