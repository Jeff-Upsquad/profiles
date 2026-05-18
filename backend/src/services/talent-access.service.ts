import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateGrantInput,
  UpdateGrantInput,
  ExtendGrantInput,
  ListGrantsQuery,
  ProfilesQuery,
  Tier,
} from '../validators/talent-access.validators.js';

const PER_PAGE = 20;
const DEFAULT_GRANT_DURATION_DAYS = 5;
const TOKEN_ROLE = 'talent_access' as const;

interface GrantRow {
  id: string;
  email: string;
  expires_at: string;
  created_by: string;
  revoked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
}

export interface AccessSession {
  grantId: string;
  email: string;
  categoryIds: string[];
}

interface TokenPayload {
  sub: string; // grant id
  email: string;
  role: typeof TOKEN_ROLE;
  cats: string[];
}

// ============================================================
// Helpers
// ============================================================

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function isExpired(grant: GrantRow): boolean {
  return new Date(grant.expires_at).getTime() <= Date.now();
}

function deriveStatus(grant: GrantRow): 'active' | 'expired' | 'revoked' {
  if (grant.revoked_at) return 'revoked';
  if (isExpired(grant)) return 'expired';
  return 'active';
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_GRANT_DURATION_DAYS);
  return d.toISOString();
}

async function fetchGrantCategoryIds(grantId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('talent_access_grant_categories')
    .select('category_id')
    .eq('grant_id', grantId);
  if (error) throw new AppError(500, error.message);
  return (data ?? []).map((r) => r.category_id);
}

async function fetchGrantCategories(grantId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabaseAdmin
    .from('talent_access_grant_categories')
    .select('categories!inner(id, name, slug)')
    .eq('grant_id', grantId);
  if (error) throw new AppError(500, error.message);
  return (data ?? [])
    .map((r: any) => r.categories)
    .filter(Boolean)
    .sort((a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name));
}

async function setGrantCategories(grantId: string, categoryIds: string[]) {
  const { error: delErr } = await supabaseAdmin
    .from('talent_access_grant_categories')
    .delete()
    .eq('grant_id', grantId);
  if (delErr) throw new AppError(500, delErr.message);

  if (categoryIds.length === 0) return;

  const rows = categoryIds.map((category_id) => ({
    grant_id: grantId,
    category_id,
  }));
  const { error: insErr } = await supabaseAdmin
    .from('talent_access_grant_categories')
    .insert(rows);
  if (insErr) throw new AppError(400, insErr.message);
}

