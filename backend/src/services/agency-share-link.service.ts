import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { getAgencyPublicView, getAgencyMemberPublicView } from './agency-public.service.js';

export interface CreateShareLinkParams {
  categoryId?: string | null;
  expiresAt: string;
}

export async function createShareLink(agencyUserId: string, params: CreateShareLinkParams) {
  const expiresDate = new Date(params.expiresAt);
  if (isNaN(expiresDate.getTime())) {
    throw new AppError(400, 'Invalid expiration date');
  }
  if (expiresDate.getTime() <= Date.now()) {
    throw new AppError(400, 'Expiration date must be in the future');
  }

  // Validate category if provided
  if (params.categoryId) {
    const { data: category } = await supabaseAdmin
      .from('categories')
      .select('id, name')
      .eq('id', params.categoryId)
      .maybeSingle();
    if (!category) {
      throw new AppError(404, 'Category not found');
    }
  }

  // Generate secure 32-character random hex token
  const token = crypto.randomBytes(16).toString('hex');

  const { data, error } = await supabaseAdmin
    .from('agency_share_links')
    .insert({
      agency_user_id: agencyUserId,
      category_id: params.categoryId || null,
      token,
      expires_at: expiresDate.toISOString(),
    })
    .select('id, token, category_id, expires_at, created_at, revoked_at')
    .single();

  if (error || !data) {
    throw new AppError(500, `Failed to create share link: ${error?.message || 'Unknown error'}`);
  }

  return data;
}

export async function listShareLinks(agencyUserId: string, categoryId?: string) {
  let query = supabaseAdmin
    .from('agency_share_links')
    .select('id, token, category_id, expires_at, created_at, revoked_at, categories(id, name, slug)')
    .eq('agency_user_id', agencyUserId)
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;
  if (error) {
    throw new AppError(500, `Failed to list share links: ${error.message}`);
  }

  const now = Date.now();
  return (data || []).map((link: any) => {
    const isExpired = new Date(link.expires_at).getTime() <= now || !!link.revoked_at;
    const category = link.categories || null;
    return {
      id: link.id,
      token: link.token,
      category_id: link.category_id,
      category_name: category?.name || null,
      category_slug: category?.slug || null,
      expires_at: link.expires_at,
      created_at: link.created_at,
      revoked_at: link.revoked_at,
      is_expired: isExpired,
    };
  });
}

export async function revokeShareLink(agencyUserId: string, linkId: string) {
  const { data, error } = await supabaseAdmin
    .from('agency_share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('agency_user_id', agencyUserId)
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

export async function getPublicShareLinkData(token: string) {
  const { data: link, error } = await supabaseAdmin
    .from('agency_share_links')
    .select('id, agency_user_id, category_id, token, expires_at, created_at, revoked_at')
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

  // Load public preview for this agency and category
  const viewData = await getAgencyPublicView(link.agency_user_id, {
    categoryId: link.category_id || undefined,
  });

  return {
    ...viewData,
    share_link: {
      id: link.id,
      token: link.token,
      expires_at: link.expires_at,
      category_id: link.category_id,
      created_at: link.created_at,
    },
  };
}

export async function getPublicShareMemberData(token: string, memberId: string) {
  const { data: link, error } = await supabaseAdmin
    .from('agency_share_links')
    .select('id, agency_user_id, token, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !link) {
    throw new AppError(404, 'Share link not found or invalid');
  }

  if (link.revoked_at) {
    throw new AppError(410, 'This share link has been revoked');
  }

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    throw new AppError(410, 'This share link has expired');
  }

  const memberData = await getAgencyMemberPublicView(link.agency_user_id, memberId);

  return {
    ...memberData,
    share_link: {
      id: link.id,
      token: link.token,
      expires_at: link.expires_at,
    },
  };
}
