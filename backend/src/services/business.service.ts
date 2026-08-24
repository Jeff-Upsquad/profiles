import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateBusinessUserInput, DiscoverQueryInput, SendInterestInput } from '../validators/business.validators.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';
import { adminSelectRecipient, adminUndoSelection } from './subscription.service.js';
import { businessAmountFromOffer } from './assignment-offers.service.js';
import { cancelPaymentLink } from './razorpay.service.js';
import { pushCrmIdentityNames } from '../lib/crm-identity-names.js';

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

  if (input.contact_person_name || input.company_name) {
    void pushCrmIdentityNames({
      phone: (data as { contact_phone?: string | null }).contact_phone,
      email: (data as { contact_email?: string | null }).contact_email,
      person_name: input.contact_person_name,
      brand_name: input.company_name,
    });
  }

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

async function businessOwnsCardRowForAccess(
  businessUserId: string,
  card: { business_user_id?: string | null; business_email?: string | null },
): Promise<boolean> {
  if (card.business_user_id === businessUserId) return true;
  const cardEmail = (card.business_email || '').trim().toLowerCase();
  if (!cardEmail) return false;
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = ((businessUser as any)?.contact_email as string | null | undefined)
    ?.trim()
    .toLowerCase();
  return !!(contactEmail && contactEmail === cardEmail);
}

/**
 * Returns true if the talent is visible to this business for a card in the
 * given category. Used as a fallback for `getSharedProfile` when the row in
 * `business_shared_profiles` is missing.
 *
 * Visible when the talent has either:
 *  - accepted a subscription/assignment card owned by this business, OR
 *  - submitted a bid / offer on such a card (status may still be pending)
 *
 * When `cardId` is provided (deep-link from Bidding), that specific card is
 * checked first so category/match_rules mismatches don't block the open.
 */
async function isProfileVisibleViaSubscriptionCard(
  businessUserId: string,
  categoryId: string,
  profileId: string,
  cardId?: string | null,
): Promise<boolean> {
  // Prefer the exact profile+category pair; if missing, still try by profile id
  // alone (Bidding links always send the profile's own category_id).
  let talentUserId: string | null = null;
  {
    const { data: profile } = await supabaseAdmin
      .from('talent_profiles')
      .select('talent_user_id, category_id')
      .eq('id', profileId)
      .maybeSingle();
    if (!profile) return false;
    if ((profile as any).category_id !== categoryId) {
      // Allow if the profile exists but category path differs slightly — still
      // require the URL category to match for the load query below.
    }
    talentUserId = (profile as any).talent_user_id as string;
  }
  if (!talentUserId) return false;

  // Fast path: explicit card from Bidding deep-link.
  if (cardId) {
    const { data: card } = await supabaseAdmin
      .from('subscription_cards')
      .select('id, business_user_id, business_email')
      .eq('id', cardId)
      .maybeSingle();
    if (card && (await businessOwnsCardRowForAccess(businessUserId, card as any))) {
      const { data: recipient } = await supabaseAdmin
        .from('subscription_card_recipients')
        .select('id, status')
        .eq('card_id', cardId)
        .eq('talent_user_id', talentUserId)
        .is('cancelled_at', null)
        .maybeSingle();
      if (recipient && (recipient as any).status === 'accepted') return true;

      const { data: offer } = await supabaseAdmin
        .from('assignment_offers')
        .select('id')
        .eq('card_id', cardId)
        .eq('talent_user_id', talentUserId)
        .limit(1)
        .maybeSingle();
      if (offer) return true;

      // Any uncancelled recipient on this card (matched talent, even pre-accept).
      if (recipient) return true;
    }
  }

  // Uncancelled recipient rows for this talent (accepted OR still pending after a bid).
  const { data: recipients } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, status')
    .eq('talent_user_id', talentUserId)
    .is('cancelled_at', null);

  const acceptedCardIds = new Set(
    (recipients ?? [])
      .filter((r: any) => r.status === 'accepted')
      .map((r: any) => r.card_id as string),
  );

  // Cards where this talent has any bid/offer (including open pending_business).
  const offerCardIds = new Set<string>();
  const { data: offers } = await supabaseAdmin
    .from('assignment_offers')
    .select('card_id')
    .eq('talent_user_id', talentUserId);
  for (const o of offers ?? []) offerCardIds.add((o as any).card_id as string);

  const cardIds = [...new Set([...acceptedCardIds, ...offerCardIds])];
  if (cardIds.length === 0) return false;

  const { data: cards } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, business_email, match_rules')
    .in('id', cardIds);

  for (const card of cards ?? []) {
    if (!(await businessOwnsCardRowForAccess(businessUserId, card as any))) continue;
    const ids = pickCategoryIds((card as any).match_rules);
    // Empty category list = no gate; otherwise profile category must be targeted.
    if (ids.length === 0 || ids.includes(categoryId)) return true;
  }
  return false;
}

/**
 * Price / bid context for THIS card only (talent may have other cards with the
 * same business). Used when the business opens the profile from a card review
 * or Bidding row.
 */