async function getGrantOrThrow(grantId: string): Promise<GrantRow> {
  const { data, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('*')
    .eq('id', grantId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Grant not found');
  return data as GrantRow;
}

// ============================================================
// Admin: CRUD
// ============================================================

export async function createGrant(input: CreateGrantInput, adminId: string) {
  const email = normalizeEmail(input.email);
  const expires_at = input.expires_at ?? defaultExpiry();

  // Validate categories exist + are active
  const { data: cats, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .in('id', input.category_ids)
    .eq('is_active', true);
  if (catErr) throw new AppError(500, catErr.message);
  if ((cats ?? []).length !== input.category_ids.length) {
    throw new AppError(400, 'One or more categories are invalid or inactive');
  }

  const { data: grant, error: insErr } = await supabaseAdmin
    .from('talent_access_grants')
    .insert({
      email,
      expires_at,
      created_by: adminId,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (insErr) throw new AppError(400, insErr.message);

  await setGrantCategories(grant.id, input.category_ids);

  return shapeGrantOut(grant as GrantRow, await fetchGrantCategories(grant.id));
}

export async function listGrants(query: ListGrantsQuery) {
  let qb = supabaseAdmin
    .from('talent_access_grants')
    .select('*, talent_access_grant_categories(category_id, categories!inner(id, name, slug))')
    .order('created_at', { ascending: false });

  if (query.search) {
    qb = qb.ilike('email', `%${normalizeEmail(query.search)}%`);
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);

  const nowIso = new Date().toISOString();
  const rows = (data ?? []).map((row: any) => {
    const grant = row as GrantRow;
    const status = deriveStatus(grant);
    const categories: CategoryRow[] = (row.talent_access_grant_categories ?? [])
      .map((j: any) => j.categories)
      .filter(Boolean)
      .sort((a: CategoryRow, b: CategoryRow) => a.name.localeCompare(b.name));
    return { ...shapeGrantOut(grant, categories), status, _now: nowIso };
  });

  if (query.status === 'all') return rows.map(({ _now, ...r }) => r);
  return rows
    .filter((r) => r.status === query.status)
    .map(({ _now, ...r }) => r);
}

export async function getGrant(grantId: string) {
  const grant = await getGrantOrThrow(grantId);
  const categories = await fetchGrantCategories(grantId);
  return shapeGrantOut(grant, categories);
}

export async function updateGrant(grantId: string, input: UpdateGrantInput) {
  const updates: Record<string, unknown> = {};
  if (input.expires_at !== undefined) updates.expires_at = input.expires_at;
  if (input.notes !== undefined) updates.notes = input.notes;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('talent_access_grants')
      .update(updates)
      .eq('id', grantId);
    if (error) throw new AppError(400, error.message);
  }

  if (input.category_ids !== undefined) {
    // Validate first
    const { data: cats, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .in('id', input.category_ids)
      .eq('is_active', true);
    if (catErr) throw new AppError(500, catErr.message);
    if ((cats ?? []).length !== input.category_ids.length) {
      throw new AppError(400, 'One or more categories are invalid or inactive');
    }
    await setGrantCategories(grantId, input.category_ids);
  }

  return getGrant(grantId);
}

export async function revokeGrant(grantId: string) {
  const grant = await getGrantOrThrow(grantId);
  if (grant.revoked_at) {
    return getGrant(grantId);
  }
  const { error } = await supabaseAdmin
    .from('talent_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', grantId);
  if (error) throw new AppError(400, error.message);
  return getGrant(grantId);
}

export async function extendGrant(grantId: string, input: ExtendGrantInput) {
  const grant = await getGrantOrThrow(grantId);
  if (grant.revoked_at) {
    throw new AppError(400, 'Cannot extend a revoked grant');
  }
  const base = isExpired(grant) ? new Date() : new Date(grant.expires_at);
  base.setDate(base.getDate() + input.days);
  const { error } = await supabaseAdmin
    .from('talent_access_grants')
    .update({ expires_at: base.toISOString() })
    .eq('id', grantId);
  if (error) throw new AppError(400, error.message);
  return getGrant(grantId);
}

export async function deleteGrant(grantId: string) {
  const { error } = await supabaseAdmin
    .from('talent_access_grants')
    .delete()
    .eq('id', grantId);
  if (error) throw new AppError(400, error.message);
}

// ============================================================
// SquadHub-originated CRUD (called from /api/integrations/squadhub/...
// webhook handlers). Same data manipulation as the admin paths but with
// no admin user attribution and an extra cross-link column.
// ============================================================

export interface SquadhubGrantInput {
  squadhub_grant_id: string;
  email: string;
  category_ids: string[];
  expires_at: string;
  notes?: string | null;
  created_by_squadhub_user_id?: string | null;
}

export async function createGrantFromSquadhub(input: SquadhubGrantInput) {
  const email = normalizeEmail(input.email);

  // Validate categories exist + are active
  const { data: cats, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id')
    .in('id', input.category_ids)
    .eq('is_active', true);
  if (catErr) throw new AppError(500, catErr.message);
  if ((cats ?? []).length !== input.category_ids.length) {
    throw new AppError(400, 'One or more categories are invalid or inactive');
  }

  // Idempotency: if a row already exists for this squadhub_grant_id, treat
  // the call as an update — SquadHub's webhook may retry on a flaky network.
  const { data: existing } = await supabaseAdmin
    .from('talent_access_grants')
    .select('id')
    .eq('squadhub_grant_id', input.squadhub_grant_id)
    .maybeSingle();
  if (existing?.id) {
    return updateGrantFromSquadhub((existing as any).id as string, {
      ...input,
      squadhub_grant_id: input.squadhub_grant_id,
    });
  }

  const { data: grant, error: insErr } = await supabaseAdmin
    .from('talent_access_grants')
    .insert({
      email,
      expires_at: input.expires_at,
      notes: input.notes ?? null,
      created_by: null,
      squadhub_grant_id: input.squadhub_grant_id,
      created_by_squadhub_user_id: input.created_by_squadhub_user_id ?? null,
    })
    .select()
    .single();
  if (insErr) throw new AppError(400, insErr.message);

  await setGrantCategories(grant.id, input.category_ids);

  return shapeGrantOut(grant as GrantRow, await fetchGrantCategories(grant.id));
}

export interface SquadhubGrantUpdateInput {
  squadhub_grant_id?: string; // unused on update path but accepted for symmetry
  category_ids?: string[];
  expires_at?: string;
  revoked_at?: string | null;
  notes?: string | null;
  created_by_squadhub_user_id?: string | null;
}

export async function updateGrantFromSquadhub(
  profilesGrantId: string,
  input: SquadhubGrantUpdateInput,
) {
  const updates: Record<string, unknown> = {};
  if (input.expires_at !== undefined) updates.expires_at = input.expires_at;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.revoked_at !== undefined) updates.revoked_at = input.revoked_at;
  if (input.created_by_squadhub_user_id !== undefined) {
    updates.created_by_squadhub_user_id = input.created_by_squadhub_user_id;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabaseAdmin
      .from('talent_access_grants')
      .update(updates)
      .eq('id', profilesGrantId);
    if (error) throw new AppError(400, error.message);
  }

  if (input.category_ids !== undefined) {
    const { data: cats, error: catErr } = await supabaseAdmin
      .from('categories')
      .select('id')
      .in('id', input.category_ids)
      .eq('is_active', true);
    if (catErr) throw new AppError(500, catErr.message);
    if ((cats ?? []).length !== input.category_ids.length) {
      throw new AppError(400, 'One or more categories are invalid or inactive');
    }
    await setGrantCategories(profilesGrantId, input.category_ids);
  }

  return getGrant(profilesGrantId);
}

function shapeGrantOut(grant: GrantRow, categories: CategoryRow[]) {
  return {
    id: grant.id,
    email: grant.email,
    expires_at: grant.expires_at,
    revoked_at: grant.revoked_at,
    notes: grant.notes,
    created_by: grant.created_by,
    created_at: grant.created_at,
    updated_at: grant.updated_at,
    categories,
  };
}

// ============================================================
// Public: login + session
// ============================================================

export async function login(emailRaw: string) {
  const email = normalizeEmail(emailRaw);

  // Find the most generous active grant for this email (latest expires_at).
  const { data, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('*')
    .eq('email', email)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const grants = (data ?? []) as GrantRow[];
  if (grants.length === 0) {
    // Generic message — don't leak whether the email exists at all
    throw new AppError(403, 'No active access for this email. Please contact the administrator.');
  }

  // Union categories across all active grants. Token references the most recent
  // grant id but the middleware will re-resolve categories from DB on each call.
  const categoryIdSet = new Set<string>();
  for (const g of grants) {
    const ids = await fetchGrantCategoryIds(g.id);
    ids.forEach((id) => categoryIdSet.add(id));
  }
  const categoryIds = Array.from(categoryIdSet);
  if (categoryIds.length === 0) {
    throw new AppError(403, 'Your access has no categories assigned. Please contact the administrator.');
  }

  const grant = grants[0]!;
  const exp = Math.floor(new Date(grant.expires_at).getTime() / 1000);
  const payload: TokenPayload = {
    sub: grant.id,
    email,
    role: TOKEN_ROLE,
    cats: categoryIds,
  };

  // Cap session lifetime; never longer than the grant
  const maxExp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  const finalExp = Math.min(exp, maxExp);

  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: finalExp - Math.floor(Date.now() / 1000),
  });

  const categories = await categoriesByIds(categoryIds);
  return {
    access_token: token,
    expires_at: new Date(finalExp * 1000).toISOString(),
    email,
    categories,
  };
}

async function categoriesByIds(ids: string[]): Promise<CategoryRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .in('id', ids)
    .eq('is_active', true);
  if (error) throw new AppError(500, error.message);
  return (data ?? []).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Verify a session token and re-check the grant in the DB.
 * Re-reads the grant + categories on every call so revocation, expiry,
 * and category edits take effect immediately.
 */
export async function validateAccessToken(token: string): Promise<AccessSession> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  if (payload.role !== TOKEN_ROLE) {
    throw new AppError(401, 'Invalid token');
  }

  const { data: grant, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('*')
    .eq('id', payload.sub)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!grant) throw new AppError(401, 'Grant not found');

  const grantRow = grant as GrantRow;
  if (grantRow.revoked_at) {
    throw new AppError(403, 'Access has been revoked');
  }
  if (isExpired(grantRow)) {
    throw new AppError(403, 'Access has expired');
  }

  // Resolve categories union across all active grants for this email
  // (so multi-grant users keep access even if `payload.sub` was just one of them).
  const { data: activeGrants } = await supabaseAdmin
    .from('talent_access_grants')
    .select('id')
    .eq('email', grantRow.email)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());

  const categorySet = new Set<string>();
  for (const g of activeGrants ?? []) {
    const ids = await fetchGrantCategoryIds(g.id);
    ids.forEach((id) => categorySet.add(id));
  }
  const categoryIds = Array.from(categorySet);
  if (categoryIds.length === 0) {
    throw new AppError(403, 'Your access has no categories assigned');
  }

  return {
    grantId: grantRow.id,
    email: grantRow.email,
    categoryIds,
  };
}

export async function getSessionInfo(session: AccessSession) {
  // Find the latest expiry across all active grants for this email
  const { data, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('expires_at')
    .eq('email', session.email)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);
  if (error) throw new AppError(500, error.message);
  const expires_at = data?.[0]?.expires_at ?? null;

  const categories = await categoriesByIds(session.categoryIds);
  return {
    email: session.email,
    expires_at,
    categories,
  };
}

// ============================================================
// Email-based session resolver (for business dashboard integration)
// ============================================================

export async function getSessionForEmail(emailRaw: string): Promise<AccessSession | null> {
  const email = normalizeEmail(emailRaw);

  const { data, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('id')
    .eq('email', email)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString());
  if (error) throw new AppError(500, error.message);

  const grants = (data ?? []) as { id: string }[];
  if (grants.length === 0) return null;

  const categorySet = new Set<string>();
  for (const g of grants) {
    const ids = await fetchGrantCategoryIds(g.id);
    ids.forEach((id) => categorySet.add(id));
  }
  const categoryIds = Array.from(categorySet);
  if (categoryIds.length === 0) return null;

  return { grantId: grants[0]!.id, email, categoryIds };
}

export async function getExpiryForEmail(emailRaw: string): Promise<string | null> {
  const email = normalizeEmail(emailRaw);
  const { data, error } = await supabaseAdmin
    .from('talent_access_grants')
    .select('expires_at')
    .eq('email', email)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1);
  if (error) throw new AppError(500, error.message);
  return data?.[0]?.expires_at ?? null;
}

// ============================================================
// Public: profile browse + detail
// ============================================================

function assertCategoryAuthorized(session: AccessSession, categoryId: string) {
  if (!session.categoryIds.includes(categoryId)) {
    throw new AppError(403, 'You do not have access to this category');
  }
}

function extractTopSkills(fieldData: any, limit = 3): string[] {
  const skills = fieldData?._skills;
  if (!Array.isArray(skills)) return [];
  return skills
    .map((s: any) => (typeof s === 'string' ? s : s?.skill))
    .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
    .slice(0, limit);
}

export async function listProfiles(session: AccessSession, query: ProfilesQuery) {
  assertCategoryAuthorized(session, query.category_id);
  const page = query.page ?? 1;

  // 1. If tier filter is set, narrow to allowed talent_profile_ids first.
  //    Multi-tier support: profile is allowed if its tier ∈ selected tiers.
  let allowedIds: string[] | null = null;
  if (query.tier && query.tier.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('v_talent_profile_tier')
      .select('talent_profile_id')
      .eq('category_id', query.category_id)
      .in('tier', query.tier);
    if (error) throw new AppError(500, error.message);
    allowedIds = (data ?? []).map((r: any) => r.talent_profile_id);
    if (allowedIds.length === 0) {
      return { profiles: [], page, per_page: PER_PAGE, total: 0 };
    }
  }

  // 1b. Country/state/district filters live on talent_profiles_basic (one row
  //     per talent_user). Pre-filter to a set of matching talent_user_ids and
  //     intersect that into the main query. Skip the round-trip when no
  //     structured-location filters are active.
  let allowedTalentUserIds: string[] | null = null;
  const hasStructuredLocation =
    (query.country && query.country.length > 0) ||
    (query.state && query.state.length > 0) ||
    (query.district && query.district.length > 0);
  if (hasStructuredLocation) {
    let bq = supabaseAdmin.from('talent_profiles_basic').select('talent_user_id');
    if (query.country && query.country.length > 0) bq = bq.in('country', query.country);
    if (query.state && query.state.length > 0) bq = bq.in('state', query.state);
    if (query.district && query.district.length > 0) bq = bq.in('current_district', query.district);
    const { data: basicRows, error: basicErr } = await bq;
    if (basicErr) throw new AppError(500, basicErr.message);
    allowedTalentUserIds = (basicRows ?? []).map((r: any) => r.talent_user_id as string);
    if (allowedTalentUserIds.length === 0) {
      return { profiles: [], page, per_page: PER_PAGE, total: 0 };
    }
  }

  // 2. Base query
  let qb = supabaseAdmin
    .from('talent_profiles')
    .select(
      `id, field_data, created_at, talent_user_id,
       talent_users!inner(full_name, profile_photo_url, current_location, languages_spoken, age, gender),
       categories!inner(id, name, slug)`,
    )
    .eq('category_id', query.category_id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null);

  if (allowedIds) qb = qb.in('id', allowedIds);
  if (allowedTalentUserIds) qb = qb.in('talent_user_id', allowedTalentUserIds);
  if (query.location && query.location.length > 0) {
    qb = qb.in('talent_users.current_location', query.location);
  }
  if (query.search) {
    qb = qb.ilike('talent_users.full_name', `%${query.search}%`);
  }

  qb = qb.order('created_at', { ascending: false });

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);

  let profiles = (data ?? []) as any[];

  // 3. JS-side filters for nested JSONB fields. Multi-value filters use OR
  //    semantics (a profile matches if it has ANY of the selected values).
  if (query.language && query.language.length > 0) {
    const wanted = new Set(query.language.map((l) => l.toLowerCase()));
    profiles = profiles.filter((p) =>
      Array.isArray(p.talent_users?.languages_spoken) &&
      p.talent_users.languages_spoken.some(
        (l: any) => wanted.has(String(l?.language ?? '').toLowerCase()),
      ),
    );
  }
  if (query.skill && query.skill.length > 0) {
    const wanted = new Set(query.skill.map((s) => s.toLowerCase()));
    profiles = profiles.filter((p) => {
      const skills = p.field_data?._skills;
      if (!Array.isArray(skills)) return false;
      return skills.some((s: any) => {
        const name = typeof s === 'string' ? s : s?.skill;
        return typeof name === 'string' && wanted.has(name.toLowerCase());
      });
    });
  }
  if (query.ai_tool && query.ai_tool.length > 0) {
    const wanted = new Set(query.ai_tool.map((t) => t.toLowerCase()));
    profiles = profiles.filter((p) => {
      const tools = p.field_data?._ai_tools;
      return Array.isArray(tools) && tools.some(
        (t: any) => typeof t === 'string' && wanted.has(t.toLowerCase()),
      );
    });
  }

  // 4. Tier resolution for display (includes tier_custom for the 'custom' type)
  const tierMap = new Map<string, { tier: Tier | null; tier_custom: string | null }>();
  if (profiles.length > 0) {
    const { data: tiers, error: tErr } = await supabaseAdmin
      .from('v_talent_profile_tier')
      .select('talent_profile_id, tier, tier_custom')
      .in(
        'talent_profile_id',
        profiles.map((p) => p.id),
      );
    if (tErr) throw new AppError(500, tErr.message);
    for (const t of tiers ?? []) {
      tierMap.set((t as any).talent_profile_id, {
        tier: ((t as any).tier as Tier | null) ?? null,
        tier_custom: ((t as any).tier_custom as string | null) ?? null,
      });
    }
  }

  // 5. Paginate
  const total = profiles.length;
  const start = (page - 1) * PER_PAGE;
  const paged = profiles.slice(start, start + PER_PAGE);

  return {
    profiles: paged.map((p) => {
      const t = tierMap.get(p.id);
      const yearsRaw = p.field_data?.years_experience;
      const years_experience =
        yearsRaw == null || yearsRaw === '' ? null : Number(yearsRaw);
      return {
        id: p.id,
        full_name: p.talent_users?.full_name ?? '',
        profile_photo_url: p.talent_users?.profile_photo_url ?? null,
        current_location: p.talent_users?.current_location ?? null,
        languages_spoken: p.talent_users?.languages_spoken ?? [],
        age: p.talent_users?.age ?? null,
        gender: p.talent_users?.gender ?? null,
        years_experience: Number.isFinite(years_experience) ? years_experience : null,
        tier: t?.tier ?? null,
        tier_custom: t?.tier_custom ?? null,
        top_skills: extractTopSkills(p.field_data),
        category: p.categories,
      };
    }),
    page,
    per_page: PER_PAGE,
    total,
  };
}

