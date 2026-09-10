import { supabaseAdmin } from '../config/supabase.js';

export type SignupCategory = 'all' | 'creative' | 'accountant' | 'sales';

const CREATIVE_FORM_TYPES = ['creative'];
const ACCOUNTANT_FORM_TYPES = ['accountant'];
const SALES_FORM_TYPES = ['sales'];
const CREATIVE_SLUGS = ['designer', 'designer-editor', 'video-editor'];
const ACCOUNTANT_SLUGS = ['accountant'];
const SALES_SLUGS = ['sales'];

const SLUG_TO_FORM_TYPE: Record<string, string> = {
  designer: 'creative',
  'designer-editor': 'creative',
  'video-editor': 'creative',
  accountant: 'accountant',
  sales: 'sales',
};

/**
 * Landing-page / CTA slugs → form_type. The partner-program pages live on the
 * marketing site (upsquadconnect.com/partner-program/<slug>), so the slug is
 * the only thing that crosses over when someone clicks through to signup.
 * Keys are matched as substrings of a lowercased hint, longest first, so
 * "designer-and-video-editor" wins over the bare "designer" it contains.
 */
const SIGNUP_HINT_TO_FORM_TYPE: Record<string, string> = {
  'designer-and-video-editor': 'creative',
  'designer-video-editor': 'creative',
  'designer-editor': 'creative',
  'video-editor': 'creative',
  'graphic-designer': 'creative',
  designer: 'creative',
  editor: 'creative',
  creative: 'creative',
  accountant: 'accountant',
  accounting: 'accountant',
  sales: 'sales',
};

/**
 * Resolve a free-form signup hint (a `?role=` value, a referrer URL, or a
 * WhatsApp CTA line) to a form_type. Returns null when nothing matches, which
 * callers must treat as "unknown" rather than defaulting to creative — a wrong
 * confident answer is worse than an honest blank here.
 */
export function formTypeFromSignupHint(hint: string | null | undefined): string | null {
  const v = (hint ?? '').trim().toLowerCase();
  if (!v) return null;
  const keys = Object.keys(SIGNUP_HINT_TO_FORM_TYPE).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (v.includes(k)) return SIGNUP_HINT_TO_FORM_TYPE[k];
  }
  return null;
}

function formTypesForCategory(category: SignupCategory): string[] | null {
  if (category === 'creative') return CREATIVE_FORM_TYPES;
  if (category === 'accountant') return ACCOUNTANT_FORM_TYPES;
  if (category === 'sales') return SALES_FORM_TYPES;
  return null;
}

function slugsForCategory(category: SignupCategory): string[] | null {
  if (category === 'creative') return CREATIVE_SLUGS;
  if (category === 'accountant') return ACCOUNTANT_SLUGS;
  if (category === 'sales') return SALES_SLUGS;
  return null;
}

export function parseSignupCategory(raw: string | undefined | null): SignupCategory {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'creative' || v === 'accountant' || v === 'sales') return v;
  return 'all';
}

/**
 * Talent user ids that belong to a Sign-ups category. A talent matches if they
 * have a linked candidate lead of that form_type OR a profile in a matching
 * job category. `all` returns null (no id filter).
 */
export async function talentIdsForSignupCategory(
  category: SignupCategory,
): Promise<string[] | null> {
  if (category === 'all') return null;

  const formTypes = formTypesForCategory(category) ?? [];
  const slugs = slugsForCategory(category) ?? [];
  const ids = new Set<string>();

  if (formTypes.length) {
    const { data: leads } = await supabaseAdmin
      .from('lead_submissions')
      .select('linked_talent_user_id')
      .in('form_type', formTypes)
      .not('linked_talent_user_id', 'is', null)
      .is('deleted_at', null);
    for (const row of leads ?? []) {
      const id = (row as { linked_talent_user_id?: string | null }).linked_talent_user_id;
      if (id) ids.add(id);
    }
  }

  // Captured at signup — the only signal for landing-page signups, who have
  // neither a lead nor (yet) a profile category.
  if (formTypes.length) {
    const { data: signups } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .in('signup_form_type', formTypes);
    for (const row of signups ?? []) {
      const id = (row as { id?: string | null }).id;
      if (id) ids.add(id);
    }
  }

  if (slugs.length) {
    const { data: cats } = await supabaseAdmin.from('categories').select('id').in('slug', slugs);
    const catIds = (cats ?? []).map((c: { id: string }) => c.id);
    if (catIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('talent_profiles')
        .select('talent_user_id')
        .in('category_id', catIds);
      for (const row of profiles ?? []) {
        const id = (row as { talent_user_id?: string | null }).talent_user_id;
        if (id) ids.add(id);
      }
    }
  }

  return [...ids];
}

