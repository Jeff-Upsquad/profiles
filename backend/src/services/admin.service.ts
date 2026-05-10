import { randomInt } from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { env } from '../config/env.js';
import { getTalentTiersByUserIds } from './talent-tier.service.js';
import { isGhostSourceCategory, syncGhostForTalent } from './ghost-profile.service.js';
import * as talentService from './talent.service.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateFieldInput,
  UpdateFieldInput,
  CreateOptionInput,
  UpdateOptionInput,
  ReorderInput,
  AdminUpdateTalentUserInput,
  AdminUpdateTalentProfileInput,
  AdminAddPortfolioItemInput,
} from '../validators/admin.validators.js';
import type { UpdateBasicProfileInput } from '../validators/talent.validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats() {
  const [talentRes, businessRes, profilesRes, pendingRes] = await Promise.all([
    supabaseAdmin.from('talent_users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('business_users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('talent_profiles').select('status, category:categories(name)'),
    supabaseAdmin
      .from('talent_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review'),
  ]);

  // Group profiles by status
  const profilesByStatus: Record<string, number> = {};
  const profilesByCategoryMap: Record<string, number> = {};

  if (profilesRes.data) {
    for (const p of profilesRes.data as any[]) {
      const status = p.status ?? 'unknown';
      profilesByStatus[status] = (profilesByStatus[status] ?? 0) + 1;

      const catName = p.category?.name ?? 'Uncategorized';
      profilesByCategoryMap[catName] = (profilesByCategoryMap[catName] ?? 0) + 1;
    }
  }

  const profilesByCategory = Object.entries(profilesByCategoryMap).map(
    ([category_name, count]) => ({ category_name, count })
  );

  return {
    total_talent_users: talentRes.count ?? 0,
    total_business_users: businessRes.count ?? 0,
    total_profiles: profilesRes.data?.length ?? 0,
    profiles_by_status: profilesByStatus,
    profiles_by_category: profilesByCategory,
    pending_reviews: pendingRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategories() {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, `Failed to fetch categories: ${error.message}`);
  return data;
}

export async function createCategory(input: CreateCategoryInput) {
  const slug = slugify(input.name);

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ ...input, slug })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'A category with this name already exists');
    }
    throw new AppError(500, `Failed to create category: ${error.message}`);
  }

  return data;
}

export async function updateCategory(id: string, input: UpdateCategoryInput) {
  const updates: Record<string, unknown> = { ...input };

  // Regenerate slug if name changed
  if (input.name) {
    updates.slug = slugify(input.name);
  }

  const { data, error } = await supabaseAdmin
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Category not found');
    if (error.code === '23505') throw new AppError(409, 'A category with this name already exists');
    throw new AppError(500, `Failed to update category: ${error.message}`);
  }

  return data;
}