export async function getProfile(session: AccessSession, profileId: string) {
  // Fetch the profile + talent_user + category schema + portfolio in parallel
  const profileQ = supabaseAdmin
    .from('talent_profiles')
    .select(
      `id, category_id, field_data, status, created_at, updated_at, resume_url,
       is_ghost, source_designer_profile_id, source_editor_profile_id, talent_user_id,
       talent_users!inner(id, full_name, current_location, native_place, profile_photo_url, languages_spoken, age, gender),
       categories!inner(id, name, slug)`,
    )
    .eq('id', profileId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  const portfolioQ = supabaseAdmin
    .from('portfolio_items')
    .select('*, portfolio_item_skills(skill_name)')
    .eq('profile_id', profileId)
    .order('category_name', { ascending: true })
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  const [profileRes, portfolioRes] = await Promise.all([profileQ, portfolioQ]);

  if (profileRes.error) throw new AppError(500, profileRes.error.message);
  const profile = profileRes.data as any;
  if (!profile) throw new AppError(404, 'Profile not found');

  // Structured location lives on talent_profiles_basic (one row per talent_user).
  const basicRes = profile.talent_users?.id
    ? await supabaseAdmin
        .from('talent_profiles_basic')
        .select('country, state, current_district, city, pin_code, permanent_address, current_address')
        .eq('talent_user_id', profile.talent_users.id)
        .maybeSingle()
    : null;

  // Authorization: profile's category must be in the session
  assertCategoryAuthorized(session, profile.category_id);

  // Fetch the category schema separately so we get the same shape the talent
  // profile detail UI expects (CategoryWithFields).
  const { data: catSchema, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('*, category_fields!category_id(*, field_options(*))')
    .eq('id', profile.category_id)
    .eq('is_active', true)
    .maybeSingle();
  if (catErr) throw new AppError(500, catErr.message);
  if (!catSchema) throw new AppError(404, 'Category not found');

  const category: any = catSchema;
  // Normalise to the shape the frontend `CategoryWithFields` type expects:
  // `fields: CategoryField[]` with `options` (not `field_options`).
  const rawFields = category.category_fields ?? [];
  delete category.category_fields;
  category.fields = rawFields
    .filter((f: any) => f.is_active)
    .map((f: any) => ({
      ...f,
      options: (f.field_options ?? []).filter((o: any) => o.is_active),
    }));

  // Resolve tier
  const { data: tierRow } = await supabaseAdmin
    .from('v_talent_profile_tier')
    .select('tier, tier_custom')
    .eq('talent_profile_id', profileId)
    .maybeSingle();

  const basic = (basicRes?.data as any) ?? null;

  const talentUser = {
    ...profile.talent_users,
    country: basic?.country ?? null,
    state: basic?.state ?? null,
    current_district: basic?.current_district ?? null,
    city: basic?.city ?? null,
    pin_code: basic?.pin_code ?? null,
    permanent_address: basic?.permanent_address ?? null,
  };

  if (profile.is_ghost === true) {
    const designerId = profile.source_designer_profile_id as string | null;
    const editorId = profile.source_editor_profile_id as string | null;
    const ids = [designerId, editorId].filter((v): v is string => !!v);

    let sourceProfiles: any[] = [];
    if (ids.length > 0) {
      const [{ data: sources, error: srcErr }, { data: portfolio, error: pfErr }] =
        await Promise.all([
          supabaseAdmin
            .from('talent_profiles')
            .select('*, categories!inner(id, name, slug)')
            .in('id', ids)
            .is('deleted_at', null),
          supabaseAdmin
            .from('portfolio_items')
            .select('*, portfolio_item_skills(skill_name)')
            .in('profile_id', ids)
            .order('category_name', { ascending: true })
            .order('skill_name', { ascending: true })
            .order('sort_order', { ascending: true }),
        ]);
      if (srcErr) throw new AppError(500, 'Failed to load ghost source profiles');
      if (pfErr) throw new AppError(500, 'Failed to load ghost source portfolio');

      const portfolioByProfile: Record<string, any[]> = {};
      for (const row of (portfolio ?? []) as any[]) {
        const { portfolio_item_skills, ...rest } = row;
        const item = {
          ...rest,
          skills: Array.isArray(portfolio_item_skills)
            ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
            : [],
        };
        const pid = rest.profile_id as string;
        if (!portfolioByProfile[pid]) portfolioByProfile[pid] = [];
        portfolioByProfile[pid].push(item);
      }

      sourceProfiles = (sources ?? []).map((s: any) => ({
        id: s.id,
        category_id: s.category_id,
        category: s.categories,
        status: s.status,
        field_data: s.field_data,
        created_at: s.created_at,
        updated_at: s.updated_at,
        portfolio_items: portfolioByProfile[s.id] ?? [],
      }));
      sourceProfiles.sort((a, b) =>
        a.category?.slug === 'designer' ? -1 : b.category?.slug === 'designer' ? 1 : 0,
      );
    }

    return {
      profile: {
        id: profile.id,
        category_id: profile.category_id,
        status: profile.status,
        field_data: profile.field_data,
        resume_url: profile.resume_url,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
      },
      talent_user: talentUser,
      category,
      portfolio_items: [],
      tier: (tierRow as any)?.tier ?? null,
      tier_custom: (tierRow as any)?.tier_custom ?? null,
      is_ghost: true,
      source_profiles: sourceProfiles,
    };
  }

  return {
    profile: {
      id: profile.id,
      category_id: profile.category_id,
      status: profile.status,
      field_data: profile.field_data,
      resume_url: profile.resume_url,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    },
    talent_user: talentUser,
    category,
    portfolio_items: (portfolioRes.data ?? []).map((row: any) => {
      const { portfolio_item_skills, ...rest } = row;
      return {
        ...rest,
        skills: Array.isArray(portfolio_item_skills)
          ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
          : [],
      };
    }),
    tier: (tierRow as any)?.tier ?? null,
    tier_custom: (tierRow as any)?.tier_custom ?? null,
  };
}

export async function getFilterOptions(session: AccessSession, categoryId: string) {
  assertCategoryAuthorized(session, categoryId);

  // Skills + AI tools come from the per-category template tables (intended source for filter chips)
  const [skillsRes, toolsRes, aiToolsRes, profilesRes] = await Promise.all([
    supabaseAdmin
      .from('template_skill_sets')
      .select('name')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('template_tools')
      .select('name')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('template_ai_tools')
      .select('name')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('talent_profiles')
      .select(
        'talent_user_id, talent_users!inner(current_location, languages_spoken)',
      )
      .eq('category_id', categoryId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .eq('talent_users.is_active', true)
      .is('deleted_at', null),
  ]);

  if (skillsRes.error) throw new AppError(500, skillsRes.error.message);
  if (toolsRes.error) throw new AppError(500, toolsRes.error.message);
  if (aiToolsRes.error) throw new AppError(500, aiToolsRes.error.message);
  if (profilesRes.error) throw new AppError(500, profilesRes.error.message);

  const locations = new Set<string>();
  const languages = new Set<string>();
  const talentUserIds: string[] = [];
  for (const row of profilesRes.data ?? []) {
    const tu = (row as any).talent_users;
    if (tu?.current_location) locations.add(tu.current_location.trim());
    if (Array.isArray(tu?.languages_spoken)) {
      for (const l of tu.languages_spoken) {
        if (l?.language) languages.add(String(l.language).trim());
      }
    }
    const tid = (row as any).talent_user_id as string | undefined;
    if (tid) talentUserIds.push(tid);
  }

  // Structured location facets (country/state/district) come from
  // talent_profiles_basic — one row per talent_user. We restrict the lookup
  // to the talent_users that actually have a profile in this category so the
  // filter dropdowns don't list locations from talents the business can't see.
  const countries = new Set<string>();
  const states = new Set<string>();
  const districts = new Set<string>();
  if (talentUserIds.length > 0) {
    const { data: basicRows, error: basicErr } = await supabaseAdmin
      .from('talent_profiles_basic')
      .select('country, state, current_district')
      .in('talent_user_id', talentUserIds);
    if (basicErr) throw new AppError(500, basicErr.message);
    for (const row of basicRows ?? []) {
      const r = row as any;
      if (r.country) countries.add(String(r.country).trim());
      if (r.state) states.add(String(r.state).trim());
      if (r.current_district) districts.add(String(r.current_district).trim());
    }
  }

  return {
    tiers: ['junior', 'pro', 'elite', 'Top Talents', 'custom'] as Tier[],
    locations: Array.from(locations).filter(Boolean).sort(),
    countries: Array.from(countries).filter(Boolean).sort(),
    states: Array.from(states).filter(Boolean).sort(),
    districts: Array.from(districts).filter(Boolean).sort(),
    languages: Array.from(languages).filter(Boolean).sort(),
    skills: (skillsRes.data ?? []).map((r: any) => r.name as string),
    tools: (toolsRes.data ?? []).map((r: any) => r.name as string),
    ai_tools: (aiToolsRes.data ?? []).map((r: any) => r.name as string),
  };
}
