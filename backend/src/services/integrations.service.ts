import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
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

  const [
    { data: basics },
    { data: authRows, error: authErr },
  ] = await Promise.all([
    supabaseAdmin
      .from('talent_profiles_basic')
      .select('talent_user_id, country')
      .in('talent_user_id', ids),
    // Reuses the SECURITY DEFINER RPC added in 00068_get_auth_users_by_ids.
    // Same pattern as listRecipientsByExternalId — we need real emails so
    // SquadHub can persist them on /assign-talent for the auto-accept flow.
    supabaseAdmin.rpc('get_auth_users_by_ids', { id_list: ids }),
  ]);
  if (authErr) {
    // Email is best-effort. Logging keeps observability without breaking
    // the picker if the RPC ever errors.
    console.error('[searchActiveTalents] auth users lookup failed:', authErr.message);
  }
  const countryByUser = new Map<string, string | null>();
  for (const b of basics ?? []) {
    countryByUser.set((b as any).talent_user_id, ((b as any).country as string | null) ?? null);
  }
  const emailByUser = new Map<string, string>();
  for (const r of (authRows ?? []) as { id: string; email: string }[]) {
    if (r.id && r.email) emailByUser.set(r.id, r.email);
  }

  return users
    .filter((u: any) => approvedSet.has(u.id))
    .slice(0, TALENT_SEARCH_LIMIT)
    .map((u: any) => ({
      id: u.id,
      name: u.full_name ?? '',
      email: emailByUser.get(u.id) ?? null,
      country: countryByUser.get(u.id) ?? null,
      tier: null,
    }));
}

// ── Email-based user lookup (for SquadHub partner↔talent linking) ──

export interface TalentLookupResult {
  email: string;
  talent_user_id: string;
  name: string;
}

const LOOKUP_BATCH_LIMIT = 50;