export async function archiveCategory(id: string, is_active: boolean) {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Category not found');
    throw new AppError(500, `Failed to update category: ${error.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Category Fields
// ---------------------------------------------------------------------------

export async function getCategoryFields(categoryId: string) {
  const { data: fields, error } = await supabaseAdmin
    .from('category_fields')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, `Failed to fetch fields: ${error.message}`);

  // For select/multi_select fields, also fetch their options
  const selectFieldIds = (fields ?? [])
    .filter((f: any) => f.field_type === 'select' || f.field_type === 'multi_select')
    .map((f: any) => f.id);

  if (selectFieldIds.length > 0) {
    const { data: options, error: optError } = await supabaseAdmin
      .from('field_options')
      .select('*')
      .in('field_id', selectFieldIds)
      .order('sort_order', { ascending: true });

    if (optError) throw new AppError(500, `Failed to fetch field options: ${optError.message}`);

    // Group options by field_id and attach
    const optionsByField: Record<string, any[]> = {};
    for (const opt of options ?? []) {
      if (!optionsByField[opt.field_id]) optionsByField[opt.field_id] = [];
      optionsByField[opt.field_id].push(opt);
    }

    for (const field of fields as any[]) {
      if (selectFieldIds.includes(field.id)) {
        field.options = optionsByField[field.id] ?? [];
      }
    }
  }

  return fields;
}

export async function createField(categoryId: string, input: CreateFieldInput) {
  const { data, error } = await supabaseAdmin
    .from('category_fields')
    .insert({ ...input, category_id: categoryId })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'A field with this key already exists in this category');
    }
    if (error.code === '23503') {
      throw new AppError(404, 'Category not found');
    }
    throw new AppError(500, `Failed to create field: ${error.message}`);
  }

  return data;
}

export async function updateField(fieldId: string, input: UpdateFieldInput) {
  const { data, error } = await supabaseAdmin
    .from('category_fields')
    .update(input)
    .eq('id', fieldId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Field not found');
    if (error.code === '23505') {
      throw new AppError(409, 'A field with this key already exists in this category');
    }
    throw new AppError(500, `Failed to update field: ${error.message}`);
  }

  return data;
}

export async function deleteField(fieldId: string) {
  const { error } = await supabaseAdmin
    .from('category_fields')
    .delete()
    .eq('id', fieldId);

  if (error) throw new AppError(500, `Failed to delete field: ${error.message}`);

  return { message: 'Field deleted successfully' };
}

export async function reorderFields(input: ReorderInput) {
  // Batch update sort_order for each field
  const updates = input.items.map((item) =>
    supabaseAdmin
      .from('category_fields')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      throw new AppError(500, `Failed to reorder fields: ${result.error.message}`);
    }
  }

  return { message: 'Fields reordered successfully' };
}

// ---------------------------------------------------------------------------
// Field Options
// ---------------------------------------------------------------------------

export async function getFieldOptions(fieldId: string) {
  const { data, error } = await supabaseAdmin
    .from('field_options')
    .select('*')
    .eq('field_id', fieldId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, `Failed to fetch options: ${error.message}`);
  return data;
}

export async function createOption(fieldId: string, input: CreateOptionInput) {
  const { data, error } = await supabaseAdmin
    .from('field_options')
    .insert({ ...input, field_id: fieldId })
    .select()
    .single();

  if (error) {
    if (error.code === '23503') throw new AppError(404, 'Field not found');
    if (error.code === '23505') throw new AppError(409, 'An option with this value already exists');
    throw new AppError(500, `Failed to create option: ${error.message}`);
  }

  return data;
}

export async function updateOption(optionId: string, input: UpdateOptionInput) {
  const { data, error } = await supabaseAdmin
    .from('field_options')
    .update(input)
    .eq('id', optionId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Option not found');
    throw new AppError(500, `Failed to update option: ${error.message}`);
  }

  return data;
}

export async function deleteOption(optionId: string) {
  const { error } = await supabaseAdmin
    .from('field_options')
    .delete()
    .eq('id', optionId);

  if (error) throw new AppError(500, `Failed to delete option: ${error.message}`);

  return { message: 'Option deleted successfully' };
}

// ---------------------------------------------------------------------------
// Profile Reviews
// ---------------------------------------------------------------------------

export async function getReviewQueue(categoryId?: string) {
  let qb = supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name), categories!inner(name, slug)')
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('updated_at', { ascending: true });

  if (categoryId) {
    qb = qb.eq('category_id', categoryId);
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, `Failed to fetch reviews: ${error.message}`);

  const rows = (data ?? []) as any[];
  const tiers = await getTalentTiersByUserIds(
    rows.map((r) => r.talent_user_id).filter(Boolean),
  );
  return rows.map((r) => ({
    ...r,
    tier: tiers[r.talent_user_id]?.tier ?? null,
    tier_custom: tiers[r.talent_user_id]?.tier_custom ?? null,
  }));
}

export async function getReviewProfile(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(*), categories!inner(name, slug)')
    .eq('id', profileId)
    .single();

  if (error) throw new AppError(404, 'Profile not found');

  // Also fetch portfolio items
  const { data: portfolio } = await supabaseAdmin
    .from('portfolio_items')
    .select('*, portfolio_item_skills(skill_name)')
    .eq('profile_id', profileId)
    .order('category_name', { ascending: true })
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  const portfolioWithSkills = (portfolio ?? []).map((row: any) => {
    const { portfolio_item_skills, ...rest } = row;
    return {
      ...rest,
      skills: Array.isArray(portfolio_item_skills)
        ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
        : [],
    };
  });

  // Originating leads (Candidates module). One talent can have multiple lead
  // rows (e.g. creative + accountant form submissions); return all so the UI
  // can show every touchpoint.
  const { data: linkedLeads } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, form_type, status, created_at, utm_source, utm_campaign, profile_type, name')
    .eq('linked_talent_user_id', data.talent_user_id)
    .order('created_at', { ascending: false });

  return { ...data, portfolio_items: portfolioWithSkills, linked_leads: linkedLeads ?? [] };
}

export async function approveProfile(profileId: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
      previous_field_data: null,
    })
    .eq('id', profileId)
    .eq('status', 'pending_review')
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  if (await isGhostSourceCategory(data.category_id)) {
    await syncGhostForTalent(data.talent_user_id);
  }

  return data;
}

export async function rejectProfile(profileId: string, adminId: string, reason: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
      previous_field_data: null,
    })
    .eq('id', profileId)
    .eq('status', 'pending_review')
    .select()
    .single();

  if (error) throw new AppError(400, error.message);

  if (await isGhostSourceCategory(data.category_id)) {
    await syncGhostForTalent(data.talent_user_id);
  }

  return data;
}

export async function bulkApproveProfiles(profileIds: string[], adminId: string) {
  const results = await Promise.all(
    profileIds.map((id) => approveProfile(id, adminId).catch((e) => ({ error: e, id })))
  );
  return results;
}

// ---------------------------------------------------------------------------
// User Approvals
// ---------------------------------------------------------------------------

export async function getPendingApprovals() {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('*')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function approveUser(userId: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('id', userId)
    .eq('approval_status', 'pending')
    .select()
    .single();

  if (error) throw new AppError(400, `Failed to approve user: ${error.message}`);
  return data;
}

export async function rejectUser(userId: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({
      approval_status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('id', userId)
    .eq('approval_status', 'pending')
    .select()
    .single();

  if (error) throw new AppError(400, `Failed to reject user: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Template Skill Sets & Tools
// ---------------------------------------------------------------------------

export async function getTemplateSkills(categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('template_skill_sets')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function createTemplateSkill(categoryId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_skill_sets')
    .insert({ category_id: categoryId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'Skill already exists for this category');
    throw new AppError(500, error.message);
  }
  return data;
}

export async function updateTemplateSkill(skillId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_skill_sets')
    .update({ name })
    .eq('id', skillId)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

export async function deleteTemplateSkill(skillId: string) {
  const { error } = await supabaseAdmin
    .from('template_skill_sets')
    .delete()
    .eq('id', skillId);

  if (error) throw new AppError(400, error.message);
  return { message: 'Skill deleted' };
}

export async function getTemplateTools(categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('template_tools')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function createTemplateTool(
  categoryId: string,
  name: string,
  group?: string | null,
) {
  const { data, error } = await supabaseAdmin
    .from('template_tools')
    .insert({ category_id: categoryId, name, group: group ?? null })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'Tool already exists for this category');
    throw new AppError(500, error.message);
  }
  return data;
}

export async function updateTemplateTool(
  toolId: string,
  name: string,
  group?: string | null,
) {
  const payload: { name: string; group?: string | null } = { name };
  if (group !== undefined) payload.group = group;

  const { data, error } = await supabaseAdmin
    .from('template_tools')
    .update(payload)
    .eq('id', toolId)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

export async function deleteTemplateTool(toolId: string) {
  const { error } = await supabaseAdmin
    .from('template_tools')
    .delete()
    .eq('id', toolId);

  if (error) throw new AppError(400, error.message);
  return { message: 'Tool deleted' };
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export async function getTalentUsers() {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function searchUsers(query: string) {
  const q = query.trim();
  if (q.length < 2) return { talents: [], businesses: [] };

  const escaped = q.replace(/[%,]/g, '\\$&');
  const like = `%${escaped}%`;

  const digits = q.replace(/\D/g, '');
  const digitsLike = digits.length >= 2 ? `%${digits}%` : null;

  const talentFilters = [`full_name.ilike.${like}`, `email.ilike.${like}`];
  if (digitsLike) talentFilters.push(`phone_digits.ilike.${digitsLike}`);

  const businessFilters = [
    `company_name.ilike.${like}`,
    `contact_person_name.ilike.${like}`,
    `contact_email.ilike.${like}`,
  ];
  if (digitsLike) businessFilters.push(`contact_phone_digits.ilike.${digitsLike}`);

  const [talentRes, businessRes] = await Promise.all([
    supabaseAdmin
      .from('admin_talent_search')
      .select('id, full_name, phone, current_location, profile_photo_url, is_active')
      .or(talentFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('admin_business_search')
      .select('id, company_name, contact_person_name, contact_email')
      .or(businessFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (talentRes.error) throw new AppError(500, talentRes.error.message);
  if (businessRes.error) throw new AppError(500, businessRes.error.message);

  return {
    talents: talentRes.data ?? [],
    businesses: businessRes.data ?? [],
  };
}

export async function getBusinessUsers() {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function getUserDetail(userId: string) {
  const { data: talent } = await supabaseAdmin
    .from('talent_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (talent) {
    const [{ data: profiles, error: profErr }, { data: basic }, { data: authData }] =
      await Promise.all([
        supabaseAdmin
          .from('talent_profiles')
          .select('id, category_id, status, is_active, updated_at, created_at, categories(name, slug)')
          .eq('talent_user_id', userId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
        supabaseAdmin
          .from('talent_profiles_basic')
          .select('*')
          .eq('talent_user_id', userId)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(userId),
      ]);

    if (profErr) throw new AppError(500, profErr.message);
    return {
      kind: 'talent' as const,
      user: { ...talent, email: authData?.user?.email ?? null },
      basic: basic ?? null,
      profiles: profiles ?? [],
    };
  }

  const { data: business } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (business) {
    const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userId);
    return {
      kind: 'business' as const,
      user: { ...business, email: authData?.user?.email ?? business.contact_email ?? null },
    };
  }

  throw new AppError(404, 'User not found');
}

export async function extendBusinessAccess(
  businessUserId: string,
  input: { days?: number; expiresAt?: string }
) {
  if (input.days == null && !input.expiresAt) {
    throw new AppError(400, 'Either days or expiresAt is required');
  }

  let newExpiry: Date;
  if (input.expiresAt) {
    newExpiry = new Date(input.expiresAt);
    if (Number.isNaN(newExpiry.getTime())) {
      throw new AppError(400, 'Invalid expiresAt');
    }
  } else {
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('business_users')
      .select('access_expires_at')
      .eq('id', businessUserId)
      .single();

    if (fetchError) throw new AppError(404, 'Business user not found');

    const baseDate =
      user.access_expires_at && new Date(user.access_expires_at) > new Date()
        ? new Date(user.access_expires_at)
        : new Date();
    newExpiry = new Date(baseDate.getTime() + input.days! * 24 * 60 * 60 * 1000);
  }

  const { error } = await supabaseAdmin
    .from('business_users')
    .update({
      access_expires_at: newExpiry.toISOString(),
      access_requested_at: null,
    })
    .eq('id', businessUserId);

  if (error) throw new AppError(400, error.message);

  return {
    message: input.expiresAt
      ? 'Access expiry updated'
      : `Access extended by ${input.days} days`,
    access_expires_at: newExpiry.toISOString(),
  };
}

export async function suspendUser(userId: string, suspend: boolean) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? 'none' : undefined,
    user_metadata: { suspended: suspend },
  });

  if (error) throw new AppError(400, error.message);
  return { message: suspend ? 'User suspended' : 'User unsuspended' };
}

// Set tier on a single talent profile from the Talents admin UI.
export async function setProfileTier(
  profileId: string,
  tier: 'junior' | 'pro' | 'elite' | 'custom' | null,
  tier_custom: string | null,
) {
  const finalCustom = tier === 'custom' ? tier_custom : null;

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ tier, tier_custom: finalCustom })
    .eq('id', profileId)
    .is('deleted_at', null)
    .select('id');

  if (error) throw new AppError(500, error.message);
  if (!data?.length) throw new AppError(404, 'Profile not found');

  return {
    tier,
    tier_custom: finalCustom,
    updated_profile_count: data.length,
  };
}

// Flip talent_profiles.is_active. Touches ONLY is_active — never status —
// so admin reactivation does not force re-approval. (Talent self-service
// deactivateProfile/reactivateProfile in talent.service.ts intentionally
// couples is_active with status; admin must not.)
export async function setProfileActive(profileId: string, isActive: boolean) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)
    .is('deleted_at', null)
    .select('id, is_active, status')
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');
  return { id: data.id, is_active: data.is_active, status: data.status };
}

export async function setTalentUserActive(userId: string, isActive: boolean) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('id, is_active')
    .single();

  if (error || !data) throw new AppError(404, 'Talent user not found');
  return { id: data.id, is_active: data.is_active };
}

export async function deleteUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new AppError(400, error.message);
  return { message: 'User permanently deleted' };
}

export async function resetUserPassword(userId: string) {
  const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getErr || !existing?.user) throw new AppError(404, 'User not found');

  const tempPassword = generateTempPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: {
      ...(existing.user.user_metadata ?? {}),
      must_reset_password: true,
    },
  });

  if (error) throw new AppError(400, error.message);
  return {
    temp_password: tempPassword,
    message: 'Password reset. Share this temporary password with the user.',
  };
}

