import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateBusinessUserInput, DiscoverQueryInput, SendInterestInput } from '../validators/business.validators.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';
import { adminSelectRecipient } from './subscription.service.js';

// ─── Business User ──────────────────────────────────────────────────────────

export async function getBusinessUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new AppError(404, 'Business user not found');
  return data;
}

export async function updateBusinessUser(userId: string, input: UpdateBusinessUserInput) {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .update(input)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

// ─── Subscribed Categories & Shared Profiles ────────────────────────────────

export async function getSubscribedCategories(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_category_subscriptions')
    .select('category_id, categories(id, name, slug, description, icon_url)')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return (data ?? []).map((s: any) => s.categories);
}

export async function getSharedProfiles(businessUserId: string, categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('talent_profile_id, talent_profiles!inner(*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  const rows = (data ?? [])
    .map((sp: any) => sp.talent_profiles)
    .filter((p: any) => p);

  const tiers = await getTalentTiersByUserIds(
    rows.map((p: any) => p.talent_user_id).filter(Boolean),
  );

  return rows.map((p: any) => ({
    id: p.id,
    user_id: p.talent_user_id,
    category_id: p.category_id,
    category: p.categories,
    status: p.status,
    field_data: p.field_data,
    talent_user: p.talent_users,
    created_at: p.created_at,
    updated_at: p.updated_at,
    tier: tiers[p.talent_user_id]?.tier ?? null,
    tier_custom: tiers[p.talent_user_id]?.tier_custom ?? null,
  }));
}

/**
 * Returns true if the talent has accepted any subscription card belonging
 * to this business in the given category. Used as a fallback authorization
 * path for `getSharedProfile` when the row in `business_shared_profiles`
 * is missing — e.g. cards that linked to the business after acceptance.
 */
async function isProfileVisibleViaSubscriptionCard(
  businessUserId: string,
  categoryId: string,
  profileId: string,
): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .eq('id', profileId)
    .eq('category_id', categoryId)
    .maybeSingle();
  if (!profile) return false;
  const talentUserId = (profile as any).talent_user_id as string;

  // 1. List card_ids this talent has accepted (uncancelled).
  const { data: recipients } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('card_id')
    .eq('talent_user_id', talentUserId)
    .eq('status', 'accepted')
    .is('cancelled_at', null);

  const cardIds = (recipients ?? []).map((r: any) => r.card_id as string);
  if (cardIds.length === 0) return false;

  // 2. Filter those cards down to ones that belong to this business AND
  // include the requested category in match_rules.
  const { data: cards } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, match_rules')
    .in('id', cardIds)
    .eq('business_user_id', businessUserId);

  for (const card of cards ?? []) {
    const ids = pickCategoryIds((card as any).match_rules);
    if (ids.includes(categoryId)) return true;
  }
  return false;
}

export async function getSharedProfile(businessUserId: string, categoryId: string, profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('talent_profile_id, talent_profiles!inner(*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .maybeSingle();

  // Fallback: business may have access via an accepted subscription card
  // recipient row that never wrote into business_shared_profiles.
  if (!data) {
    const allowed = await isProfileVisibleViaSubscriptionCard(businessUserId, categoryId, profileId);
    if (!allowed) throw new AppError(404, 'Shared profile not found');

    const { data: fallback, error: fbErr } = await supabaseAdmin
      .from('talent_profiles')
      .select('*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender), categories(id, name, slug)')
      .eq('id', profileId)
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .eq('talent_users.is_active', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (fbErr || !fallback) throw new AppError(404, 'Profile not found');

    const p = fallback as any;
    const tiers = await getTalentTiersByUserIds([p.talent_user_id]);
    return {
      id: p.id,
      user_id: p.talent_user_id,
      category_id: p.category_id,
      category: p.categories,
      status: p.status,
      field_data: p.field_data,
      talent_user: p.talent_users,
      created_at: p.created_at,
      updated_at: p.updated_at,
      is_ghost: p.is_ghost === true,
      tier: tiers[p.talent_user_id]?.tier ?? null,
      tier_custom: tiers[p.talent_user_id]?.tier_custom ?? null,
    };
  }

  if (error) throw new AppError(500, (error as { message: string }).message);

  const p = (data as any).talent_profiles;
  if (!p) throw new AppError(404, 'Profile not found');

  const tiers = await getTalentTiersByUserIds([p.talent_user_id]);
  const baseProfile = {
    id: p.id,
    user_id: p.talent_user_id,
    category_id: p.category_id,
    category: p.categories,
    status: p.status,
    field_data: p.field_data,
    talent_user: p.talent_users,
    created_at: p.created_at,
    updated_at: p.updated_at,
    is_ghost: p.is_ghost === true,
    tier: tiers[p.talent_user_id]?.tier ?? null,
    tier_custom: tiers[p.talent_user_id]?.tier_custom ?? null,
  };

  if (baseProfile.is_ghost) {
    const designerId = p.source_designer_profile_id as string | null;
    const editorId = p.source_editor_profile_id as string | null;
    const ids = [designerId, editorId].filter((v): v is string => !!v);
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
            .eq('admin_is_active', true)
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

      const sourceProfiles = (sources ?? []).map((s: any) => ({
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
      return { ...baseProfile, source_profiles: sourceProfiles };
    }
  }

  return baseProfile;
}

export async function getPortfolioForProfile(businessUserId: string, categoryId: string, profileId: string) {
  // Verify the profile is shared with this business user
  const { data: shared } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('id')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .maybeSingle();

  if (!shared) {
    // Fallback: subscription card recipient acceptance grants access
    const allowed = await isProfileVisibleViaSubscriptionCard(businessUserId, categoryId, profileId);
    if (!allowed) throw new AppError(404, 'Profile not shared with you');
  }

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('*, portfolio_item_skills(skill_name)')
    .eq('profile_id', profileId)
    .eq('admin_is_active', true)
    .order('category_name', { ascending: true })
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch portfolio items');
  return (data ?? []).map((row: any) => {
    const { portfolio_item_skills, ...rest } = row;
    return {
      ...rest,
      skills: Array.isArray(portfolio_item_skills)
        ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
        : [],
    };
  });
}

// ─── Discover Profiles ──────────────────────────────────────────────────────

export async function discoverProfiles(categorySlug: string, query: DiscoverQueryInput) {
  // Get category by slug
  const { data: category, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug')
    .eq('slug', categorySlug)
    .eq('is_active', true)
    .single();

  if (catErr || !category) throw new AppError(404, 'Category not found');

  const offset = (query.page - 1) * query.per_page;

  let qb = supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url), categories!inner(id, name, slug)', { count: 'exact' })
    .eq('category_id', category.id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null);

  // Search
  if (query.search) {
    qb = qb.or(
      `field_data.cs.{"${query.search}"},talent_users.full_name.ilike.%${query.search}%`
    );
  }

  // District filter
  if (query.district) {
    qb = qb.ilike('talent_users.current_location', `%${query.district}%`);
  }

  // Salary range filters (using JSONB)
  if (query.min_salary !== undefined) {
    qb = qb.gte('field_data->>expected_salary', String(query.min_salary));
  }
  if (query.max_salary !== undefined) {
    qb = qb.lte('field_data->>expected_salary', String(query.max_salary));
  }

  // Experience filters
  if (query.min_experience !== undefined) {
    qb = qb.gte('field_data->>years_experience', String(query.min_experience));
  }
  if (query.max_experience !== undefined) {
    qb = qb.lte('field_data->>years_experience', String(query.max_experience));
  }

  // Sorting
  switch (query.sort_by) {
    case 'newest':
      qb = qb.order('created_at', { ascending: false });
      break;
    case 'experience_high':
      qb = qb.order('created_at', { ascending: false }); // fallback; JSONB ordering would need raw SQL
      break;
    case 'experience_low':
      qb = qb.order('created_at', { ascending: true });
      break;
    case 'salary_low':
      qb = qb.order('created_at', { ascending: true });
      break;
    case 'salary_high':
      qb = qb.order('created_at', { ascending: false });
      break;
    default:
      qb = qb.order('created_at', { ascending: false });
  }

  qb = qb.range(offset, offset + query.per_page - 1);

  const { data: profiles, error, count } = await qb;

  if (error) throw new AppError(500, error.message);

  const rows = (profiles ?? []) as any[];
  const tiers = await getTalentTiersByUserIds(
    rows.map((p) => p.talent_user_id).filter(Boolean),
  );

  // Reshape to nest talent_user
  const shaped = rows.map((p: any) => ({
    id: p.id,
    user_id: p.talent_user_id,
    category_id: p.category_id,
    category: p.categories,
    status: p.status,
    field_data: p.field_data,
    talent_user: p.talent_users,
    created_at: p.created_at,
    updated_at: p.updated_at,
    tier: tiers[p.talent_user_id]?.tier ?? null,
    tier_custom: tiers[p.talent_user_id]?.tier_custom ?? null,
  }));

  return {
    profiles: shaped,
    total: count ?? 0,
    page: query.page,
    per_page: query.per_page,
  };
}

export async function getApprovedProfile(categorySlug: string, profileId: string) {
  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', categorySlug)
    .eq('is_active', true)
    .single();

  if (!category) throw new AppError(404, 'Category not found');

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender), categories!inner(id, name, slug)')
    .eq('id', profileId)
    .eq('category_id', category.id)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');

  const tiers = await getTalentTiersByUserIds([(data as any).talent_user_id]);

  const baseProfile = {
    id: data.id,
    user_id: (data as any).talent_user_id,
    category_id: data.category_id,
    category: (data as any).categories,
    status: data.status,
    field_data: data.field_data,
    talent_user: (data as any).talent_users,
    created_at: data.created_at,
    updated_at: data.updated_at,
    is_ghost: (data as any).is_ghost === true,
    tier: tiers[(data as any).talent_user_id]?.tier ?? null,
    tier_custom: tiers[(data as any).talent_user_id]?.tier_custom ?? null,
  };

  // Ghost rows are pointers — load the two source profiles' full data
  // (and portfolio items) so the public/business view can render both
  // in a single payload. Source profiles are looked up by ID; we don't
  // gate on status here (the ghost row itself is already approved-gated
  // above, which means both sources were approved when the ghost was
  // synced).
  if (baseProfile.is_ghost) {
    const designerId = (data as any).source_designer_profile_id as string | null;
    const editorId = (data as any).source_editor_profile_id as string | null;
    const ids = [designerId, editorId].filter((v): v is string => !!v);
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
            .eq('admin_is_active', true)
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

      const sourceProfiles = (sources ?? []).map((p: any) => ({
        id: p.id,
        category_id: p.category_id,
        category: p.categories,
        status: p.status,
        field_data: p.field_data,
        created_at: p.created_at,
        updated_at: p.updated_at,
        portfolio_items: portfolioByProfile[p.id] ?? [],
      }));
      // Order: Designer first, then Video Editor (matches the category name).
      sourceProfiles.sort((a, b) =>
        a.category?.slug === 'designer' ? -1 : b.category?.slug === 'designer' ? 1 : 0,
      );
      return { ...baseProfile, source_profiles: sourceProfiles };
    }
  }

  return baseProfile;
}

// ─── Shortlist ──────────────────────────────────────────────────────────────

export async function getShortlist(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('shortlists')
    .select('*, talent_profiles!inner(*, talent_users!inner(full_name, current_location), categories!inner(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  const rows = (data ?? []) as any[];
  const tiers = await getTalentTiersByUserIds(
    rows.map((s) => s.talent_profiles?.talent_user_id).filter(Boolean),
  );

  return rows.map((s: any) => {
    const p = s.talent_profiles;
    return {
      id: p.id,
      user_id: p.talent_user_id,
      category_id: p.category_id,
      category: p.categories,
      status: p.status,
      field_data: p.field_data,
      talent_user: p.talent_users,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tier: tiers[p.talent_user_id]?.tier ?? null,
      tier_custom: tiers[p.talent_user_id]?.tier_custom ?? null,
    };
  });
}

export async function addToShortlist(businessUserId: string, profileId: string) {
  // Verify the profile exists and is approved
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, talent_users!inner(id)')
    .eq('id', profileId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found or not approved');

  const { error } = await supabaseAdmin
    .from('shortlists')
    .insert({ business_user_id: businessUserId, talent_profile_id: profileId });

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'Profile already shortlisted');
    }
    throw new AppError(400, error.message);
  }
}

export async function removeFromShortlist(businessUserId: string, profileId: string) {
  const { error } = await supabaseAdmin
    .from('shortlists')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('talent_profile_id', profileId);

  if (error) throw new AppError(400, error.message);
}

// ─── Subscription cards (linked via subscription_cards.business_user_id) ────

function pickCategoryIds(matchRules: unknown): string[] {
  if (!matchRules || typeof matchRules !== 'object') return [];
  const raw = (matchRules as Record<string, unknown>).category_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// Tier display order. Talent/plan tiers arrive in mixed case ('junior',
// 'Pro', 'Top Talents'). Unknown tiers sort last.
const TIER_RANK: Record<string, number> = { junior: 0, pro: 1, 'top talents': 2 };
function tierRankOf(tier: string | null | undefined): number {
  return TIER_RANK[(tier ?? '').toLowerCase().trim()] ?? 99;
}

interface DashboardCardSummary {
  id: string;
  external_id: string;
  group_id: string | null;
  brand_name: string | null;
  subscription_name: string | null;
  plan_name: string | null;
  plan_tier: string | null;
  customer_monthly_price: number | null;
  currency: string | null;
  status: 'active' | 'assigned' | 'archived';
  published_at: string | null;
  recalled_at: string | null;
  card_type: 'subscription' | 'assignment' | 'hiring';
  category_ids: string[];
  counts: { accepted: number; pending: number; rejected: number; shortlisted: number; for_review: number; selected: number };
}

// Collapse the per-tier sibling cards of one multi-tier brief (same group_id)
// into a single dashboard entry with a per-tier breakdown. Cards without a
// group_id stay standalone. Input order is preserved; the first card seen for
// a group is its representative (the id the business clicks through to open).
// Counts/categories are aggregated, the lowest tier price is surfaced as the
// "from" price, status takes the most-live across the group, and `tiers` lists
// the group's tiers so the UI can render "Junior · Pro · Top Talents".
function collapseByGroup(
  perCard: DashboardCardSummary[],
): Array<DashboardCardSummary & { tiers: string[]; is_group: boolean }> {
  const out: Array<any> = [];
  const groupEntry = new Map<string, any>();

  for (const c of perCard) {
    if (!c.group_id) {
      out.push({ ...c, tiers: c.plan_tier ? [c.plan_tier] : [], is_group: false });
      continue;
    }
    const existing = groupEntry.get(c.group_id);
    if (!existing) {
      const entry: any = {
        ...c,
        plan_tier: null,
        is_group: true,
        counts: { ...c.counts },
        _tierSet: new Set<string>(c.plan_tier ? [c.plan_tier] : []),
        _catSet: new Set<string>(c.category_ids),
        _minPrice: c.customer_monthly_price,
        _statuses: new Set<string>([c.status]),
      };
      groupEntry.set(c.group_id, entry);
      out.push(entry);
    } else {
      for (const k of Object.keys(existing.counts)) {
        existing.counts[k] += (c.counts as any)[k] ?? 0;
      }
      for (const cat of c.category_ids) existing._catSet.add(cat);
      if (c.plan_tier) existing._tierSet.add(c.plan_tier);
      if (typeof c.customer_monthly_price === 'number') {
        existing._minPrice =
          existing._minPrice == null ? c.customer_monthly_price : Math.min(existing._minPrice, c.customer_monthly_price);
      }
      existing._statuses.add(c.status);
      if (!existing.currency && c.currency) existing.currency = c.currency;
    }
  }

  return out.map((e) => {
    if (!e.is_group) return e;
    const { _tierSet, _catSet, _minPrice, _statuses, ...rest } = e;
    const status = _statuses.has('active') ? 'active' : _statuses.has('assigned') ? 'assigned' : 'archived';
    return {
      ...rest,
      tiers: Array.from(_tierSet as Set<string>).sort((a, b) => tierRankOf(a) - tierRankOf(b)),
      category_ids: Array.from(_catSet as Set<string>),
      customer_monthly_price: _minPrice ?? null,
      status,
    };
  });
}

export async function listMySubscriptionCards(
  businessUserId: string,
  // Which product line to list. The business portal renders subscriptions and
  // assignments in two separate sections, so each call filters to one type.
  cardType: 'subscription' | 'assignment' = 'subscription',
) {
  // Resolve the caller's contact_email so we can rescue cards whose
  // business_user_id was left null at ingest time. SquadHub may publish
  // a card before the business_users row exists (the lead accepts their
  // invitation later); the row's `business_email` is the ground truth
  // and lets us match the card to the user once both sides exist.
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = (businessUser?.contact_email as string | null | undefined) ?? null;

  const orFilter = contactEmail
    ? `business_user_id.eq.${businessUserId},and(business_user_id.is.null,business_email.ilike.${contactEmail})`
    : `business_user_id.eq.${businessUserId}`;

  const { data: cards, error } = await supabaseAdmin
    .from('subscription_cards')
    .select(
      'id, external_id, content, match_rules, status, published_at, expires_at, created_at, business_user_id, recalled_at, is_secondary, group_id, card_type',
    )
    .or(orFilter)
    // Split subscriptions from assignments — the portal shows each in its own
    // section, so a subscription list must not surface assignment cards.
    .eq('card_type', cardType)
    // Hide SquadHub-side secondary cards from the business dashboard — only
    // primary cards represent a distinct hire opportunity. Secondaries are
    // structural duplicates with the same brand/role.
    .eq('is_secondary', false)
    // Hide cards SquadHub explicitly archived. archived_at is a hard hide
    // independent of status — a recalled card has status='archived' but
    // should still appear in Closed, whereas an archived card must not
    // surface anywhere on the business dashboard.
    .is('archived_at', null)
    .order('published_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  const list = cards ?? [];
  if (list.length === 0) return [];

  // Opportunistically backfill business_user_id for any cards we matched
  // by email so subsequent reads hit the indexed FK path. Best-effort —
  // don't block the response on it. Idempotent: an already-linked card
  // will simply re-write the same id.
  const orphanIds = list
    .filter((c: any) => c.business_user_id == null)
    .map((c: any) => c.id as string);
  if (orphanIds.length > 0) {
    void supabaseAdmin
      .from('subscription_cards')
      .update({ business_user_id: businessUserId })
      .in('id', orphanIds)
      .then(({ error: backfillErr }) => {
        if (backfillErr) {
          console.error('[business] failed to backfill business_user_id', backfillErr);
        }
      });
  }

  const cardIds = list.map((c: any) => c.id as string);

  // Per-card category requirements — used to gate accepted-derived counts on
  // the same eligibility chain as getCardRecipientsForReview, so the
  // dashboard count agrees with what the detail page renders.
  const cardCategoryMap = new Map<string, string[]>();
  for (const card of list) {
    cardCategoryMap.set(card.id as string, pickCategoryIds(card.match_rules));
  }
  const allCardCategoryIds = Array.from(
    new Set(Array.from(cardCategoryMap.values()).flat()),
  );

  // Pull recipient counts in one shot — includes business review status.
  const { data: recipientRows } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('card_id, talent_user_id, status, business_review_status, selected_at, cancelled_at')
    .in('card_id', cardIds);

  // Narrow eligibility lookups to talents the business has accepted (and not
  // cancelled). Pending/rejected recipients don't need talent or profile
  // checks since they don't feed accepted-derived buckets.
  const candidateTalentIds = new Set<string>();
  for (const r of recipientRows ?? []) {
    if ((r as any).status === 'accepted' && !(r as any).cancelled_at) {
      candidateTalentIds.add((r as any).talent_user_id as string);
    }
  }

  const activeTalentIds = new Set<string>();
  const profileCategoriesByTalent = new Map<string, Set<string>>();

  if (candidateTalentIds.size > 0) {
    const { data: activeTalents } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .in('id', Array.from(candidateTalentIds))
      .eq('is_active', true);
    for (const t of activeTalents ?? []) activeTalentIds.add((t as any).id as string);

    if (activeTalentIds.size > 0 && allCardCategoryIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('talent_profiles')
        .select('talent_user_id, category_id')
        .in('talent_user_id', Array.from(activeTalentIds))
        .in('category_id', allCardCategoryIds)
        .eq('status', 'approved')
        .eq('is_active', true)
        .is('deleted_at', null);
      for (const p of profiles ?? []) {
        const tid = (p as any).talent_user_id as string;
        let cats = profileCategoriesByTalent.get(tid);
        if (!cats) {
          cats = new Set<string>();
          profileCategoriesByTalent.set(tid, cats);
        }
        cats.add((p as any).category_id as string);
      }
    }
  }

  function isEligibleForCard(r: any, cardId: string): boolean {
    if (r.status !== 'accepted') return false;
    if (r.cancelled_at) return false;
    if (!activeTalentIds.has(r.talent_user_id)) return false;
    const cardCats = cardCategoryMap.get(cardId) ?? [];
    if (cardCats.length === 0) return false;
    const profCats = profileCategoriesByTalent.get(r.talent_user_id);
    if (!profCats) return false;
    return cardCats.some((c) => profCats.has(c));
  }

  const counts = new Map<string, { accepted: number; pending: number; rejected: number; shortlisted: number; for_review: number; selected: number }>();
  for (const id of cardIds) counts.set(id, { accepted: 0, pending: 0, rejected: 0, shortlisted: 0, for_review: 0, selected: 0 });
  for (const r of recipientRows ?? []) {
    const bucket = counts.get((r as any).card_id);
    if (!bucket) continue;
    const status = (r as any).status as string;
    if (status === 'pending') bucket.pending++;
    else if (status === 'rejected') bucket.rejected++;

    if (isEligibleForCard(r, (r as any).card_id)) {
      bucket.accepted++;
      if ((r as any).selected_at) bucket.selected++;
      const reviewStatus = (r as any).business_review_status as string | null;
      if (reviewStatus === 'shortlisted') bucket.shortlisted++;
      else if (!reviewStatus && !(r as any).selected_at) bucket.for_review++;
    }
  }

  const perCard: DashboardCardSummary[] = list.map((card: any) => {
    const content = (card.content ?? {}) as Record<string, unknown>;
    const categoryIds = pickCategoryIds(card.match_rules);
    return {
      id: card.id as string,
      external_id: card.external_id as string,
      group_id: (card.group_id as string | null) ?? null,
      brand_name: (content.brand_name as string) ?? null,
      subscription_name: (content.subscription_name as string) ?? null,
      plan_name: (content.plan_name as string) ?? null,
      plan_tier: (content.plan_tier as string) ?? null,
      customer_monthly_price:
        typeof content.customer_monthly_price === 'number' ? content.customer_monthly_price : null,
      currency: (content.currency as string) ?? null,
      status: card.status as 'active' | 'assigned' | 'archived',
      published_at: card.published_at as string | null,
      recalled_at: (card.recalled_at as string | null | undefined) ?? null,
      card_type: (card.card_type as 'subscription' | 'assignment' | 'hiring') ?? 'subscription',
      category_ids: categoryIds,
      counts: counts.get(card.id as string)!,
    };
  });

  // One dashboard card per brief: collapse the per-tier siblings into a single
  // entry with a tier breakdown (single-tier/legacy cards pass through as-is).
  return collapseByGroup(perCard);
}

export async function getMySubscriptionCard(businessUserId: string, cardId: string) {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, content, match_rules, status, published_at, expires_at, business_user_id, recalled_at, group_id, card_type')
    .eq('id', cardId)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!card) throw new AppError(404, 'Card not found');
  if ((card as any).business_user_id !== businessUserId) {
    throw new AppError(404, 'Card not found');
  }

  const content = ((card as any).content ?? {}) as Record<string, unknown>;
  const categoryIds = pickCategoryIds((card as any).match_rules);

  // Hydrate the card's targeted categories so the UI can label them.
  let categories: Array<{ id: string; name: string; slug: string }> = [];
  if (categoryIds.length > 0) {
    const { data: cats } = await supabaseAdmin
      .from('categories')
      .select('id, name, slug')
      .in('id', categoryIds);
    categories = (cats ?? []) as any;
  }

  // Pull through the rest of the relevant fields stored on the card so the
  // business dashboard can render a complete subscription summary.
  const matchRules = ((card as any).match_rules ?? {}) as Record<string, unknown>;

  // For a multi-tier brief, this card is one tier sibling. Surface the union of
  // the group's tiers so the header reads "Junior · Pro · Top Talents" and the
  // review page can offer a sub-tab per tier (the per-talent prices come from
  // getCardRecipientsForReview).
  let targetTiers = Array.isArray(matchRules.target_tiers) ? (matchRules.target_tiers as string[]) : [];
  const groupId = (card as any).group_id as string | null;
  if (groupId) {
    const { data: siblings } = await supabaseAdmin
      .from('subscription_cards')
      .select('content, match_rules')
      .eq('group_id', groupId)
      .is('archived_at', null);
    const tierSet = new Set<string>();
    for (const s of siblings ?? []) {
      const sc = ((s as any).content ?? {}) as Record<string, unknown>;
      if (typeof sc.plan_tier === 'string' && sc.plan_tier) tierSet.add(sc.plan_tier);
      const sm = ((s as any).match_rules ?? {}) as Record<string, unknown>;
      if (Array.isArray(sm.target_tiers)) {
        for (const t of sm.target_tiers as string[]) if (t) tierSet.add(t);
      }
    }
    if (tierSet.size > 0) {
      targetTiers = Array.from(tierSet).sort((a, b) => tierRankOf(a) - tierRankOf(b));
    }
  }

  return {
    id: card.id as string,
    external_id: card.external_id as string,
    brand_name: (content.brand_name as string) ?? null,
    subscription_name: (content.subscription_name as string) ?? null,
    plan_name: (content.plan_name as string) ?? null,
    plan_tier: (content.plan_tier as string) ?? null,
    customer_company: (content.customer_company as string) ?? null,
    customer_location: (content.customer_location as string) ?? null,
    customer_monthly_price:
      typeof content.customer_monthly_price === 'number' ? content.customer_monthly_price : null,
    currency: (content.currency as string) ?? null,
    // Assignments carry their scope in notes; subscriptions use description.
    description: (content.description as string) ?? (content.notes as string) ?? null,
    business_nature: (content.business_nature as string) ?? null,
    hours_label: (content.hours_label as string) ?? null,
    working_days: Array.isArray(content.working_days) ? content.working_days : null,
    target_tiers: targetTiers,
    target_languages: Array.isArray(matchRules.target_languages) ? (matchRules.target_languages as string[]) : [],
    target_regions: Array.isArray(matchRules.target_regions)
      ? (matchRules.target_regions as Array<{ country_id: string; region: string }>)
      : [],
    custom_deliverables: Array.isArray(content.custom_deliverables)
      ? (content.custom_deliverables as Array<{
          id?: string;
          name: string;
          kind: string;
          per_day?: number;
          per_week?: number;
          per_month?: number;
        }>)
      : [],
    status: card.status as 'active' | 'archived',
    recalled_at: ((card as any).recalled_at as string | null) ?? null,
    published_at: card.published_at as string | null,
    expires_at: card.expires_at as string | null,
    // Product line + project timeline so the detail can render an Assignment
    // view (budget + duration/deadline) instead of subscription plan fields.
    card_type: ((card as any).card_type as 'subscription' | 'assignment' | 'hiring')
      ?? (content.card_type as 'subscription' | 'assignment' | 'hiring')
      ?? 'subscription',
    assignment_details:
      (content.assignment_details as Record<string, unknown> | null) ?? null,
    category_ids: categoryIds,
    categories,
  };
}

export async function getShortlistedProfilesForCard(
  businessUserId: string,
  cardId: string,
) {
  // First make sure the card belongs to this business — reuse the auth check
  // from getMySubscriptionCard so the shape stays consistent.
  const { data: card, error: cardErr } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, match_rules')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card || (card as any).business_user_id !== businessUserId) {
    throw new AppError(404, 'Card not found');
  }

  const categoryIds = pickCategoryIds((card as any).match_rules);
  if (categoryIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('shortlists')
    .select(
      'created_at, talent_profiles!inner(*, talent_users!inner(full_name, current_location, profile_photo_url, languages_spoken), categories!inner(id, name, slug))',
    )
    .eq('business_user_id', businessUserId)
    .in('talent_profiles.category_id', categoryIds)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  return (data ?? [])
    .map((row: any) => {
      const p = row.talent_profiles;
      if (!p) return null;
      return {
        id: p.id as string,
        user_id: p.talent_user_id as string,
        category_id: p.category_id as string,
        category: p.categories,
        status: p.status as string,
        field_data: p.field_data,
        talent_user: p.talent_users,
        shortlisted_at: row.created_at as string,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
}

// ─── Interest Requests ──────────────────────────────────────────────────────

export async function sendInterest(
  businessUserId: string,
  profileId: string,
  input: SendInterestInput
) {
  // Verify profile
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, talent_users!inner(id)')
    .eq('id', profileId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .eq('talent_users.is_active', true)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found or not approved');

  // Check for existing pending request
  const { data: existing } = await supabaseAdmin
    .from('interest_requests')
    .select('id')
    .eq('business_user_id', businessUserId)
    .eq('talent_profile_id', profileId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) throw new AppError(409, 'You already have a pending interest request for this profile');

  const { data, error } = await supabaseAdmin
    .from('interest_requests')
    .insert({
      business_user_id: businessUserId,
      talent_profile_id: profileId,
      message: input.message,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

export async function getInterests(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('interest_requests')
    .select('*, talent_profiles!inner(*, talent_users!inner(full_name), categories!inner(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    business_user_id: r.business_user_id,
    talent_profile_id: r.talent_profile_id,
    message: r.message,
    status: r.status,
    profile: r.talent_profiles
      ? {
          id: r.talent_profiles.id,
          category: r.talent_profiles.categories,
          field_data: r.talent_profiles.field_data,
          talent_user: r.talent_profiles.talent_users,
        }
      : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

// ─── Per-Card Talent Review ───────────────────────────────────────────────────

async function verifyCardOwnership(businessUserId: string, cardId: string) {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, match_rules, selected_at, selected_talent_user_id, external_id, content, status, group_id')
    .eq('id', cardId)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!card || (card as any).business_user_id !== businessUserId) {
    throw new AppError(404, 'Card not found');
  }
  return card as any;
}

// Resolve the set of cards that make up a brief: the per-tier siblings sharing
// group_id, or just [card] for a single-tier / legacy card. The siblings of a
// group belong to the same business (group_id is unique per brief), so this is
// safe to call after verifyCardOwnership on any one of them. Used so the review
// page and the shortlist/select actions operate across every tier of the brief
// even though the dashboard only hands back the representative card's id.
async function resolveGroupCards(card: any): Promise<any[]> {
  const groupId = card.group_id as string | null;
  if (!groupId) return [card];
  const { data: siblings } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, match_rules, content, status, selected_at, selected_talent_user_id, group_id, business_user_id')
    .eq('group_id', groupId)
    .is('archived_at', null);
  return siblings && siblings.length > 0 ? siblings : [card];
}

export async function getCardRecipientsForReview(businessUserId: string, cardId: string) {
  const card = await verifyCardOwnership(businessUserId, cardId);

  // For a multi-tier brief, gather all the tier sibling cards (same group_id)
  // so the business reviews every tier's accepted talents in one place, split
  // by tier on the client. Each recipient keeps its own card_id so we can tag
  // it with that tier's proposed price. Single-tier cards resolve to [card].
  const groupCards = await resolveGroupCards(card);
  const cardIds = groupCards.map((c: any) => c.id as string);

  // Union of every tier card's categories — eligibility is checked against the
  // whole group so a talent approved in the brief's category shows regardless
  // of which tier card matched them.
  const categoryIdSet = new Set<string>();
  for (const c of groupCards) for (const cat of pickCategoryIds(c.match_rules)) categoryIdSet.add(cat);
  const categoryIds = Array.from(categoryIdSet);

  // Per-tier proposed price (customer_monthly_price) + currency, keyed by the
  // card a recipient belongs to. This is the "proposed price" the business sees
  // next to each talent.
  const priceByCard = new Map<string, { price: number | null; currency: string | null }>();
  for (const c of groupCards) {
    const content = ((c as any).content ?? {}) as Record<string, unknown>;
    priceByCard.set(c.id as string, {
      price: typeof content.customer_monthly_price === 'number' ? content.customer_monthly_price : null,
      currency: (content.currency as string) ?? null,
    });
  }

  const { data: recipients, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, responded_at, selected_at, passed_over_at, business_review_status, business_reviewed_at')
    .in('card_id', cardIds)
    .eq('status', 'accepted')
    .is('cancelled_at', null)
    .order('responded_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  const rows = recipients ?? [];
  if (rows.length === 0) return [];

  const talentIds = Array.from(new Set(rows.map((r: any) => r.talent_user_id as string)));

  // Only include talents whose user account is still active. Filtering at
  // the source means inactive talents stop appearing in review/shortlist
  // sections — clicking through would 404 anyway.
  const { data: talents } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, current_location, profile_photo_url, languages_spoken')
    .in('id', talentIds)
    .eq('is_active', true);

  const talentMap = new Map<string, any>();
  for (const t of talents ?? []) talentMap.set((t as any).id, t);

  // Find the best matching active+approved profile per talent in the
  // card's categories. Recipients whose profile no longer qualifies are
  // dropped entirely.
  const profileMap = new Map<string, any>();
  if (categoryIds.length > 0 && talentMap.size > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('talent_profiles')
      .select('id, talent_user_id, category_id, categories!inner(id, name, slug)')
      .in('talent_user_id', Array.from(talentMap.keys()))
      .in('category_id', categoryIds)
      .eq('status', 'approved')
      .eq('is_active', true)
      .is('deleted_at', null);

    for (const p of profiles ?? []) {
      const uid = (p as any).talent_user_id as string;
      if (!profileMap.has(uid)) profileMap.set(uid, p);
    }
  }

  const visibleTalentIds = Array.from(profileMap.keys());
  const tiers = await getTalentTiersByUserIds(visibleTalentIds);

  const acceptedRows = rows.filter((r: any) => profileMap.has(r.talent_user_id));

  // Selection is resolved per tier card (each tier card can be independently
  // assigned). Mirrors the original single-card logic, applied per card:
  //  1. card.selected_talent_user_id is set → use it
  //  2. Any recipient on that card has selected_at → they're selected
  //  3. Card is 'assigned' with selected_at but no explicit selection
  //     (webhook gap) and has exactly one accepted recipient → infer it.
  const acceptedByCard = new Map<string, any[]>();
  for (const r of acceptedRows) {
    const arr = acceptedByCard.get(r.card_id as string) ?? [];
    arr.push(r);
    acceptedByCard.set(r.card_id as string, arr);
  }
  const selectionByCard = new Map<string, { selectedTalent: string | null; selectedAt: string | null }>();
  for (const c of groupCards) {
    const accForCard = acceptedByCard.get(c.id as string) ?? [];
    const cardSelectedTalent = (c.selected_talent_user_id as string | null) ?? null;
    const cardSelectedAt = (c.selected_at as string | null) ?? null;
    let inferred: string | null = cardSelectedTalent;
    const anySelected = accForCard.some((r: any) => !!r.selected_at);
    if (!inferred && !anySelected && (c as any).status === 'assigned' && cardSelectedAt && accForCard.length === 1) {
      inferred = accForCard[0].talent_user_id as string;
    }
    selectionByCard.set(c.id as string, { selectedTalent: inferred, selectedAt: cardSelectedAt });
  }

  return acceptedRows
    .map((r: any) => {
      const talent = talentMap.get(r.talent_user_id) ?? {};
      const profile = profileMap.get(r.talent_user_id);
      const sel = selectionByCard.get(r.card_id as string) ?? { selectedTalent: null, selectedAt: null };
      const isCardSelected = sel.selectedTalent && r.talent_user_id === sel.selectedTalent;
      const price = priceByCard.get(r.card_id as string) ?? { price: null, currency: null };
      return {
        recipient_id: r.id as string,
        talent_user_id: r.talent_user_id as string,
        card_id: r.card_id as string,
        talent_name: talent.full_name ?? null,
        profile_photo_url: talent.profile_photo_url ?? null,
        current_location: talent.current_location ?? null,
        languages_spoken: talent.languages_spoken ?? null,
        profile_id: profile?.id ?? null,
        category: profile?.categories ?? null,
        tier: tiers[r.talent_user_id]?.tier ?? null,
        tier_custom: tiers[r.talent_user_id]?.tier_custom ?? null,
        // Proposed price for this talent = the customer monthly price of the
        // tier card they were matched into.
        proposed_price: price.price,
        currency: price.currency,
        business_review_status: r.business_review_status ?? null,
        business_reviewed_at: r.business_reviewed_at ?? null,
        selected_at: r.selected_at ?? (isCardSelected ? sel.selectedAt : null),
        passed_over_at: r.passed_over_at ?? (sel.selectedTalent && !isCardSelected ? sel.selectedAt : null),
        responded_at: r.responded_at ?? null,
      };
    });
}

export async function reviewCardRecipient(
  businessUserId: string,
  cardId: string,
  recipientId: string,
  action: 'shortlist' | 'reject' | 'unshortlist',
) {
  const card = await verifyCardOwnership(businessUserId, cardId);
  const groupCards = await resolveGroupCards(card);
  const groupCardIds = groupCards.map((c: any) => c.id as string);

  const { data: recipient, error: recErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, status, cancelled_at, card_id')
    .eq('id', recipientId)
    .in('card_id', groupCardIds)
    .maybeSingle();

  if (recErr) throw new AppError(500, recErr.message);
  if (!recipient) throw new AppError(404, 'Recipient not found');

  // Selection is per tier card: block review only if the recipient's own tier
  // card already has a final selection, not because a sibling tier does.
  const ownCard = groupCards.find((c: any) => c.id === (recipient as any).card_id);
  if (ownCard?.selected_at) {
    throw new AppError(409, 'Card already has a selected talent');
  }
  if ((recipient as any).status !== 'accepted') {
    throw new AppError(400, 'Recipient must have accepted before review');
  }
  if ((recipient as any).cancelled_at) {
    throw new AppError(400, 'Recipient has been cancelled');
  }

  const now = new Date().toISOString();
  const update =
    action === 'unshortlist'
      ? { business_review_status: null, business_reviewed_at: null }
      : { business_review_status: action === 'shortlist' ? 'shortlisted' : 'rejected', business_reviewed_at: now };

  const { error: updErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update(update)
    .eq('id', recipientId);

  if (updErr) throw new AppError(500, updErr.message);
}

export async function businessSelectRecipient(
  businessUserId: string,
  cardId: string,
  recipientId: string,
) {
  const card = await verifyCardOwnership(businessUserId, cardId);
  const groupCards = await resolveGroupCards(card);
  const groupCardIds = groupCards.map((c: any) => c.id as string);

  // Verify the recipient is shortlisted by the business
  const { data: recipient } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, business_review_status, card_id')
    .eq('id', recipientId)
    .in('card_id', groupCardIds)
    .maybeSingle();

  if (!recipient) throw new AppError(404, 'Recipient not found');

  // Selection is per tier card.
  const ownCard = groupCards.find((c: any) => c.id === (recipient as any).card_id);
  if (ownCard?.selected_at) {
    throw new AppError(409, 'A talent has already been selected for this card');
  }
  if ((recipient as any).business_review_status !== 'shortlisted') {
    throw new AppError(400, 'Only shortlisted recipients can be selected');
  }

  // Delegate to the existing selection logic, on the recipient's own tier card.
  return adminSelectRecipient((recipient as any).card_id as string, recipientId);
}