export async function lookupUsersByEmail(
  emails: string[],
): Promise<TalentLookupResult[]> {
  if (emails.length === 0) return [];

  const batch = emails.slice(0, LOOKUP_BATCH_LIMIT);
  const lower = batch.map((e) => e.toLowerCase().trim());

  const { data: authRows, error: authErr } = await supabaseAdmin
    .rpc('get_auth_users_by_emails', { email_list: lower });
  if (authErr) throw new AppError(500, authErr.message);
  if (!authRows || authRows.length === 0) return [];

  const authMap = new Map<string, string>();
  for (const row of authRows as any[]) {
    authMap.set(row.id, row.email);
  }
  const userIds = [...authMap.keys()];

  const { data: talentRows, error: tuErr } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .in('id', userIds);
  if (tuErr) throw new AppError(500, tuErr.message);
  if (!talentRows || talentRows.length === 0) return [];

  const talentIds = talentRows.map((t: any) => t.id as string);

  const { data: approvedRows, error: profErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .in('talent_user_id', talentIds)
    .eq('status', 'approved')
    .eq('is_active', true)
    .is('deleted_at', null);
  if (profErr) throw new AppError(500, profErr.message);

  const approvedSet = new Set(
    (approvedRows ?? []).map((r: any) => r.talent_user_id as string),
  );

  return (talentRows as any[])
    .filter((t) => approvedSet.has(t.id))
    .map((t) => ({
      email: authMap.get(t.id)!,
      talent_user_id: t.id,
      name: t.full_name ?? '',
    }));
}

// ── Phone-based talent lookup (for SquadHire CRM admin deep-link) ──

export interface TalentByPhoneResult {
  // 'talent' = matched a talent_users row directly (or via a lead_submission's
  // linked_talent_user_id). 'candidate' = no talent_user matched but a
  // lead_submission did, so the CRM links to the Candidate admin page instead.
  kind: 'talent' | 'candidate';
  // talent_users.id when kind = 'talent'; lead_submissions.id when 'candidate'.
  talent_user_id: string;
  name: string;
  // For 'talent': 'approved' | 'pending' | 'rejected' | 'draft' | 'no_profile'
  // For 'candidate': lead_submissions.status ('new' | 'contacted' | 'converted' | 'rejected')
  profile_status: string;
  // Absolute URL into the SquadHire admin. null when SQUADHIRE_ADMIN_URL is
  // not configured — the CRM treats null and a 404 the same.
  admin_url: string | null;
}

/**
 * Look up a talent (or candidate) by phone (E.164). Matches on the last 10
 * digits, the same strategy as migration 00034_link_leads_to_talent_users so
 * the CRM and the admin link-leads RPC stay in lock-step.
 *
 * Resolution order:
 *   1. talent_users by last-10 phone — return as kind = 'talent'.
 *   2. Fall back to lead_submissions by last-10 phone:
 *      - if linked_talent_user_id is set, resolve as kind = 'talent' against
 *        that user (handles the case where the talent's stored phone is
 *        typo'd but the lead_submission has the correct number).
 *      - otherwise return as kind = 'candidate' with /leads/{id} admin URL.
 *   3. Return null only when nothing matches in either table.
 */
export async function lookupTalentByPhone(
  phoneE164: string,
): Promise<TalentByPhoneResult | null> {
  const last10 = phoneE164.replace(/\D/g, '').slice(-10);
  if (last10.length !== 10) return null;

  const talentResult = await resolveTalentByLast10(last10);
  if (talentResult) return talentResult;

  return resolveCandidateByLast10(last10);
}

async function resolveTalentByLast10(
  last10: string,
): Promise<TalentByPhoneResult | null> {
  // talent_users.phone is free-text TEXT (not E.164 normalized). Pre-filter
  // with .ilike on a suffix pattern, then exact-match the last-10 digits in
  // JS. Cheap, no extra index required.
  const { data: candidates, error: usersErr } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone, updated_at')
    .ilike('phone', `%${last10}`)
    .order('updated_at', { ascending: false })
    .limit(20);
  if (usersErr) throw new AppError(500, usersErr.message);

  const matches = (candidates ?? []).filter((u: any) => {
    const phoneDigits = String(u.phone ?? '').replace(/\D/g, '');
    return phoneDigits.slice(-10) === last10;
  });
  if (matches.length === 0) return null;

  return rankAndBuildTalentResult(matches);
}

async function resolveTalentById(
  talentUserId: string,
): Promise<TalentByPhoneResult | null> {
  const { data: user, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone, updated_at')
    .eq('id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!user) return null;
  return rankAndBuildTalentResult([user]);
}

async function rankAndBuildTalentResult(
  matches: any[],
): Promise<TalentByPhoneResult> {
  const userIds = matches.map((u: any) => u.id as string);

  // Fetch each candidate's primary talent_profile, ranked: approved+active
  // wins, then most recently updated. We only need category_id + status of
  // the winner per user.
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id, id, category_id, status, is_active, deleted_at, updated_at')
    .in('talent_user_id', userIds)
    .is('deleted_at', null);
  if (profilesErr) throw new AppError(500, profilesErr.message);

  const profilesByUser = new Map<
    string,
    { id: string; category_id: string; status: string; updated_at: string; is_active: boolean }[]
  >();
  for (const p of (profiles ?? []) as any[]) {
    const list = profilesByUser.get(p.talent_user_id) ?? [];
    list.push({
      id: p.id,
      category_id: p.category_id,
      status: p.status,
      updated_at: p.updated_at,
      is_active: p.is_active,
    });
    profilesByUser.set(p.talent_user_id, list);
  }

  // Score each candidate user: prefer the one with an approved+active profile,
  // breaking ties by talent_users.updated_at desc.
  const ranked = matches
    .map((u: any) => {
      const userProfiles = profilesByUser.get(u.id) ?? [];
      const sorted = userProfiles.slice().sort((a, b) => {
        const aScore = (a.status === 'approved' && a.is_active ? 2 : 0) + (a.is_active ? 1 : 0);
        const bScore = (b.status === 'approved' && b.is_active ? 2 : 0) + (b.is_active ? 1 : 0);
        if (aScore !== bScore) return bScore - aScore;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      const top = sorted[0];
      const rank =
        top && top.status === 'approved' && top.is_active
          ? 3
          : top && top.is_active
            ? 2
            : top
              ? 1
              : 0;
      return { user: u, top, rank };
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return b.rank - a.rank;
      return new Date(b.user.updated_at).getTime() - new Date(a.user.updated_at).getTime();
    });

  const winner = ranked[0];
  const adminBase = (env.SQUADHIRE_ADMIN_URL || '').replace(/\/$/, '');
  let adminUrl: string | null = null;
  if (adminBase) {
    if (winner.top) {
      adminUrl = `${adminBase}/admin/talents/${winner.top.category_id}/${winner.top.id}`;
    } else {
      adminUrl = `${adminBase}/admin/users/${winner.user.id}`;
    }
  }

  return {
    kind: 'talent',
    talent_user_id: winner.user.id,
    name: (winner.user.full_name as string | null) ?? '',
    profile_status: winner.top?.status ?? 'no_profile',
    admin_url: adminUrl,
  };
}

async function resolveCandidateByLast10(
  last10: string,
): Promise<TalentByPhoneResult | null> {
  // Same pre-filter + JS exact-match pattern as resolveTalentByLast10. Take
  // the most recent non-deleted lead_submission — matches findLeadId in
  // squadcrm-webhook.controller.ts.
  const { data: rows, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, name, status, phone, linked_talent_user_id, created_at')
    .ilike('phone', `%${last10}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new AppError(500, error.message);

  const match = (rows ?? []).find((r: any) => {
    const phoneDigits = String(r.phone ?? '').replace(/\D/g, '');
    return phoneDigits.slice(-10) === last10;
  });
  if (!match) return null;

  // If the candidate is already linked to a talent_user, prefer the talent
  // deep-link — this covers the data-drift case where the talent_user's
  // stored phone is typo'd but the original lead_submission still has the
  // correct number.
  if (match.linked_talent_user_id) {
    const linked = await resolveTalentById(match.linked_talent_user_id as string);
    if (linked) return linked;
  }

  const adminBase = (env.SQUADHIRE_ADMIN_URL || '').replace(/\/$/, '');
  const adminUrl = adminBase ? `${adminBase}/leads/${match.id}` : null;

  return {
    kind: 'candidate',
    talent_user_id: match.id as string,
    name: (match.name as string | null) ?? '',
    profile_status: (match.status as string | null) ?? 'new',
    admin_url: adminUrl,
  };
}