function generateTempPassword(length = 12): string {
  // Omit visually ambiguous chars (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < length; i++) {
    pw += chars[randomInt(0, chars.length)];
  }
  return pw;
}

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------

export async function getRecycleBin() {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name), categories!inner(name)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function restoreProfile(profileId: string, replaceProfileId?: string) {
  const { data: archived, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name), categories!inner(name)')
    .eq('id', profileId)
    .not('deleted_at', 'is', null)
    .single();

  if (fetchErr || !archived) throw new AppError(404, 'Archived profile not found');

  const { data: existing } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name), categories!inner(name)')
    .eq('talent_user_id', archived.talent_user_id)
    .eq('category_id', archived.category_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing && !replaceProfileId) {
    return { conflict: true, archived, existing };
  }

  if (existing && replaceProfileId) {
    const { error: archiveErr } = await supabaseAdmin
      .from('talent_profiles')
      .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
      .eq('id', replaceProfileId)
      .is('deleted_at', null);

    if (archiveErr) throw new AppError(500, 'Failed to archive the replaced profile');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({
      deleted_at: null,
      status: 'pending_review',
    })
    .eq('id', profileId)
    .not('deleted_at', 'is', null)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

// Admin updates a talent_user row. Plain update — no status side-effects.
export async function adminUpdateTalentUser(userId: string, input: AdminUpdateTalentUserInput) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update(input)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) throw new AppError(404, 'Talent user not found');
  return data;
}