/** form_type values a talent belongs to, from linked leads + profile categories. */
export async function formTypesForTalent(talentUserId: string): Promise<string[]> {
  const found = new Set<string>();

  // Checked first so it wins the insertion-order tie-break in callers that take
  // the first entry (notifyCrmTalentSignedUp picks a CRM pipeline this way):
  // what someone told us at signup beats a category inferred later.
  const { data: signup } = await supabaseAdmin
    .from('talent_users')
    .select('signup_form_type')
    .eq('id', talentUserId)
    .maybeSingle();
  const signupFt = (signup as { signup_form_type?: string | null } | null)?.signup_form_type;
  if (signupFt) found.add(signupFt);

  const { data: leads } = await supabaseAdmin
    .from('lead_submissions')
    .select('form_type')
    .eq('linked_talent_user_id', talentUserId)
    .is('deleted_at', null);
  for (const row of leads ?? []) {
    const ft = (row as { form_type?: string | null }).form_type;
    if (ft) found.add(ft);
  }

  const { data: profiles } = await supabaseAdmin
    .from('talent_profiles')
    .select('category_id')
    .eq('talent_user_id', talentUserId);
  const catIds = (profiles ?? [])
    .map((p: { category_id?: string | null }) => p.category_id)
    .filter((id): id is string => !!id);
  if (catIds.length) {
    const { data: cats } = await supabaseAdmin.from('categories').select('id, slug').in('id', catIds);
    for (const c of cats ?? []) {
      const mapped = SLUG_TO_FORM_TYPE[(c as { slug: string }).slug];
      if (mapped) found.add(mapped);
    }
  }

  return [...found];
}

export async function signupCategoriesByTalentIds(
  ids: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (ids.length === 0) return out;

  const { data: signups } = await supabaseAdmin
    .from('talent_users')
    .select('id, signup_form_type')
    .in('id', ids)
    .not('signup_form_type', 'is', null);

  const { data: leads } = await supabaseAdmin
    .from('lead_submissions')
    .select('linked_talent_user_id, form_type')
    .in('linked_talent_user_id', ids)
    .is('deleted_at', null);

  const { data: profiles } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id, category_id')
    .in('talent_user_id', ids);

  const catIds = [
    ...new Set(
      (profiles ?? [])
        .map((p: { category_id?: string | null }) => p.category_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const slugByCat = new Map<string, string>();
  if (catIds.length) {
    const { data: cats } = await supabaseAdmin.from('categories').select('id, slug').in('id', catIds);
    for (const c of cats ?? []) {
      slugByCat.set((c as { id: string }).id, (c as { slug: string }).slug);
    }
  }

  const sets = new Map<string, Set<string>>();
  const add = (talentId: string, formType: string) => {
    const s = sets.get(talentId) ?? new Set<string>();
    s.add(formType);
    sets.set(talentId, s);
  };

  for (const row of signups ?? []) {
    const tid = (row as { id?: string | null }).id;
    const ft = (row as { signup_form_type?: string | null }).signup_form_type;
    if (tid && ft) add(tid, ft);
  }
  for (const row of leads ?? []) {
    const tid = (row as { linked_talent_user_id?: string | null }).linked_talent_user_id;
    const ft = (row as { form_type?: string | null }).form_type;
    if (tid && ft) add(tid, ft);
  }
  for (const row of profiles ?? []) {
    const tid = (row as { talent_user_id?: string | null }).talent_user_id;
    const slug = slugByCat.get((row as { category_id?: string | null }).category_id ?? '');
    const ft = slug ? SLUG_TO_FORM_TYPE[slug] : undefined;
    if (tid && ft) add(tid, ft);
  }

  for (const [tid, s] of sets) out.set(tid, [...s]);
  return out;
}
