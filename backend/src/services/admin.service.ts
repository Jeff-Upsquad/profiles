import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import pg from 'pg';
import { env } from '../config/env.js';
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateFieldInput,
  UpdateFieldInput,
  CreateOptionInput,
  UpdateOptionInput,
  ReorderInput,
} from '../validators/admin.validators.js';

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
  return data;
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
    .select('*')
    .eq('profile_id', profileId)
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  return { ...data, portfolio_items: portfolio ?? [] };
}

export async function approveProfile(profileId: string, adminId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', profileId)
    .eq('status', 'pending_review')
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
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
    })
    .eq('id', profileId)
    .eq('status', 'pending_review')
    .select()
    .single();

  if (error) throw new AppError(400, error.message);
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

export async function createTemplateTool(categoryId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_tools')
    .insert({ category_id: categoryId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new AppError(409, 'Tool already exists for this category');
    throw new AppError(500, error.message);
  }
  return data;
}

export async function updateTemplateTool(toolId: string, name: string) {
  const { data, error } = await supabaseAdmin
    .from('template_tools')
    .update({ name })
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

export async function getBusinessUsers() {
  const { data, error } = await supabaseAdmin
    .from('business_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, error.message);
  return data;
}

export async function suspendUser(userId: string, suspend: boolean) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: suspend ? 'none' : undefined,
    user_metadata: { suspended: suspend },
  });

  if (error) throw new AppError(400, error.message);
  return { message: suspend ? 'User suspended' : 'User unsuspended' };
}

export async function deleteUser(userId: string) {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw new AppError(400, error.message);
  return { message: 'User permanently deleted' };
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

export async function restoreProfile(profileId: string) {
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
    .select('*, talent_users!inner(full_name, profile_photo_url, current_location), categories!inner(name, slug)')
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (search) {
    qb = qb.ilike('talent_users.full_name', `%${search}%`);
  }

  const { data, error } = await qb;
  if (error) throw new AppError(500, error.message);
  return data;
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
    .select('*')
    .eq('profile_id', profileId)
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  return { ...data, portfolio_items: portfolio ?? [] };
}

// ---------------------------------------------------------------------------
// Profile Share Links
// ---------------------------------------------------------------------------

async function queryPg<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const client = new pg.Client({
    host: env.DB_HOST,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

export async function createShareLink(profileId: string, adminId: string) {
  const crypto = await import('node:crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const rows = await queryPg(
    `INSERT INTO profile_share_links (profile_id, token, expires_at, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [profileId, token, expiresAt, adminId]
  );

  if (!rows[0]) throw new AppError(500, 'Failed to create share link');
  return rows[0];
}

export async function getShareLinksByProfile(profileId: string) {
  return queryPg(
    `SELECT * FROM profile_share_links WHERE profile_id = $1 ORDER BY created_at DESC`,
    [profileId]
  );
}

export async function getProfileByShareToken(token: string) {
  const rows = await queryPg(
    `SELECT * FROM profile_share_links WHERE token = $1`,
    [token]
  );

  const link = rows[0];
  if (!link) throw new AppError(404, 'Share link not found');

  if (new Date(link.expires_at) < new Date()) {
    throw new AppError(410, 'This share link has expired');
  }

  // Fetch the full profile
  const profile = await getTalentProfile(link.profile_id);

  // Also fetch category fields for display
  const fields = await getCategoryFields(profile.category_id);

  return { profile, fields };
}

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
