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
    .select('*, talent_users!inner(full_name, current_location, languages_spoken, preferred_districts, profile_photo_url), categories!inner(id, name, slug)', { count: 'exact' })
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
    .select('*, talent_users!inner(full_name, current_location, languages_spoken, preferred_districts, profile_photo_url, phone), categories!inner(id, name, slug)')
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
