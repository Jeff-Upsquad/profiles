import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateBusinessUserInput, DiscoverQueryInput, SendInterestInput } from '../validators/business.validators.js';

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
    .select('talent_profile_id, talent_profiles(*, talent_users(full_name, current_location, languages_spoken, profile_photo_url), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((sp: any) => {
    const p = sp.talent_profiles;
    if (!p) return null;
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
    };
  }).filter(Boolean);
}

export async function getSharedProfile(businessUserId: string, categoryId: string, profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('talent_profile_id, talent_profiles(*, talent_users(full_name, current_location, languages_spoken, profile_photo_url, phone), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .single();

  if (error || !data) throw new AppError(404, 'Shared profile not found');

  const p = (data as any).talent_profiles;
  if (!p) throw new AppError(404, 'Profile not found');

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
  };
}

export async function getPortfolioForProfile(businessUserId: string, categoryId: string, profileId: string) {
  // Verify the profile is shared with this business user
  const { data: shared } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('id')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .single();

  if (!shared) throw new AppError(404, 'Profile not shared with you');

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('*')
    .eq('profile_id', profileId)
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch portfolio items');
  return data ?? [];
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

  // Reshape to nest talent_user
  const shaped = (profiles ?? []).map((p: any) => ({
    id: p.id,
    user_id: p.talent_user_id,
    category_id: p.category_id,
    category: p.categories,
    status: p.status,
    field_data: p.field_data,
    talent_user: p.talent_users,
    created_at: p.created_at,
    updated_at: p.updated_at,
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
    .select('*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url, phone), categories!inner(id, name, slug)')
    .eq('id', profileId)
    .eq('category_id', category.id)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');

  return {
    id: data.id,
    user_id: (data as any).talent_user_id,
    category_id: data.category_id,
    category: (data as any).categories,
    status: data.status,
    field_data: data.field_data,
    talent_user: (data as any).talent_users,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

// ─── Shortlist ──────────────────────────────────────────────────────────────

export async function getShortlist(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('shortlists')
    .select('*, talent_profiles!inner(*, talent_users!inner(full_name, current_location), categories!inner(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((s: any) => {
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
    };
  });
}

export async function addToShortlist(businessUserId: string, profileId: string) {
  // Verify the profile exists and is approved
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('status', 'approved')
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

export async function listMySubscriptionCards(businessUserId: string) {
  const { data: cards, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, content, match_rules, status, published_at, expires_at, created_at')
    .eq('business_user_id', businessUserId)
    .order('published_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  const list = cards ?? [];
  if (list.length === 0) return [];

  const cardIds = list.map((c: any) => c.id as string);

  // Pull recipient acceptance counts in one shot.
  const { data: recipientRows } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('card_id, status')
    .in('card_id', cardIds);
  const counts = new Map<string, { accepted: number; pending: number; rejected: number }>();
  for (const id of cardIds) counts.set(id, { accepted: 0, pending: 0, rejected: 0 });
  for (const r of recipientRows ?? []) {
    const bucket = counts.get((r as any).card_id);
    if (!bucket) continue;
    const status = (r as any).status as 'pending' | 'accepted' | 'rejected';
    if (status in bucket) bucket[status]++;
  }

  // Pull this business's shortlist once, then count per card by category match.
  const { data: shortlistRows } = await supabaseAdmin
    .from('shortlists')
    .select('talent_profile_id, talent_profiles!inner(category_id)')
    .eq('business_user_id', businessUserId);
  const shortlistedCategoryIds = new Set<string>();
  const shortlistsByCategory = new Map<string, number>();
  for (const row of shortlistRows ?? []) {
    const categoryId = (row as any).talent_profiles?.category_id as string | undefined;
    if (!categoryId) continue;
    shortlistedCategoryIds.add(categoryId);
    shortlistsByCategory.set(categoryId, (shortlistsByCategory.get(categoryId) ?? 0) + 1);
  }

  return list.map((card: any) => {
    const content = (card.content ?? {}) as Record<string, unknown>;
    const categoryIds = pickCategoryIds(card.match_rules);
    const shortlistedCount = categoryIds.reduce(
      (sum, cid) => sum + (shortlistsByCategory.get(cid) ?? 0),
      0,
    );
    return {
      id: card.id as string,
      external_id: card.external_id as string,
      brand_name: (content.brand_name as string) ?? null,
      subscription_name: (content.subscription_name as string) ?? null,
      plan_name: (content.plan_name as string) ?? null,
      monthly_price: typeof content.monthly_price === 'number' ? content.monthly_price : null,
      currency: (content.currency as string) ?? null,
      status: card.status as 'active' | 'archived',
      published_at: card.published_at as string | null,
      category_ids: categoryIds,
      counts: {
        ...counts.get(card.id as string)!,
        shortlisted: shortlistedCount,
      },
    };
  });
}

export async function getMySubscriptionCard(businessUserId: string, cardId: string) {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, content, match_rules, status, published_at, expires_at, business_user_id')
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

  return {
    id: card.id as string,
    external_id: card.external_id as string,
    brand_name: (content.brand_name as string) ?? null,
    subscription_name: (content.subscription_name as string) ?? null,
    plan_name: (content.plan_name as string) ?? null,
    monthly_price: typeof content.monthly_price === 'number' ? content.monthly_price : null,
    currency: (content.currency as string) ?? null,
    description: (content.description as string) ?? null,
    business_nature: (content.business_nature as string) ?? null,
    hours_label: (content.hours_label as string) ?? null,
    working_days: Array.isArray(content.working_days) ? content.working_days : null,
    status: card.status as 'active' | 'archived',
    published_at: card.published_at as string | null,
    expires_at: card.expires_at as string | null,
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
    .select('id')
    .eq('id', profileId)
    .eq('status', 'approved')
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