export interface CardEngagementContext {
  card_id: string;
  card_type: 'subscription' | 'assignment' | 'hiring' | string;
  brand_name: string | null;
  /** Standing list / original price on the card. */
  list_price: number | null;
  currency: string | null;
  period: 'per_month' | 'project';
  /**
   * - bid: talent submitted/countered a figure
   * - accepted_list: talent accepted the card's original price (no bid row)
   * - business_offer: business opened/countered; talent may still respond
   * - agreed: offer terminal accepted at current_amount
   * - none: no price relationship yet
   */
  kind: 'bid' | 'accepted_list' | 'business_offer' | 'agreed' | 'none';
  amount: number | null;
  offer_status: string | null;
  recipient_status: string | null;
  label: string;
}

async function resolveCardEngagement(
  cardId: string,
  talentUserId: string,
): Promise<CardEngagementContext | null> {
  const { data: card } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, card_type, content')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return null;

  const content = ((card as any).content ?? {}) as Record<string, unknown>;
  const cardType = ((card as any).card_type as string) || 'subscription';
  const isAssignment = cardType === 'assignment';
  const period: 'per_month' | 'project' = isAssignment ? 'project' : 'per_month';
  const listPrice =
    typeof content.customer_monthly_price === 'number'
      ? content.customer_monthly_price
      : typeof content.monthly_price === 'number'
        ? content.monthly_price
        : typeof content.proposed_price === 'number'
          ? content.proposed_price
          : null;
  const currency =
    typeof content.currency === 'string' && content.currency
      ? content.currency
      : 'INR';
  const brandName =
    (typeof content.brand_name === 'string' && content.brand_name) ||
    (typeof content.title === 'string' && content.title) ||
    null;

  const { data: recipient } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, status')
    .eq('card_id', cardId)
    .eq('talent_user_id', talentUserId)
    .is('cancelled_at', null)
    .maybeSingle();
  const recipientStatus = ((recipient as any)?.status as string | null) ?? null;

  // Latest offer for this talent on THIS card (open or terminal).
  const { data: offer } = await supabaseAdmin
    .from('assignment_offers')
    .select('id, status, current_amount, opened_by, last_actor_side, updated_at')
    .eq('card_id', cardId)
    .eq('talent_user_id', talentUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const offerAmountRaw = (offer as any)?.current_amount;
  const offerAmount =
    offerAmountRaw && typeof offerAmountRaw === 'object' && typeof offerAmountRaw.amount === 'number'
      ? (offerAmountRaw.amount as number)
      : null;
  const offerStatus = ((offer as any)?.status as string | null) ?? null;
  const openedBy = ((offer as any)?.opened_by as string | null) ?? null;
  const lastActor = ((offer as any)?.last_actor_side as string | null) ?? null;

  let kind: CardEngagementContext['kind'] = 'none';
  let amount: number | null = null;
  let label = 'No price on this card yet';

  if (offer && offerAmount != null) {
    amount = offerAmount;
    if (offerStatus === 'accepted') {
      kind = 'agreed';
      label = 'Agreed price for this card';
    } else if (offerStatus === 'pending_business' || (openedBy === 'talent' && lastActor === 'talent')) {
      kind = 'bid';
      label = 'Talent bid for this card';
    } else if (offerStatus === 'pending_talent' || openedBy === 'business' || openedBy === 'admin') {
      kind = 'business_offer';
      label = 'Your offer for this card';
    } else {
      kind = 'bid';
      label = 'Latest figure for this card';
    }
  } else if (recipientStatus === 'accepted' && listPrice != null) {
    // Accepted the list price without opening a bid negotiation.
    kind = 'accepted_list';
    amount = listPrice;
    label = 'Accepted list price for this card';
  } else if (recipientStatus === 'accepted') {
    kind = 'accepted_list';
    amount = listPrice;
    label = 'Accepted this card';
  }

  return {
    card_id: cardId,
    card_type: cardType,
    brand_name: brandName,
    list_price: listPrice,
    currency,
    period,
    kind,
    amount,
    offer_status: offerStatus,
    recipient_status: recipientStatus,
    label,
  };
}

/**
 * Score a talent profile for deep-link selection on a card.
 * Prefer: matching card category > active > real (non-ghost) profile.
 * Category match wins even when the profile is inactive — the talent was
 * still matched/accepted on that category, so the business must be able to open it.
 */
function scoreProfileForCard(p: {
  category_id?: string | null;
  is_active?: boolean | null;
  is_ghost?: boolean | null;
}, categoryIds: string[]): number {
  let score = 0;
  if (categoryIds.length > 0 && p.category_id && categoryIds.includes(p.category_id)) {
    score += 100;
  }
  if (p.is_active !== false) score += 10;
  if (p.is_ghost !== true) score += 5;
  return score;
}

/** Attach Designer/Editor source profiles + portfolio onto a ghost profile payload. */
async function withGhostSourceProfiles<T extends { is_ghost?: boolean }>(
  baseProfile: T,
  profileRow: {
    source_designer_profile_id?: string | null;
    source_editor_profile_id?: string | null;
  },
): Promise<T & { source_profiles?: unknown[] }> {
  if (baseProfile.is_ghost !== true) return baseProfile;

  const designerId = profileRow.source_designer_profile_id as string | null;
  const editorId = profileRow.source_editor_profile_id as string | null;
  const ids = [designerId, editorId].filter((v): v is string => !!v);
  if (ids.length === 0) return { ...baseProfile, source_profiles: [] };

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

export async function getSharedProfile(
  businessUserId: string,
  categoryId: string,
  profileId: string,
  cardId?: string | null,
) {
  const { data, error } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('talent_profile_id, talent_profiles!inner(*, talent_users!inner(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .eq('talent_profiles.is_active', true)
    .eq('talent_profiles.talent_users.is_active', true)
    .maybeSingle();

  // Fallback: business may have access via card acceptance / open bid.
  if (!data) {
    const allowed = await isProfileVisibleViaSubscriptionCard(
      businessUserId,
      categoryId,
      profileId,
      cardId,
    );
    if (!allowed) throw new AppError(404, 'Shared profile not found');

    // Load without is_active join filters (nested filters can false-negative).
    // Prefer exact category match from the URL; if card-scoped access is
    // already authorized, load by profile id alone (category path can drift).
    // Inactive profiles are allowed when the business has card access — the
    // talent may have been matched before the profile was deactivated.
    let fallback: any = null;
    {
      const { data: byCat, error: byCatErr } = await supabaseAdmin
        .from('talent_profiles')
        .select('*, talent_users(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender, is_active), categories(id, name, slug)')
        .eq('id', profileId)
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!byCatErr && byCat) fallback = byCat;
    }
    if (!fallback && cardId) {
      const { data: byId, error: byIdErr } = await supabaseAdmin
        .from('talent_profiles')
        .select('*, talent_users(full_name, current_location, languages_spoken, profile_photo_url, phone, age, gender, is_active), categories(id, name, slug)')
        .eq('id', profileId)
        .is('deleted_at', null)
        .maybeSingle();
      if (!byIdErr && byId) fallback = byId;
    }
    if (!fallback) throw new AppError(404, 'Profile not found');
    // Card-scoped access may open inactive profiles; non-card still requires active.
    if (!cardId && (fallback as any).is_active === false) {
      throw new AppError(404, 'Profile not found');
    }
    if ((fallback as any).talent_users?.is_active === false) {
      throw new AppError(404, 'Profile not found');
    }

    const p = fallback as any;
    const tiers = await getTalentTiersByUserIds([p.talent_user_id]);
    const card_engagement = cardId
      ? await resolveCardEngagement(cardId, p.talent_user_id as string)
      : null;
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
      card_engagement,
    };
    // Same ghost hydration as the shared-list path — previously missing here,
    // which showed "Profile not found" for ghost profiles opened from a card.
    return withGhostSourceProfiles(baseProfile, p);
  }

  if (error) throw new AppError(500, (error as { message: string }).message);

  const p = (data as any).talent_profiles;
  if (!p) throw new AppError(404, 'Profile not found');

  const tiers = await getTalentTiersByUserIds([p.talent_user_id]);
  const card_engagement = cardId
    ? await resolveCardEngagement(cardId, p.talent_user_id as string)
    : null;
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
    card_engagement,
  };

  return withGhostSourceProfiles(baseProfile, p);
}

