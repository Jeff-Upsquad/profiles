import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Read-only data exposed to SquadHub via signed integration endpoints.
 *
 * `listActiveCategories` returns public-ish metadata — no PII.
 * `searchActiveTalents` returns minimal talent identity (id, name, country)
 * so SquadHub admins can hand-pick talents on the manual-assign picker.
 * Both are gated by the same shared-secret middleware as the inbound card
 * ingest — a caller that can write a card can also read this surface.
 */

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
}

export async function listActiveCategories(): Promise<PublicCategory[]> {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, description, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return (data ?? []) as PublicCategory[];
}

export interface PublicTalent {
  id: string;
  name: string;
  email: string | null;
  country: string | null;
  tier: string | null;
}

const TALENT_SEARCH_LIMIT = 20;
// Overshoot the candidate query so the post-filter for talents with at least
// one approved profile still has room to fill the limit.
const TALENT_CANDIDATE_LIMIT = 60;

/**
 * Substring search across talent_users.full_name. Only returns talents that
 * have at least one approved + active talent_profile, so admins don't invite
 * draft / rejected / inactive accounts. Email is intentionally null today —
 * it lives in auth.users and isn't part of this public surface.
 */
export async function searchActiveTalents(rawQuery: string): Promise<PublicTalent[]> {
  const q = rawQuery.trim();
  if (q.length === 0) return [];

  const escaped = q.replace(/[%_\\]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const { data: users, error: usersErr } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .ilike('full_name', pattern)
    .order('full_name', { ascending: true })
    .limit(TALENT_CANDIDATE_LIMIT);
  if (usersErr) throw new AppError(500, usersErr.message);
  if (!users || users.length === 0) return [];

  const ids = users.map((u: any) => u.id as string);

  const { data: approvedRows, error: profilesErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .in('talent_user_id', ids)
    .eq('status', 'approved')
    .eq('is_active', true)
    .is('deleted_at', null);
  if (profilesErr) throw new AppError(500, profilesErr.message);
  const approvedSet = new Set((approvedRows ?? []).map((r: any) => r.talent_user_id as string));

  const { data: basics } = await supabaseAdmin
    .from('talent_profiles_basic')
    .select('talent_user_id, country')
    .in('talent_user_id', ids);
  const countryByUser = new Map<string, string | null>();
  for (const b of basics ?? []) {
    countryByUser.set((b as any).talent_user_id, ((b as any).country as string | null) ?? null);
  }

  return users
    .filter((u: any) => approvedSet.has(u.id))
    .slice(0, TALENT_SEARCH_LIMIT)
    .map((u: any) => ({
      id: u.id,
      name: u.full_name ?? '',
      email: null,
      country: countryByUser.get(u.id) ?? null,
      tier: null,
    }));
}
