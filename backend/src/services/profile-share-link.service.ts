import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { getTalentProfile, getCategoryFields } from './admin.service.js';

export interface CreateProfileShareLinkParams {
  expiresAt: string;
}

export async function createShareLink(
  profileId: string,
  createdBy: string | null,
  params: CreateProfileShareLinkParams,
) {
  const expiresDate = new Date(params.expiresAt);
  if (isNaN(expiresDate.getTime())) {
    throw new AppError(400, 'Invalid expiration date');
  }
  if (expiresDate.getTime() <= Date.now()) {
    throw new AppError(400, 'Expiration date must be in the future');
  }

  // Verify profile exists
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (profileErr || !profile) {
    throw new AppError(404, 'Profile not found');
  }

  // Generate secure 32-character random hex token
  const token = crypto.randomBytes(16).toString('hex');

  const { data, error } = await supabaseAdmin
    .from('profile_share_links')
    .insert({
      profile_id: profileId,
      created_by: createdBy,
      token,
      expires_at: expiresDate.toISOString(),
    })
    .select('id, token, profile_id, expires_at, created_at, revoked_at')
    .single();

  if (error || !data) {
    throw new AppError(500, `Failed to create share link: ${error?.message || 'Unknown error'}`);
  }

  return data;
}

export async function listShareLinks(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('profile_share_links')
    .select('id, token, profile_id, expires_at, created_at, revoked_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(500, `Failed to list share links: ${error.message}`);
  }

  const now = Date.now();
  return (data || []).map((link) => {
    const isExpired = new Date(link.expires_at).getTime() <= now || !!link.revoked_at;
    return {
      ...link,
      is_expired: isExpired,
    };
  });
}

export async function revokeShareLink(profileId: string, linkId: string) {
  const { data, error } = await supabaseAdmin
    .from('profile_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('profile_id', profileId)
    .select('id, revoked_at')
    .maybeSingle();

  if (error) {
    throw new AppError(500, `Failed to revoke share link: ${error.message}`);
  }
  if (!data) {
    throw new AppError(404, 'Share link not found');
  }

  return { success: true, id: data.id, revoked_at: data.revoked_at };
}

export async function getPublicProfileShareData(token: string) {
  const { data: link, error } = await supabaseAdmin
    .from('profile_share_links')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error || !link) {
    throw new AppError(404, 'Share link not found or invalid');
  }

  if (link.revoked_at) {
    throw new AppError(410, 'This share link has been revoked');
  }

  const isExpired = new Date(link.expires_at).getTime() <= Date.now();
  if (isExpired) {
    throw new AppError(410, 'This share link has expired');
  }

  // Fetch full profile data
  const profileData = await getTalentProfile(link.profile_id);

  // Fetch category fields
  let fields: any[] = [];
  if (profileData.category_id) {
    fields = await getCategoryFields(profileData.category_id);
  }

  // For ghost profiles, load source category fields
  const sourceFieldsMap: Record<string, any[]> = {};
  if (profileData.is_ghost && profileData.source_profiles?.length) {
    for (const src of profileData.source_profiles) {
      if (src.category_id && !sourceFieldsMap[src.category_id]) {
        sourceFieldsMap[src.category_id] = await getCategoryFields(src.category_id);
      }
    }
  }

  // Sanitized talent user info (exclude phone, native place, etc.)
  const talentUser = {
    full_name: profileData.talent_users?.full_name ?? 'Talent',
    current_location: profileData.talent_users?.current_location ?? null,
    profile_photo_url: profileData.talent_users?.profile_photo_url ?? null,
    languages_spoken: profileData.talent_users?.languages_spoken ?? [],
    age: profileData.talent_users?.age ?? null,
    gender: profileData.talent_users?.gender ?? null,
  };

  // Only active portfolio items for public view
  const visiblePortfolioItems = (profileData.portfolio_items ?? []).filter(
    (item: any) => item.admin_is_active !== false,
  );

  const visibleSourceProfiles = (profileData.source_profiles ?? []).map((src: any) => ({
    ...src,
    portfolio_items: (src.portfolio_items ?? []).filter(
      (item: any) => item.admin_is_active !== false,
    ),
  }));

  return {
    share_link: {
      id: link.id,
      token: link.token,
      expires_at: link.expires_at,
      created_at: link.created_at,
    },
    profile: {
      id: profileData.id,
      category_id: profileData.category_id,
      status: profileData.status,
      field_data: profileData.field_data ?? {},
      tier: profileData.tier ?? null,
      tier_custom: profileData.tier_custom ?? null,
      created_at: profileData.created_at,
      updated_at: profileData.updated_at,
      is_ghost: profileData.is_ghost ?? false,
      source_profiles: visibleSourceProfiles,
    },
    talent_user: talentUser,
    category: {
      id: profileData.categories?.id ?? profileData.category_id,
      name: profileData.categories?.name ?? 'Profile',
      slug: profileData.categories?.slug ?? '',
      fields,
    },
    portfolio_items: visiblePortfolioItems,
    source_fields_map: sourceFieldsMap,
  };
}