export async function getPortfolioForProfile(
  businessUserId: string,
  categoryId: string,
  profileId: string,
  cardId?: string | null,
) {
  // Verify the profile is shared with this business user
  const { data: shared } = await supabaseAdmin
    .from('business_shared_profiles')
    .select('id')
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId)
    .eq('talent_profile_id', profileId)
    .maybeSingle();

  if (!shared) {
    // Fallback: acceptance or open bid on the business's card
    const allowed = await isProfileVisibleViaSubscriptionCard(
      businessUserId,
      categoryId,
      profileId,
      cardId,
    );
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
  status: 'active' | 'assigned' | 'archived' | 'submitted';
  published_at: string | null;
  recalled_at: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  /** Set once SquadHub finalises the engagement (the "purchased" moment). A card
   *  can sit at status='assigned' while only *selected* and awaiting admin
   *  approval, so this is the only reliable "work has actually started" signal. */
  subscription_activated_at: string | null;
  card_type: 'subscription' | 'assignment' | 'hiring';
  category_ids: string[];
  counts: {
    accepted: number;
    pending: number;
    rejected: number;
    shortlisted: number;
    for_review: number;
    selected: number;
    new_accepted: number;
    /** Open talent bids awaiting business action (pending_business). */
    pending_bids: number;
  };
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
      // Group lifecycle: any paused/cancelled sibling marks the collapsed card.
      if (!existing.paused_at && c.paused_at) existing.paused_at = c.paused_at;
      if (!existing.cancelled_at && c.cancelled_at) existing.cancelled_at = c.cancelled_at;
      // One brief = one hire, so an activated sibling activates the whole group.
      if (!existing.subscription_activated_at && c.subscription_activated_at) {
        existing.subscription_activated_at = c.subscription_activated_at;
      }
      if (!existing.currency && c.currency) existing.currency = c.currency;
    }
  }

  return out.map((e) => {
    if (!e.is_group) return e;
    const { _tierSet, _catSet, _minPrice, _statuses, ...rest } = e;
    const status = _statuses.has('active')
      ? 'active'
      : _statuses.has('assigned')
        ? 'assigned'
        : _statuses.has('submitted')
          ? 'submitted'
          : 'archived';
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
  // business_user_id was left null at ingest time, OR stamped to a
  // different invite-shell row while this user later activated under the
  // same email. The row's `business_email` is ground truth from SquadHub.
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = (businessUser?.contact_email as string | null | undefined) ?? null;

  // Match by owned id, OR by customer email on the card (covers null id and
  // wrong-id-from-duplicate-account cases). Phone-only accounts still need
  // the correct business_user_id from ingest.
  const orFilter = contactEmail
    ? `business_user_id.eq.${businessUserId},business_email.ilike.${contactEmail}`
    : `business_user_id.eq.${businessUserId}`;

  const { data: cards, error } = await supabaseAdmin
    .from('subscription_cards')
    .select(
      'id, external_id, content, match_rules, status, published_at, expires_at, created_at, business_user_id, recalled_at, paused_at, cancelled_at, subscription_activated_at, is_secondary, group_id, card_type',
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
    // Prefer created_at so CRM pending briefs (published_at NULL) still sort
    // with live cards instead of falling to the end of a published_at order.
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  const list = cards ?? [];
  if (list.length === 0) return [];

  // Opportunistically re-point cards we matched by email (null id or a
  // stale invite-shell id) onto this login. Best-effort; don't block the
  // response. Idempotent when already correct.
  const reattachIds = list
    .filter((c: any) => c.business_user_id !== businessUserId)
    .map((c: any) => c.id as string);
  if (reattachIds.length > 0) {
    void supabaseAdmin
      .from('subscription_cards')
      .update({ business_user_id: businessUserId })
      .in('id', reattachIds)
      .then(({ error: backfillErr }) => {
        if (backfillErr) {
          console.error('[business] failed to reattach business_user_id', backfillErr);
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
    .select('card_id, talent_user_id, status, business_review_status, selected_at, cancelled_at, business_seen_at')
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

  const counts = new Map<
    string,
    {
      accepted: number;
      pending: number;
      rejected: number;
      shortlisted: number;
      for_review: number;
      selected: number;
      new_accepted: number;
      pending_bids: number;
    }
  >();
  for (const id of cardIds) {
    counts.set(id, {
      accepted: 0,
      pending: 0,
      rejected: 0,
      shortlisted: 0,
      for_review: 0,
      selected: 0,
      new_accepted: 0,
      pending_bids: 0,
    });
  }
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
      else if (!reviewStatus && !(r as any).selected_at) {
        bucket.for_review++;
        // Newly-accepted talents the business hasn't opened yet — drives the
        // unread badge on the card list and the "New" markers on the review page.
        if (!(r as any).business_seen_at) bucket.new_accepted++;
      }
    }
  }

  // Active negotiations (business has already engaged) awaiting business response.
  // First talent-only bids stay in for-review and do NOT bump this badge.
  const { data: bidRows } = await supabaseAdmin
    .from('assignment_offers')
    .select('id, card_id, talent_user_id, opened_by, status')
    .in('card_id', cardIds)
    .eq('status', 'pending_business');
  for (const o of bidRows ?? []) {
    const openedBy = (o as any).opened_by as string;
    // Count only if negotiation already started (business/admin opened or moved).
    if (openedBy === 'business' || openedBy === 'admin') {
      const bucket = counts.get((o as any).card_id as string);
      if (bucket) bucket.pending_bids++;
      continue;
    }
    // Talent-opened: check if business has ever moved on this talent+card.
    const { count } = await supabaseAdmin
      .from('assignment_offer_events')
      .select('id', { count: 'exact', head: true })
      .eq('offer_id', (o as any).id)
      .in('actor_type', ['business', 'admin'])
      .in('action', ['submitted', 'countered']);
    if ((count ?? 0) > 0) {
      const bucket = counts.get((o as any).card_id as string);
      if (bucket) bucket.pending_bids++;
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
      subscription_name:
        (content.subscription_name as string) ?? (content.title as string) ?? null,
      plan_name: (content.plan_name as string) ?? null,
      plan_tier: (content.plan_tier as string) ?? null,
      customer_monthly_price:
        typeof content.customer_monthly_price === 'number' ? content.customer_monthly_price : null,
      currency: (content.currency as string) ?? null,
      status: card.status as 'active' | 'assigned' | 'archived' | 'submitted',
      published_at: card.published_at as string | null,
      recalled_at: (card.recalled_at as string | null | undefined) ?? null,
      paused_at: (card.paused_at as string | null | undefined) ?? null,
      cancelled_at: (card.cancelled_at as string | null | undefined) ?? null,
      subscription_activated_at:
        (card.subscription_activated_at as string | null | undefined) ?? null,
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
    .select('id, external_id, content, match_rules, status, published_at, expires_at, business_user_id, business_email, recalled_at, paused_at, cancelled_at, subscription_activated_at, group_id, card_type')
    .eq('id', cardId)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!card) throw new AppError(404, 'Card not found');
  const owns = await businessOwnsCardRow(businessUserId, card as any);
  if (!owns) throw new AppError(404, 'Card not found');

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

  // Per-level pricing: a multi-tier brief is one sibling card per tier, each
  // priced individually. Collect every level's price so the review header can
  // show "Junior ₹3,000/mo · Pro ₹5,000/mo" instead of a single budget figure.
  const priceByTier = new Map<string, { plan_name: string | null; price: number }>();
  const collectTierPrice = (c: Record<string, unknown>) => {
    const tier = typeof c.plan_tier === 'string' ? c.plan_tier.trim() : '';
    const price = typeof c.customer_monthly_price === 'number' ? c.customer_monthly_price : null;
    if (!tier || price == null || priceByTier.has(tier)) return;
    priceByTier.set(tier, {
      plan_name: typeof c.plan_name === 'string' && c.plan_name ? c.plan_name : null,
      price,
    });
  };
  collectTierPrice(content);

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
      collectTierPrice(sc);
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
    subscription_name:
      (content.subscription_name as string) ?? (content.title as string) ?? null,
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
    // Optional skills/tools the client attached to the brief. From content, not
    // match_rules — descriptive only, presence-matched against talents for the
    // business's reference. null when the client didn't add any.
    additional_requirements:
      content.additional_requirements && typeof content.additional_requirements === 'object'
        ? (content.additional_requirements as Record<string, string[]>)
        : null,
    target_tiers: targetTiers,
    // One price per experience level (the budgets the client set per tier),
    // ordered junior → top. Empty when no tier carried a price.
    tier_prices: Array.from(priceByTier.entries())
      .map(([tier, v]) => ({ tier, plan_name: v.plan_name, price: v.price }))
      .sort((a, b) => tierRankOf(a.tier) - tierRankOf(b.tier)),
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
    status: card.status as 'active' | 'assigned' | 'archived' | 'submitted',
    recalled_at: ((card as any).recalled_at as string | null) ?? null,
    paused_at: ((card as any).paused_at as string | null) ?? null,
    cancelled_at: ((card as any).cancelled_at as string | null) ?? null,
    // Set by SquadHub admin approval (activation webhook). Splits the client's
    // "Selected (pending admin approval)" view from "Assigned".
    subscription_activated_at: ((card as any).subscription_activated_at as string | null) ?? null,
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
    .select('id, business_user_id, business_email, match_rules')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) throw new AppError(500, cardErr.message);
  if (!card || !(await businessOwnsCardRow(businessUserId, card as any))) {
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

/**
 * Ownership: direct business_user_id match, OR business_email matches this
 * user's contact_email (covers null / stale invite-shell ids until reattach).
 */
async function businessOwnsCardRow(
  businessUserId: string,
  card: { business_user_id?: string | null; business_email?: string | null },
): Promise<boolean> {
  if (card.business_user_id === businessUserId) return true;
  const cardEmail = (card.business_email || '').trim().toLowerCase();
  if (!cardEmail) return false;
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = ((businessUser as any)?.contact_email as string | null | undefined)
    ?.trim()
    .toLowerCase();
  if (contactEmail && contactEmail === cardEmail) {
    // Best-effort reattach so the next read is O(1) on the FK.
    if (card.business_user_id !== businessUserId) {
      void supabaseAdmin
        .from('subscription_cards')
        .update({ business_user_id: businessUserId })
        .eq('business_email', card.business_email as string)
        .then(({ error }) => {
          if (error) console.error('[business] reattach on own-check failed', error);
        });
    }
    return true;
  }
  return false;
}

async function verifyCardOwnership(businessUserId: string, cardId: string) {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, business_user_id, business_email, match_rules, selected_at, selected_talent_user_id, external_id, content, status, group_id')
    .eq('id', cardId)
    .maybeSingle();

  if (error) throw new AppError(500, error.message);
  if (!card || !(await businessOwnsCardRow(businessUserId, card as any))) {
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
    .select('id, match_rules, content, status, selected_at, selected_talent_user_id, subscription_activated_at, group_id, business_user_id')
    .eq('group_id', groupId)
    .is('archived_at', null);
  return siblings && siblings.length > 0 ? siblings : [card];
}

// Collect a talent's skill/tool/AI-tool names from their profile field_data
// into a flat list, used ONLY to presence-match a card's optional
// additional_requirements for the business review UI (never for matching who
// receives a card). Item shapes are inconsistent across groups — plain strings,
// `{ skill }`, `{ name }`, or `{ category }` — so probe every known key.
function talentSkillToolNames(fieldData: any): string[] {
  if (!fieldData || typeof fieldData !== 'object') return [];
  const groups = ['_skills', '_tools', '_ai_tools', '_accounting_software', '_categories'];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    const list = fieldData[g];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const name =
        typeof item === 'string'
          ? item
          : item?.name ?? item?.skill ?? item?.tool ?? item?.label ?? item?.category ?? '';
      const n = typeof name === 'string' ? name.trim() : '';
      if (!n) continue;
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
  }
  return out;
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

  // Activation is per tier sibling — each tier card is independently assigned by
  // a SquadHub admin. Keyed by card so a recipient can report whether THEIR tier
  // card is activated (Assigned) vs still Selected (pending). Without this the
  // client read one representative sibling's activation and mislabelled a talent
  // assigned on a different tier as "pending".
  const activatedByCard = new Map<string, string | null>();
  for (const c of groupCards) {
    activatedByCard.set(c.id as string, ((c as any).subscription_activated_at as string | null) ?? null);
  }

  // Heal: first-bid talents must show under For Review. Older bids (or a
  // failed accept-on-bid) can leave the recipient still pending — flip them
  // to accepted when they have any open/accepted offer on this card.
  {
    const { data: offerRecipients } = await supabaseAdmin
      .from('assignment_offers')
      .select('recipient_id')
      .in('card_id', cardIds)
      .in('status', ['pending_business', 'pending_talent', 'accepted']);
    const healIds = [
      ...new Set(
        (offerRecipients ?? [])
          .map((o: any) => o.recipient_id as string)
          .filter(Boolean),
      ),
    ];
    if (healIds.length > 0) {
      await supabaseAdmin
        .from('subscription_card_recipients')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .in('id', healIds)
        .eq('status', 'pending')
        .is('cancelled_at', null);
    }
  }

  // Accepted recipients (includes first-bid interest after heal).
  const { data: recipients, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, responded_at, selected_at, passed_over_at, business_review_status, business_reviewed_at, business_seen_at')
    .in('card_id', cardIds)
    .eq('status', 'accepted')
    .is('cancelled_at', null)
    .order('responded_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  let rows = recipients ?? [];

  // Fallback: any recipient with a bid still not in the accepted set.
  {
    const { data: bidOfferRows } = await supabaseAdmin
      .from('assignment_offers')
      .select('recipient_id')
      .in('card_id', cardIds)
      .in('status', ['pending_business', 'pending_talent', 'accepted']);
    const missing = [
      ...new Set(
        (bidOfferRows ?? [])
          .map((o: any) => o.recipient_id as string)
          .filter((id: string) => id && !rows.some((x: any) => x.id === id)),
      ),
    ];
    if (missing.length > 0) {
      const { data: extra } = await supabaseAdmin
        .from('subscription_card_recipients')
        .select(
          'id, card_id, talent_user_id, status, responded_at, selected_at, passed_over_at, business_review_status, business_reviewed_at, business_seen_at',
        )
        .in('id', missing)
        .neq('status', 'rejected')
        .is('cancelled_at', null);
      if (extra?.length) rows = [...rows, ...extra];
    }
  }

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

  // Best profile per talent for deep-links. Load all approved non-deleted
  // profiles (including inactive + ghost), then pick the highest-scoring one:
  // category match > active > non-ghost. Category match wins even when inactive
  // so a deactivated editor profile still opens for an Editors card — previously
  // we skipped inactive and linked a random ghost, which then 404'd.
  const profileMap = new Map<string, any>();
  if (talentMap.size > 0) {
    const talentUserIds = Array.from(talentMap.keys());
    const { data: profiles } = await supabaseAdmin
      .from('talent_profiles')
      .select(
        'id, talent_user_id, category_id, is_active, is_ghost, field_data, categories!inner(id, name, slug)',
      )
      .in('talent_user_id', talentUserIds)
      .eq('status', 'approved')
      .is('deleted_at', null);

    const bestByTalent = new Map<string, { p: any; score: number }>();
    for (const p of profiles ?? []) {
      const uid = (p as any).talent_user_id as string;
      const score = scoreProfileForCard(p as any, categoryIds);
      const prev = bestByTalent.get(uid);
      if (!prev || score > prev.score) bestByTalent.set(uid, { p, score });
    }
    for (const [uid, { p }] of bestByTalent) {
      profileMap.set(uid, p);
    }
  }

  const acceptedRows = rows.filter(
    (r: any) => talentMap.has(r.talent_user_id),
  );

  const visibleTalentIds = acceptedRows.map((r: any) => r.talent_user_id as string);
  const tiers = await getTalentTiersByUserIds(visibleTalentIds);

  // Latest open/accepted offer per recipient — bid or agreed price for UI chips.
  const recipientIds = acceptedRows.map((r: any) => r.id as string);
  const offerByRecipient = new Map<string, {
    offer_id: string;
    offer_status: string;
    offer_amount: unknown;
    last_actor_side: string | null;
    opened_by: string | null;
  }>();
  if (recipientIds.length > 0) {
    const { data: offerRows } = await supabaseAdmin
      .from('assignment_offers')
      .select('id, recipient_id, status, current_amount, last_actor_side, opened_by, updated_at')
      .in('recipient_id', recipientIds)
      .in('status', ['pending_business', 'pending_talent', 'accepted'])
      .order('updated_at', { ascending: false });
    for (const o of offerRows ?? []) {
      const rid = (o as any).recipient_id as string;
      if (offerByRecipient.has(rid)) continue; // first = latest (ordered desc)
      offerByRecipient.set(rid, {
        offer_id: (o as any).id as string,
        offer_status: (o as any).status as string,
        offer_amount: (o as any).current_amount,
        last_actor_side: ((o as any).last_actor_side as string | null) ?? null,
        opened_by: ((o as any).opened_by as string | null) ?? null,
      });
    }
  }

  // Card content (margin + list prices) for converting partner bids → business.
  const contentByCard = new Map<string, Record<string, unknown>>();
  for (const c of groupCards) {
    contentByCard.set(c.id as string, (((c as any).content ?? {}) as Record<string, unknown>));
  }

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
      const offer = offerByRecipient.get(r.id as string);
      const content = contentByCard.get(r.card_id as string) ?? {};
      // Business-facing bid (partner ask + margin). Legacy talent-only amounts
      // are converted using card margin so the chip shows the increased price.
      const bidAmount = offer
        ? businessAmountFromOffer(offer.offer_amount, content, {
            last_actor_side: offer.last_actor_side,
            opened_by: offer.opened_by,
          })
        : null;
      // Prefer bid/agreed figure as the chip price for first-bid talents.
      const displayPrice = bidAmount != null ? bidAmount : price.price;
      // Normalize offer_amount.amount to the business figure for the portal UI.
      const offerAmountForBusiness =
        offer && bidAmount != null && offer.offer_amount && typeof offer.offer_amount === 'object'
          ? { ...(offer.offer_amount as Record<string, unknown>), amount: bidAmount }
          : offer?.offer_amount ?? null;
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
        // Flat skill/tool/AI-tool names for presence-matching the card's optional
        // additional_requirements in the review UI. Reference only; not matching.
        skill_tool_names: talentSkillToolNames(profile?.field_data),
        tier: tiers[r.talent_user_id]?.tier ?? null,
        tier_custom: tiers[r.talent_user_id]?.tier_custom ?? null,
        // Bid amount wins over list price when the talent submitted a first bid.
        proposed_price: displayPrice,
        currency: price.currency,
        ...(offer
          ? {
              offer_id: offer.offer_id,
              offer_status: offer.offer_status,
              offer_amount: offerAmountForBusiness,
              last_actor_side: offer.last_actor_side,
            }
          : {
              offer_id: null as string | null,
              offer_status: null as string | null,
              offer_amount: null as unknown,
              last_actor_side: null as string | null,
            }),
        business_review_status: r.business_review_status ?? null,
        business_reviewed_at: r.business_reviewed_at ?? null,
        selected_at: r.selected_at ?? (isCardSelected ? sel.selectedAt : null),
        passed_over_at: r.passed_over_at ?? (sel.selectedTalent && !isCardSelected ? sel.selectedAt : null),
        responded_at: r.responded_at ?? null,
        // Null = the business hasn't opened this card since the talent accepted;
        // drives the "New" marker in the review pool. Cleared by markCardAcceptancesSeen.
        business_seen_at: r.business_seen_at ?? null,
        // This talent's OWN tier card's activation — set = Assigned, null =
        // Selected (pending admin approval). Per-recipient so grouped briefs read
        // the right tier's state.
        subscription_activated_at: activatedByCard.get(r.card_id as string) ?? null,
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

// Mark every still-unseen acceptance on this brief (all tier siblings) as seen
// by the business. Called when the business opens the card's review page, so the
// unread badge / "New" markers clear on the next load. Scoped by card ownership.
export async function markCardAcceptancesSeen(
  businessUserId: string,
  cardId: string,
): Promise<{ marked: number }> {
  const card = await verifyCardOwnership(businessUserId, cardId);
  const groupCards = await resolveGroupCards(card);
  const groupCardIds = groupCards.map((c: any) => c.id as string);

  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ business_seen_at: new Date().toISOString() })
    .in('card_id', groupCardIds)
    .eq('status', 'accepted')
    .is('business_seen_at', null)
    .select('id');

  if (error) throw new AppError(500, error.message);
  return { marked: (data ?? []).length };
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

/**
 * Undo the business's own pick so they can choose someone else.
 *
 * Reuses the admin unassign primitive (which clears the selection, reopens the
 * card and its tier siblings, and tells SquadHub + the talent), wrapped in the
 * three guards that make it safe for a client to do unaided:
 *
 *  - Once a SquadHub admin has activated the subscription the talent is really
 *    working, so undoing it is an admin decision, not a self-serve one.
 *  - Once the card has been PAID FOR, undoing would leave money collected for
 *    nobody. That needs a refund, so it's refused here and pointed at support.
 *  - An unpaid payment link is cancelled on the way out, so an abandoned
 *    checkout can't be completed for a talent who is no longer selected.
 *
 * Bids that this selection expired for the OTHER talents are revived, so
 * unselecting genuinely returns the card to where it was rather than quietly
 * throwing away everyone's negotiated prices.
 */
export async function businessUnselectRecipient(businessUserId: string, cardId: string) {
  const card = await verifyCardOwnership(businessUserId, cardId);
  const groupCards = await resolveGroupCards(card);

  // Selection lives on the recipient's own tier card, which may not be the one
  // the client opened.
  const selectedCard = groupCards.find((c: any) => c.selected_at);
  if (!selectedCard) throw new AppError(409, 'No talent is selected on this card');

  if ((selectedCard as any).subscription_activated_at) {
    throw new AppError(
      409,
      "This assignment has already been confirmed and is live. Contact support if you need to change it.",
    );
  }

  const selectedCardId = (selectedCard as any).id as string;
  const selectedAt = (selectedCard as any).selected_at as string;

  const { data: paidPayment } = await supabaseAdmin
    .from('card_payments')
    .select('id, squadbooks_invoice_number')
    .eq('card_id', selectedCardId)
    .eq('status', 'paid')
    .maybeSingle();
  if (paidPayment) {
    const invoice = (paidPayment as any).squadbooks_invoice_number as string | null;
    throw new AppError(
      409,
      `You've already paid for this talent${invoice ? ` (invoice ${invoice})` : ''}. Contact support to arrange a change.`,
    );
  }

  // Retire any unpaid link so an abandoned checkout can't be completed later.
  const { data: openPayments } = await supabaseAdmin
    .from('card_payments')
    .select('id, razorpay_payment_link_id')
    .eq('card_id', selectedCardId)
    .eq('status', 'created');
  for (const p of openPayments ?? []) {
    const linkId = (p as any).razorpay_payment_link_id as string | null;
    if (linkId) {
      await cancelPaymentLink(linkId).catch((e) => {
        // Razorpay refuses to cancel an already-paid/expired link. The row is
        // retired either way; a genuinely paid one is caught by the guard above.
        console.error(`[unselect] couldn't cancel link ${linkId}:`, (e as Error).message);
      });
    }
    await supabaseAdmin
      .from('card_payments')
      .update({ status: 'cancelled' })
      .eq('id', (p as any).id as string);
  }

  // The recipient whose bid the selection locked, captured before the undo
  // clears selected_at.
  const { data: pickedRows } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id')
    .eq('card_id', selectedCardId)
    .not('selected_at', 'is', null);
  const pickedIds = (pickedRows ?? []).map((r: any) => r.id as string);

  await adminUndoSelection(selectedCardId);

  // Put the negotiation back where it was.
  //
  // Selecting closes bids two ways: it accepts the chosen talent's, and expires
  // everyone else's. Both are stamped with the selection's own timestamp, so we
  // can reopen exactly those and leave alone any offer the business had settled
  // deliberately beforehand. Without this the client unselects into a dead end:
  // no live bid anywhere, so no way to counter, and everyone silently back at
  // list price.
  //
  // Which side's turn it goes back to is read off last_actor_side — the move
  // that was pending when the selection interrupted it.
  const reopenTurn = (lastActorSide: string | null) =>
    lastActorSide === 'business' || lastActorSide === 'admin' ? 'pending_talent' : 'pending_business';

  // a) the chosen talent's bid, accepted BY this selection
  if (pickedIds.length > 0) {
    const { data: locked } = await supabaseAdmin
      .from('assignment_offers')
      .select('id, last_actor_side')
      .in('recipient_id', pickedIds)
      .eq('status', 'accepted')
      .eq('responded_at', selectedAt);
    for (const o of locked ?? []) {
      await supabaseAdmin
        .from('assignment_offers')
        .update({
          status: reopenTurn(((o as any).last_actor_side as string | null) ?? null),
          responded_at: null,
        })
        .eq('id', (o as any).id as string);
    }
  }

  // b) the rival bids this selection expired
  const { data: expired } = await supabaseAdmin
    .from('assignment_offers')
    .select('id, last_actor_side')
    .eq('card_id', selectedCardId)
    .eq('status', 'expired')
    .eq('responded_at', selectedAt);
  for (const o of expired ?? []) {
    await supabaseAdmin
      .from('assignment_offers')
      .update({
        status: reopenTurn(((o as any).last_actor_side as string | null) ?? null),
        responded_at: null,
      })
      .eq('id', (o as any).id as string);
  }

  return { card_id: selectedCardId, unselected: true };
}