// Admin updates a talent_profiles_basic row. Delegates to talentService which
// upserts and syncs profile_picture_url to talent_users — same logic as the
// talent's own self-edit, no approval-status side-effects.
export async function adminUpdateBasicProfile(userId: string, input: UpdateBasicProfileInput) {
  return talentService.updateBasicProfile(userId, input);
}

// Admin updates a talent_profile's field_data / resume_url. Crucially does
// NOT change `status` — talent's own updateProfile bumps approved→pending_review,
// but admin edits are trusted and stay in place.
export async function adminUpdateTalentProfile(
  profileId: string,
  input: AdminUpdateTalentProfileInput,
) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id, category_id')
    .eq('id', profileId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  const updatePayload: Record<string, unknown> = {};
  if (input.field_data !== undefined) updatePayload.field_data = input.field_data;
  if (input.resume_url !== undefined) updatePayload.resume_url = input.resume_url;

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError(400, 'Nothing to update');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update(updatePayload)
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to update profile: ${error.message}`);
  return data;
}

// Admin reads portfolio items for any profile (no user-ownership filter).
export async function adminGetPortfolioItems(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('*')
    .eq('profile_id', profileId)
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch portfolio items');
  return data;
}

// Admin adds a portfolio item on behalf of a talent. Resolves the talent's
// user id and delegates to talentService.addPortfolioItem so we share the
// link/upload validation logic.
export async function adminAddPortfolioItem(
  profileId: string,
  input: AdminAddPortfolioItemInput,
) {
  const { data: profile, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .eq('id', profileId)
    .is('deleted_at', null)
    .single();

  if (error || !profile) throw new AppError(404, 'Profile not found');

  return talentService.addPortfolioItem(profileId, profile.talent_user_id, input);
}

export async function adminReviewPortfolioItem(
  profileId: string,
  itemId: string,
  input: { admin_is_active?: boolean; admin_comment?: string | null },
) {
  if (input.admin_is_active === undefined && input.admin_comment === undefined) {
    throw new AppError(400, 'Nothing to update');
  }

  const updates: Record<string, unknown> = {};
  if (input.admin_is_active !== undefined) updates.admin_is_active = input.admin_is_active;
  if (input.admin_comment !== undefined) updates.admin_comment = input.admin_comment;

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .update(updates)
    .eq('id', itemId)
    .eq('profile_id', profileId)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Portfolio item not found');
  return data;
}

export async function adminDeletePortfolioItem(profileId: string, itemId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .eq('id', profileId)
    .is('deleted_at', null)
    .single();

  if (error || !profile) throw new AppError(404, 'Profile not found');

  return talentService.deletePortfolioItem(profileId, profile.talent_user_id, itemId);
}

export async function adminSoftDeleteProfile(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', profileId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found or already deleted');
  return { message: 'Profile moved to recycle bin' };
}

export async function permanentlyDeleteProfile(profileId: string) {
  const { error } = await supabaseAdmin
    .from('talent_profiles')
    .delete()
    .eq('id', profileId)
    .not('deleted_at', 'is', null);

  if (error) throw new AppError(400, error.message);
  return { message: 'Profile permanently deleted' };
}

// ---------------------------------------------------------------------------
// Template AI Tools
// ---------------------------------------------------------------------------

export async function getTemplateAiTools(categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('template_ai_tools')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function createTemplateAiTool(categoryId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_ai_tools')
    .insert({ category_id: categoryId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'AI tool already exists for this category');
    throw new AppError(500, error.message);
  }
  return data;
}

export async function updateTemplateAiTool(toolId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_ai_tools')
    .update({ name })
    .eq('id', toolId)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

export async function deleteTemplateAiTool(toolId: string) {
  const { error } = await supabaseAdmin
    .from('template_ai_tools')
    .delete()
    .eq('id', toolId);

  if (error) throw new AppError(400, error.message);
  return { message: 'AI tool deleted' };
}

// ---------------------------------------------------------------------------
// Template Portfolio Categories (genres per parent category)
// ---------------------------------------------------------------------------

export async function getTemplateCategories(categoryId: string) {
  const { data, error } = await supabaseAdmin
    .from('template_categories')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function createTemplateCategory(categoryId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_categories')
    .insert({ category_id: categoryId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'Category already exists for this category');
    throw new AppError(500, error.message);
  }
  return data;
}

export async function updateTemplateCategory(id: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
  return data;
}

export async function deleteTemplateCategory(id: string) {
  const { error } = await supabaseAdmin
    .from('template_categories')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(400, error.message);
  return { message: 'Category deleted' };
}

// ---------------------------------------------------------------------------
// Talents Module (browse approved profiles by category)
// ---------------------------------------------------------------------------

export async function getTalentCategories() {
  const { data: categories, error: catErr } = await supabaseAdmin
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (catErr) throw new AppError(500, catErr.message);

  // Get profile counts per category (non-deleted only)
  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('category_id, status')
    .is('deleted_at', null);

  if (profErr) throw new AppError(500, profErr.message);

  const countMap: Record<string, { total: number; approved: number }> = {};
  for (const p of profiles ?? []) {
    if (!countMap[p.category_id]) countMap[p.category_id] = { total: 0, approved: 0 };
    countMap[p.category_id].total++;
    if (p.status === 'approved') countMap[p.category_id].approved++;
  }

  return (categories ?? []).map((cat) => ({
    ...cat,
    profile_count: countMap[cat.id]?.total ?? 0,
    approved_count: countMap[cat.id]?.approved ?? 0,
  }));
}

export async function getTalentProfilesByCategory(categoryId: string, search?: string) {
  let qb = supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(full_name, profile_photo_url, current_location, is_active), categories!inner(name, slug)')
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    qb = qb.ilike('talent_users.full_name', `%${search}%`);
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);

  const rows = (data ?? []) as any[];
  const userIds = rows.map((r) => r.talent_user_id).filter(Boolean);
  const tiers = await getTalentTiersByUserIds(userIds);

  // Geography filter / breakdown reads structured location from
  // talent_profiles_basic (country/state). Fold those into each row so the
  // admin UI can prefer them over parsing the freeform current_location.
  const basicMap = new Map<string, { country: string | null; state: string | null }>();
  if (userIds.length > 0) {
    const { data: basicRows, error: basicErr } = await supabaseAdmin
      .from('talent_profiles_basic')
      .select('talent_user_id, country, state')
      .in('talent_user_id', userIds);
    if (basicErr) throw new AppError(500, basicErr.message);
    for (const b of basicRows ?? []) {
      basicMap.set((b as any).talent_user_id, {
        country: ((b as any).country as string | null) ?? null,
        state: ((b as any).state as string | null) ?? null,
      });
    }
  }

  return rows.map((r) => {
    const basic = basicMap.get(r.talent_user_id) ?? null;
    return {
      ...r,
      tier: tiers[r.talent_user_id]?.tier ?? null,
      tier_custom: tiers[r.talent_user_id]?.tier_custom ?? null,
      basic_country: basic?.country ?? null,
      basic_state: basic?.state ?? null,
    };
  });
}

export async function getTalentProfile(profileId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, talent_users!inner(*), categories!inner(name, slug)')
    .eq('id', profileId)
    .single();

  if (error) throw new AppError(404, 'Profile not found');

  // Also fetch portfolio items
  const { data: portfolio } = await supabaseAdmin
    .from('portfolio_items')
    .select('*, portfolio_item_skills(skill_name)')
    .eq('profile_id', profileId)
    .order('category_name', { ascending: true })
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  const portfolioWithSkills = (portfolio ?? []).map((row: any) => {
    const { portfolio_item_skills, ...rest } = row;
    return {
      ...rest,
      skills: Array.isArray(portfolio_item_skills)
        ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
        : [],
    };
  });

  const { data: linkedLeads } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, form_type, status, created_at, utm_source, utm_campaign, profile_type, name')
    .eq('linked_talent_user_id', data.talent_user_id)
    .order('created_at', { ascending: false });

  // Ghost profiles carry no field_data of their own. Embed the two source
  // profiles (Designer + Video Editor) and their portfolios so the admin
  // detail view can render the combined "Designer + Editor" listing.
  if ((data as any).is_ghost === true) {
    const designerId = (data as any).source_designer_profile_id as string | null;
    const editorId = (data as any).source_editor_profile_id as string | null;
    const ids = [designerId, editorId].filter((v): v is string => !!v);
    if (ids.length > 0) {
      const [{ data: sources, error: srcErr }, { data: srcPortfolio, error: pfErr }] =
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
      for (const row of (srcPortfolio ?? []) as any[]) {
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
        tier: p.tier ?? null,
        tier_custom: p.tier_custom ?? null,
        field_data: p.field_data,
        created_at: p.created_at,
        updated_at: p.updated_at,
        portfolio_items: portfolioByProfile[p.id] ?? [],
      }));
      sourceProfiles.sort((a, b) =>
        a.category?.slug === 'designer' ? -1 : b.category?.slug === 'designer' ? 1 : 0,
      );

      return {
        ...data,
        portfolio_items: portfolioWithSkills,
        linked_leads: linkedLeads ?? [],
        source_profiles: sourceProfiles,
      };
    }
  }

  return { ...data, portfolio_items: portfolioWithSkills, linked_leads: linkedLeads ?? [] };
}

// ---------------------------------------------------------------------------
// Business Subscriptions (Category Assignments)
// ---------------------------------------------------------------------------

export async function getBusinessSubscriptions(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_category_subscriptions')
    .select('*, categories(id, name, slug, description, icon_url)')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: true });

  if (error) throw new AppError(500, error.message);
  return (data ?? []).map((s: any) => ({
    id: s.id,
    business_user_id: s.business_user_id,
    category_id: s.category_id,
    assigned_by: s.assigned_by,
    created_at: s.created_at,
    category: s.categories,
  }));
}

export async function assignCategories(
  businessUserId: string,
  categoryIds: string[],
  adminId: string
) {
  await supabaseAdmin
    .from('business_category_subscriptions')
    .delete()
    .eq('business_user_id', businessUserId);

  if (categoryIds.length === 0) return [];

  const rows = categoryIds.map((categoryId) => ({
    business_user_id: businessUserId,
    category_id: categoryId,
    assigned_by: adminId,
  }));

  const { data, error } = await supabaseAdmin
    .from('business_category_subscriptions')
    .insert(rows)
    .select('*, categories(id, name, slug, description, icon_url)');

  if (error) throw new AppError(400, error.message);

  return (data ?? []).map((s: any) => ({
    id: s.id,
    business_user_id: s.business_user_id,
    category_id: s.category_id,
    assigned_by: s.assigned_by,
    created_at: s.created_at,
    category: s.categories,
  }));
}

export async function removeCategory(businessUserId: string, categoryId: string) {
  const { error } = await supabaseAdmin
    .from('business_category_subscriptions')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId);

  if (error) throw new AppError(400, error.message);
}

// ---------------------------------------------------------------------------
// Business Shared Profiles
// ---------------------------------------------------------------------------

export async function getBusinessSharedProfiles(businessUserId: string, categoryId?: string) {
  let qb = supabaseAdmin
    .from('business_shared_profiles')
    .select('*, talent_profiles(*, talent_users(full_name, current_location, languages_spoken, profile_photo_url), categories(id, name, slug))')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: false });

  if (categoryId) {
    qb = qb.eq('category_id', categoryId);
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);

  const rows = (data ?? []) as any[];
  const tiers = await getTalentTiersByUserIds(
    rows.map((sp) => sp.talent_profiles?.talent_user_id).filter(Boolean),
  );

  return rows.map((sp) => {
    const userId = sp.talent_profiles?.talent_user_id;
    const t = userId ? tiers[userId] : undefined;
    return {
      id: sp.id,
      business_user_id: sp.business_user_id,
      talent_profile_id: sp.talent_profile_id,
      category_id: sp.category_id,
      shared_by: sp.shared_by,
      created_at: sp.created_at,
      profile: sp.talent_profiles ? {
        id: sp.talent_profiles.id,
        talent_user_id: sp.talent_profiles.talent_user_id,
        category_id: sp.talent_profiles.category_id,
        category: sp.talent_profiles.categories,
        status: sp.talent_profiles.status,
        field_data: sp.talent_profiles.field_data,
        talent_user: sp.talent_profiles.talent_users,
        created_at: sp.talent_profiles.created_at,
        tier: t?.tier ?? null,
        tier_custom: t?.tier_custom ?? null,
      } : null,
    };
  });
}

export async function shareProfiles(
  businessUserId: string,
  profileIds: string[],
  categoryId: string,
  adminId: string
) {
  await supabaseAdmin
    .from('business_shared_profiles')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('category_id', categoryId);

  if (profileIds.length === 0) return [];

  const rows = profileIds.map((profileId) => ({
    business_user_id: businessUserId,
    talent_profile_id: profileId,
    category_id: categoryId,
    shared_by: adminId,
  }));

  const { data, error } = await supabaseAdmin
    .from('business_shared_profiles')
    .insert(rows)
    .select();

  if (error) throw new AppError(400, error.message);
  return data ?? [];
}

export async function unshareProfile(businessUserId: string, profileId: string) {
  const { error } = await supabaseAdmin
    .from('business_shared_profiles')
    .delete()
    .eq('business_user_id', businessUserId)
    .eq('talent_profile_id', profileId);

  if (error) throw new AppError(400, error.message);
}

// ---------------------------------------------------------------------------
// Reorder Options
// ---------------------------------------------------------------------------

export async function reorderOptions(input: ReorderInput) {
  const updates = input.items.map((item) =>
    supabaseAdmin
      .from('field_options')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);

  for (const result of results) {
    if (result.error) {
      throw new AppError(500, `Failed to reorder options: ${result.error.message}`);
    }
  }

  return { message: 'Options reordered successfully' };
}

// ---------------------------------------------------------------------------
// Shortlist Tracking
// ---------------------------------------------------------------------------

export async function getShortlistTracking(categoryId?: string) {
  let qb = supabaseAdmin
    .from('shortlists')
    .select(
      '*, business_users!inner(id, company_name, contact_person_name, contact_email), talent_profiles!inner(id, category_id, talent_user_id, talent_users!inner(id, full_name), categories!inner(id, name))'
    )
    .order('created_at', { ascending: false });

  if (categoryId) {
    qb = qb.eq('talent_profiles.category_id', categoryId);
  }

  const { data, error } = await qb;

  if (error) throw new AppError(500, `Failed to fetch shortlists: ${error.message}`);

  const rows = (data ?? []) as any[];
  const tiers = await getTalentTiersByUserIds(
    rows
      .map((s) => s.talent_profiles?.talent_users?.id ?? s.talent_profiles?.talent_user_id)
      .filter(Boolean),
  );

  return rows.map((s) => {
    const userId = s.talent_profiles?.talent_users?.id ?? s.talent_profiles?.talent_user_id;
    const t = userId ? tiers[userId] : undefined;
    return {
      id: s.id,
      business_user_id: s.business_user_id,
      company_name: s.business_users.company_name,
      contact_person_name: s.business_users.contact_person_name,
      contact_email: s.business_users.contact_email,
      talent_profile_id: s.talent_profile_id,
      talent_name: s.talent_profiles?.talent_users?.full_name ?? 'Unknown',
      category_id: s.talent_profiles?.category_id,
      category_name: s.talent_profiles?.categories?.name ?? 'Uncategorized',
      shortlisted_at: s.created_at,
      tier: t?.tier ?? null,
      tier_custom: t?.tier_custom ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin Settings (key/value)
// ---------------------------------------------------------------------------

export async function getAdminSetting<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw new AppError(500, `Failed to read setting "${key}": ${error.message}`);
  return (data?.value as T) ?? null;
}

export async function setAdminSetting(key: string, value: unknown, adminId: string) {
  const { error } = await supabaseAdmin
    .from('admin_settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });

  if (error) throw new AppError(500, `Failed to update setting "${key}": ${error.message}`);
}

export async function bulkApprovePendingUsers(adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId,
    })
    .eq('approval_status', 'pending')
    .select('id');

  if (error) throw new AppError(500, `Failed to bulk-approve pending users: ${error.message}`);
  return { approvedCount: data?.length ?? 0 };
}
