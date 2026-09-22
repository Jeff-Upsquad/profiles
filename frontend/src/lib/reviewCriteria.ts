import type { BusinessSubscriptionCardDetail, CardRecipientForBusiness } from '@/hooks/useBusiness';

export interface CriteriaMatchItem {
  key: string;
  category: 'Role' | 'Location' | 'Language' | 'Tool';
  label: string;
  detail?: string;
  matches: boolean;
  optional?: boolean;
}

export interface ReqItem { group: string; label: string }

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

export function flattenAdditionalReqs(raw: Record<string, string[]> | null | undefined): ReqItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: ReqItem[] = [];
  for (const [group, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    for (const label of list) {
      const name = typeof label === 'string' ? label.trim() : '';
      if (name) out.push({ group, label: name });
    }
  }
  return out;
}

function spokenLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const name = typeof item === 'string' ? item : item?.language ?? item?.name;
    return typeof name === 'string' && name.trim() ? [name.trim()] : [];
  });
}

/** Describe every requested preference. Broadcast eligibility is decided elsewhere. */
export function evaluateRecipientMatches(
  recipient: CardRecipientForBusiness,
  card: BusinessSubscriptionCardDetail,
): { items: CriteriaMatchItem[]; isAllMatch: boolean } {
  const items: CriteriaMatchItem[] = [];
  items.push({
    key: 'category',
    category: 'Role',
    label: recipient.category?.name || card.categories?.[0]?.name || 'Required Role',
    matches: true,
  });

  const country = normalize(recipient.country);
  const state = normalize(recipient.state);
  const regions = (card.target_regions ?? []).filter(
    (region) => typeof region?.region === 'string' && region.region.trim(),
  );
  const countries = new Map<string, string>();
  for (const name of card.target_country_names ?? []) {
    if (normalize(name)) countries.set(normalize(name), name.trim());
  }
  for (const region of regions) {
    if (normalize(region.country_name)) {
      countries.set(normalize(region.country_name), region.country_name!.trim());
    }
  }

  const countryMatches = countries.size === 0 || countries.has(country);
  if (countries.size > 0) {
    items.push({
      key: 'country',
      category: 'Location',
      label: `Country · ${recipient.country?.trim() || 'Not listed'}`,
      detail: countryMatches ? undefined : `req. ${[...countries.values()].join('/')}`,
      matches: countryMatches,
    });
  }

  // A selected country without its own region rule is country-wide. Regions
  // narrow only their associated country, as in the broadcast matcher.
  const applicableRegions = regions.filter(
    (region) => !normalize(region.country_name) || normalize(region.country_name) === country,
  );
  if (applicableRegions.length > 0 || (regions.length > 0 && !countryMatches)) {
    const wanted = applicableRegions.length > 0 ? applicableRegions : regions;
    const regionMatches = applicableRegions.some((region) => normalize(region.region) === state);
    items.push({
      key: 'region',
      category: 'Location',
      label: `Region · ${recipient.state?.trim() || 'Not listed'}`,
      detail: regionMatches ? undefined : `req. ${wanted.map((region) => region.region).join('/')}`,
      matches: regionMatches,
    });
  }

  const targetLanguages = (card.target_languages ?? []).filter(
    (language) => typeof language === 'string' && language.trim(),
  );
  if (targetLanguages.length > 0) {
    const spoken = spokenLanguages(recipient.languages_spoken);
    const matched = targetLanguages.filter((language) => spoken.some((name) => normalize(name) === normalize(language)));
    items.push({
      key: 'language',
      category: 'Language',
      label: `Language · ${matched.length > 0 ? matched.join(', ') : spoken.slice(0, 2).join(', ') || 'Not listed'}`,
      detail: matched.length > 0 ? undefined : `req. ${targetLanguages.join('/')}`,
      matches: matched.length > 0,
    });
  }

  const skills = new Set((recipient.skill_tool_names ?? []).map(normalize));
  for (const requirement of flattenAdditionalReqs(card.additional_requirements)) {
    items.push({
      key: `req-${requirement.group}-${requirement.label}`,
      category: 'Tool',
      label: requirement.label,
      matches: skills.has(normalize(requirement.label)),
      optional: true,
    });
  }

  return { items, isAllMatch: items.every((item) => item.matches) };
}
