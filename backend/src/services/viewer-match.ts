import { supabaseAdmin } from '../config/supabase.js';

// ── Viewer match ─────────────────────────────────────────────────────────────
// Computes, for the talent viewing a card, which of the card's required
// languages / country / region and optional skills-&-tools are present in their
// own profile. Purely descriptive for the talent's card UI (tick / cross) —
// it never affects who a card is broadcast to.

const lc = (s: unknown): string => (typeof s === 'string' ? s.trim().toLowerCase() : '');

export interface TalentMatchSignals {
  languages: Set<string>; // lowercased language names the talent speaks
  country: string | null; // structured country from talent_profiles_basic
  state: string | null; // structured state/region from talent_profiles_basic
  skills: Set<string>; // lowercased skill/tool/ai-tool/category names
}

// Item shapes across field_data groups are inconsistent (plain strings,
// `{ skill }`, `{ name }`, `{ category }`), so probe every known key.
function collectSkillNames(fieldData: any, out: Set<string>): void {
  if (!fieldData || typeof fieldData !== 'object') return;
  for (const g of ['_skills', '_tools', '_ai_tools', '_accounting_software', '_categories']) {
    const list = fieldData[g];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const name =
        typeof item === 'string'
          ? item
          : item?.name ?? item?.skill ?? item?.tool ?? item?.label ?? item?.category ?? '';
      const n = lc(name);
      if (n) out.add(n);
    }
  }
}

/** Load a talent's own match signals once, to compare against many cards. */
export async function getTalentMatchSignals(talentUserId: string): Promise<TalentMatchSignals> {
  const [{ data: tuser }, { data: basic }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('talent_users').select('languages_spoken').eq('id', talentUserId).maybeSingle(),
    supabaseAdmin
      .from('talent_profiles_basic')
      .select('country, state')
      .eq('talent_user_id', talentUserId)
      .maybeSingle(),
    supabaseAdmin
      .from('talent_profiles')
      .select('field_data')
      .eq('talent_user_id', talentUserId)
      .eq('status', 'approved')
      .is('deleted_at', null),
  ]);

  // languages_spoken items are objects ({ language, proficiency }) on real data,
  // though older rows may hold plain strings — handle both.
  const languages = new Set<string>();
  const spoken = (tuser as any)?.languages_spoken;
  if (Array.isArray(spoken)) {
    for (const l of spoken) {
      const name = typeof l === 'string' ? l : l?.language ?? l?.name ?? '';
      const n = lc(name);
      if (n) languages.add(n);
    }
  }

  const skills = new Set<string>();
  for (const p of profiles ?? []) collectSkillNames((p as any).field_data, skills);

  return {
    languages,
    country: ((basic as any)?.country as string | null) ?? null,
    state: ((basic as any)?.state as string | null) ?? null,
    skills,
  };
}

export interface MatchChip { label: string; matched: boolean }
export interface AdditionalMatchChip extends MatchChip { group: string }
export interface ViewerMatch {
  languages: MatchChip[];
  countries: MatchChip[];
  regions: MatchChip[];
  additional: AdditionalMatchChip[];
}

/**
 * Build the per-viewer match for one card. Required languages / country /
 * region come from match_rules; optional skills/tools from
 * content.additional_requirements. Everything is presence-only.
 */
export function buildViewerMatch(
  content: Record<string, unknown> | null | undefined,
  matchRules: Record<string, unknown> | null | undefined,
  signals: TalentMatchSignals,
): ViewerMatch {
  const mr = (matchRules ?? {}) as Record<string, any>;

  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];

  const languages: MatchChip[] = strList(mr.target_languages).map((l) => ({
    label: l,
    matched: signals.languages.has(lc(l)),
  }));

  const countries: MatchChip[] = strList(mr.target_country_names).map((c) => ({
    label: c,
    matched: !!signals.country && lc(signals.country) === lc(c),
  }));

  const regionNames: string[] = Array.isArray(mr.target_regions)
    ? mr.target_regions
        .map((r: any) => (typeof r === 'string' ? r : r?.region))
        .filter((x: any): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const regions: MatchChip[] = regionNames.map((rg) => ({
    label: rg,
    matched: !!signals.state && lc(signals.state) === lc(rg),
  }));

  const additional: AdditionalMatchChip[] = [];
  const ar = (content as any)?.additional_requirements;
  if (ar && typeof ar === 'object') {
    for (const [group, list] of Object.entries(ar)) {
      if (!Array.isArray(list)) continue;
      for (const label of list) {
        const l = typeof label === 'string' ? label.trim() : '';
        if (!l) continue;
        additional.push({ group, label: l, matched: signals.skills.has(l.toLowerCase()) });
      }
    }
  }

  return { languages, countries, regions, additional };
}
