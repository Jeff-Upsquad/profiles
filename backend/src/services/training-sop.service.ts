/**
 * Training SOPs — Systems & Procedures wiki (admin authoring + talent reader).
 */
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import {
  resolveTalentIdsByJobProfiles,
  type ShareCourseInput,
} from './training-assignments.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SopStatus = 'draft' | 'published' | 'archived';
export type SopBlockType = 'text' | 'image' | 'video_embed' | 'pdf';

export interface CreateSopInput {
  title: string;
  summary?: string;
  icon?: string;
  cover_image_url?: string;
  available_to_all?: boolean;
  sort_order?: number;
  category_ids?: string[];
  status?: SopStatus;
}

export interface UpdateSopInput {
  title?: string;
  summary?: string | null;
  icon?: string | null;
  cover_image_url?: string | null;
  available_to_all?: boolean;
  sort_order?: number;
  category_ids?: string[];
  status?: SopStatus;
}

export interface CreatePageInput {
  title: string;
  parent_page_id?: string | null;
  icon?: string | null;
  position?: number;
  is_active?: boolean;
}

export interface UpdatePageInput {
  title?: string;
  parent_page_id?: string | null;
  icon?: string | null;
  position?: number;
  is_active?: boolean;
}

export interface CreateBlockInput {
  type: SopBlockType;
  position?: number;
  text_content?: unknown;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown>;
}

export type UpdateBlockInput = Partial<CreateBlockInput>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadSop(id: string) {
  const { data, error } = await supabaseAdmin
    .from('training_sops')
    .select('*, training_sop_categories(category_id, categories(id, name, slug))')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'SOP not found');
    throw new AppError(500, `Failed to fetch SOP: ${error.message}`);
  }
  return shapeSop(data);
}

function shapeSop(row: any) {
  return {
    ...row,
    categories: (row.training_sop_categories ?? []).map((c: any) => c.categories).filter(Boolean),
    training_sop_categories: undefined,
  };
}

async function replaceSopCategories(sopId: string, categoryIds: string[]) {
  const { error: delErr } = await supabaseAdmin
    .from('training_sop_categories')
    .delete()
    .eq('sop_id', sopId);
  if (delErr) throw new AppError(500, `Failed to clear categories: ${delErr.message}`);
  if (categoryIds.length === 0) return;
  const { error } = await supabaseAdmin.from('training_sop_categories').insert(
    categoryIds.map((category_id) => ({ sop_id: sopId, category_id })),
  );
  if (error) throw new AppError(500, `Failed to set categories: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Admin — SOPs
// ---------------------------------------------------------------------------

export async function listSops() {
  const { data, error } = await supabaseAdmin
    .from('training_sops')
    .select('*, training_sop_categories(category_id, categories(id, name, slug))')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to list SOPs: ${error.message}`);
  return (data ?? []).map(shapeSop);
}

export async function getSop(id: string) {
  return loadSop(id);
}

export async function createSop(input: CreateSopInput, createdBy?: string | null) {
  const { category_ids = [], ...rest } = input;
  const { data, error } = await supabaseAdmin
    .from('training_sops')
    .insert({
      title: rest.title,
      summary: rest.summary ?? null,
      icon: rest.icon ?? null,
      cover_image_url: rest.cover_image_url ?? null,
      available_to_all: rest.available_to_all ?? false,
      sort_order: rest.sort_order ?? 0,
      status: rest.status ?? 'draft',
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw new AppError(500, `Failed to create SOP: ${error.message}`);

  if (category_ids.length > 0) await replaceSopCategories(data.id, category_ids);

  // Seed a default home page so the editor is never empty
  await supabaseAdmin.from('training_sop_pages').insert({
    sop_id: data.id,
    title: 'Overview',
    position: 0,
    is_active: true,
  });

  return loadSop(data.id);
}

export async function updateSop(id: string, input: UpdateSopInput) {
  const { category_ids, ...rest } = input;
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) patch[k] = v;
  }
  if (patch.status === 'published' && !('published_at' in patch)) {
    // set published_at only if not already set
    const { data: cur } = await supabaseAdmin
      .from('training_sops')
      .select('published_at')
      .eq('id', id)
      .single();
    if (!cur?.published_at) patch.published_at = new Date().toISOString();
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from('training_sops').update(patch).eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'SOP not found');
      throw new AppError(500, `Failed to update SOP: ${error.message}`);
    }
  }
  if (category_ids) await replaceSopCategories(id, category_ids);
  return loadSop(id);
}

export async function archiveSop(id: string) {
  const { error } = await supabaseAdmin
    .from('training_sops')
    .update({ deleted_at: new Date().toISOString(), status: 'archived' })
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to archive SOP: ${error.message}`);
  return { message: 'SOP archived' };
}

// ---------------------------------------------------------------------------
// Admin — Pages
// ---------------------------------------------------------------------------

export async function listPages(sopId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_sop_pages')
    .select('*')
    .eq('sop_id', sopId)
    .order('position', { ascending: true });
  if (error) throw new AppError(500, `Failed to list pages: ${error.message}`);
  return data ?? [];
}

export async function createPage(sopId: string, input: CreatePageInput) {
  await loadSop(sopId); // 404 if missing
  if (input.parent_page_id) {
    const { data: parent } = await supabaseAdmin
      .from('training_sop_pages')
      .select('id, sop_id')
      .eq('id', input.parent_page_id)
      .single();
    if (!parent || parent.sop_id !== sopId) {
      throw new AppError(400, 'parent_page_id must belong to this SOP');
    }
  }
  const { data, error } = await supabaseAdmin
    .from('training_sop_pages')
    .insert({
      sop_id: sopId,
      title: input.title,
      parent_page_id: input.parent_page_id ?? null,
      icon: input.icon ?? null,
      position: input.position ?? 0,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error) throw new AppError(500, `Failed to create page: ${error.message}`);
  return data;
}

export async function updatePage(pageId: string, input: UpdatePageInput) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    const { data } = await supabaseAdmin.from('training_sop_pages').select('*').eq('id', pageId).single();
    if (!data) throw new AppError(404, 'Page not found');
    return data;
  }
  const { data, error } = await supabaseAdmin
    .from('training_sop_pages')
    .update(patch)
    .eq('id', pageId)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Page not found');
    throw new AppError(500, `Failed to update page: ${error.message}`);
  }
  return data;
}

export async function deletePage(pageId: string) {
  const { error } = await supabaseAdmin.from('training_sop_pages').delete().eq('id', pageId);
  if (error) throw new AppError(500, `Failed to delete page: ${error.message}`);
  return { message: 'Page deleted' };
}

export async function reorderPages(items: { id: string; position: number; parent_page_id?: string | null }[]) {
  for (const item of items) {
    const patch: Record<string, unknown> = { position: item.position };
    if (item.parent_page_id !== undefined) patch.parent_page_id = item.parent_page_id;
    const { error } = await supabaseAdmin
      .from('training_sop_pages')
      .update(patch)
      .eq('id', item.id);
    if (error) throw new AppError(500, `Failed to reorder pages: ${error.message}`);
  }
  return { message: 'Pages reordered' };
}

// ---------------------------------------------------------------------------
// Admin — Blocks
// ---------------------------------------------------------------------------

export async function listBlocks(pageId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_sop_blocks')
    .select('*')
    .eq('page_id', pageId)
    .order('position', { ascending: true });
  if (error) throw new AppError(500, `Failed to list blocks: ${error.message}`);
  return data ?? [];
}

export async function createBlock(pageId: string, input: CreateBlockInput) {
  const { data: page } = await supabaseAdmin
    .from('training_sop_pages')
    .select('id')
    .eq('id', pageId)
    .maybeSingle();
  if (!page) throw new AppError(404, 'Page not found');

  const { data, error } = await supabaseAdmin
    .from('training_sop_blocks')
    .insert({
      page_id: pageId,
      type: input.type,
      position: input.position ?? 0,
      text_content: input.text_content ?? null,
      file_url: input.file_url ?? null,
      file_name: input.file_name ?? null,
      file_size: input.file_size ?? null,
      mime_type: input.mime_type ?? null,
      embed_url: input.embed_url ?? null,
      embed_provider: input.embed_provider ?? null,
      caption: input.caption ?? null,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();
  if (error) throw new AppError(500, `Failed to create block: ${error.message}`);
  return data;
}

export async function updateBlock(blockId: string, input: UpdateBlockInput) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  const { data, error } = await supabaseAdmin
    .from('training_sop_blocks')
    .update(patch)
    .eq('id', blockId)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Block not found');
    throw new AppError(500, `Failed to update block: ${error.message}`);
  }
  return data;
}

export async function deleteBlock(blockId: string) {
  const { error } = await supabaseAdmin.from('training_sop_blocks').delete().eq('id', blockId);
  if (error) throw new AppError(500, `Failed to delete block: ${error.message}`);
  return { message: 'Block deleted' };
}

export async function reorderBlocks(items: { id: string; position: number }[]) {
  for (const item of items) {
    const { error } = await supabaseAdmin
      .from('training_sop_blocks')
      .update({ position: item.position })
      .eq('id', item.id);
    if (error) throw new AppError(500, `Failed to reorder blocks: ${error.message}`);
  }
  return { message: 'Blocks reordered' };
}

export async function getPageWithBlocks(pageId: string) {
  const { data: page, error } = await supabaseAdmin
    .from('training_sop_pages')
    .select('*')
    .eq('id', pageId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Page not found');
    throw new AppError(500, `Failed to fetch page: ${error.message}`);
  }
  const blocks = await listBlocks(pageId);
  return { ...page, blocks };
}

// ---------------------------------------------------------------------------
// Share SOP
// ---------------------------------------------------------------------------

export async function shareSop(
  sopId: string,
  input: ShareCourseInput,
): Promise<{ recipient_count: number; notified: number; reopened: number }> {
  const sop = await loadSop(sopId);
  if (sop.status !== 'published') {
    // Auto-publish on share so talents can open it
    await updateSop(sopId, { status: 'published' });
  }

  const availableToAll = !!input.available_to_all;
  const categoryIds = input.category_ids ?? [];
  const talentIds = await resolveTalentIdsByJobProfiles({
    available_to_all: availableToAll,
    category_ids: categoryIds,
  });
  if (talentIds.length === 0) {
    throw new AppError(400, 'No talent users match the selected job profiles');
  }

  const notify = input.notify !== false;
  const reack = !!input.reack;
  const source = availableToAll ? 'available_to_all' : 'manual_share';
  const now = new Date().toISOString();

  const { data: existing, error: exErr } = await supabaseAdmin
    .from('training_assignments')
    .select('id, talent_user_id, status, notification_id')
    .eq('resource_type', 'sop')
    .eq('resource_id', sopId)
    .in('talent_user_id', talentIds);
  if (exErr) throw new AppError(500, `Failed to load assignments: ${exErr.message}`);
  const existingByTalent = new Map((existing ?? []).map((r) => [r.talent_user_id as string, r]));

  const toNotify: string[] = [];
  let reopened = 0;

  const missing = talentIds.filter((tid) => !existingByTalent.has(tid));
  if (missing.length > 0) {
    const CHUNK = 500;
    for (let i = 0; i < missing.length; i += CHUNK) {
      const slice = missing.slice(i, i + CHUNK).map((tid) => ({
        talent_user_id: tid,
        resource_type: 'sop' as const,
        resource_id: sopId,
        source,
        status: 'not_started' as const,
        progress_percent: 0,
        assigned_at: now,
      }));
      const { error: insErr } = await supabaseAdmin
        .from('training_assignments')
        .upsert(slice, { onConflict: 'talent_user_id,resource_type,resource_id', ignoreDuplicates: true });
      if (insErr) throw new AppError(500, `Failed to create assignments: ${insErr.message}`);
    }
    toNotify.push(...missing);
  }

  for (const tid of talentIds) {
    const row = existingByTalent.get(tid);
    if (!row) continue;
    if (reack && row.status === 'completed') {
      const { error: upErr } = await supabaseAdmin
        .from('training_assignments')
        .update({
          status: 'not_started',
          progress_percent: 0,
          completed_at: null,
          started_at: null,
          assigned_at: now,
          source: 'manual_share',
        })
        .eq('id', row.id);
      if (upErr) throw new AppError(500, `Failed to reopen assignment: ${upErr.message}`);
      reopened += 1;
      toNotify.push(tid);
    } else if (row.status !== 'completed') {
      toNotify.push(tid);
    }
  }

  let notified = 0;
  if (notify && toNotify.length > 0) {
    const title = input.title?.trim() || (reack ? `Updated: ${sop.title}` : `New SOP: ${sop.title}`);
    const body =
      input.body?.trim() ||
      'Open Training Program, review the procedure, and mark it complete.';
    const linkUrl = `/talent/training?resource=sop:${sopId}`;
    const systemType = reack ? 'training_updated' : 'training_assigned';

    const { data: notification, error: nErr } = await supabaseAdmin
      .from('notifications')
      .insert({
        kind: 'system',
        system_type: systemType,
        title,
        body,
        link_url: linkUrl,
      })
      .select('id')
      .single();
    if (nErr || !notification) {
      console.error('[training-sop] notification failed', nErr?.message);
    } else {
      await supabaseAdmin
        .from('notification_recipients')
        .insert(toNotify.map((tid) => ({ notification_id: notification.id, talent_user_id: tid })));
      await supabaseAdmin
        .from('training_assignments')
        .update({ notification_id: notification.id })
        .eq('resource_type', 'sop')
        .eq('resource_id', sopId)
        .in('talent_user_id', toNotify);
      notified = toNotify.length;
    }
  }

  return { recipient_count: talentIds.length, notified, reopened };
}

export async function getSopShareStats(sopId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_assignments')
    .select('status')
    .eq('resource_type', 'sop')
    .eq('resource_id', sopId);
  if (error) throw new AppError(500, `Failed to load share stats: ${error.message}`);
  const stats = { assigned: 0, completed: 0, in_progress: 0, not_started: 0 };
  for (const row of data ?? []) {
    stats.assigned += 1;
    if (row.status === 'completed') stats.completed += 1;
    else if (row.status === 'in_progress') stats.in_progress += 1;
    else stats.not_started += 1;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Talent — my SOPs + complete
// ---------------------------------------------------------------------------

export async function getMySops(talentUserId: string) {
  const { data: assignments, error } = await supabaseAdmin
    .from('training_assignments')
    .select('id, resource_id, status, progress_percent, assigned_at, completed_at')
    .eq('talent_user_id', talentUserId)
    .eq('resource_type', 'sop');
  if (error) throw new AppError(500, `Failed to fetch SOP assignments: ${error.message}`);
  if (!assignments?.length) return [];

  const sopIds = assignments.map((a) => a.resource_id as string);
  const { data: sops, error: sErr } = await supabaseAdmin
    .from('training_sops')
    .select('id, title, summary, icon, cover_image_url, status, sort_order, published_at')
    .in('id', sopIds)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (sErr) throw new AppError(500, `Failed to fetch SOPs: ${sErr.message}`);

  const byId = new Map((sops ?? []).map((s) => [s.id as string, s]));
  return assignments
    .filter((a) => byId.has(a.resource_id as string))
    .map((a) => {
      const sop = byId.get(a.resource_id as string)!;
      return {
        ...sop,
        assignment_id: a.id,
        assignment_status: a.status,
        progress_percent: a.progress_percent,
        assigned_at: a.assigned_at,
        completed_at: a.completed_at,
        completed: a.status === 'completed',
      };
    });
}

export async function getSopForTalent(talentUserId: string, sopId: string) {
  // Must be assigned (or published + available_to_all with soft-ensure)
  let { data: assignment } = await supabaseAdmin
    .from('training_assignments')
    .select('*')
    .eq('talent_user_id', talentUserId)
    .eq('resource_type', 'sop')
    .eq('resource_id', sopId)
    .maybeSingle();

  const sop = await loadSop(sopId);
  if (sop.status !== 'published' || sop.deleted_at) {
    throw new AppError(404, 'SOP not found');
  }

  if (!assignment) {
    if (!sop.available_to_all) {
      throw new AppError(403, 'This SOP has not been shared with you');
    }
    // Soft-assign for available_to_all published SOPs
    const { data: created, error: cErr } = await supabaseAdmin
      .from('training_assignments')
      .insert({
        talent_user_id: talentUserId,
        resource_type: 'sop',
        resource_id: sopId,
        source: 'available_to_all',
        status: 'not_started',
        progress_percent: 0,
      })
      .select()
      .single();
    if (cErr) throw new AppError(500, `Failed to open SOP: ${cErr.message}`);
    assignment = created;
  }

  // Mark in progress on open
  if (assignment.status === 'not_started') {
    await supabaseAdmin
      .from('training_assignments')
      .update({ status: 'in_progress', started_at: new Date().toISOString(), progress_percent: 0 })
      .eq('id', assignment.id);
    assignment = { ...assignment, status: 'in_progress' };
  }

  const pages = await listPages(sopId);
  const activePages = pages.filter((p: any) => p.is_active !== false);

  // Attach blocks for all active pages (small SOPs; fine for v1)
  const pageIds = activePages.map((p: any) => p.id as string);
  let blocksByPage: Record<string, any[]> = {};
  if (pageIds.length > 0) {
    const { data: blocks, error: bErr } = await supabaseAdmin
      .from('training_sop_blocks')
      .select('*')
      .in('page_id', pageIds)
      .order('position', { ascending: true });
    if (bErr) throw new AppError(500, `Failed to load blocks: ${bErr.message}`);
    for (const b of blocks ?? []) {
      if (!blocksByPage[b.page_id]) blocksByPage[b.page_id] = [];
      blocksByPage[b.page_id].push(b);
    }
  }

  return {
    ...sop,
    pages: activePages.map((p: any) => ({ ...p, blocks: blocksByPage[p.id] ?? [] })),
    assignment: {
      id: assignment.id,
      status: assignment.status,
      progress_percent: assignment.progress_percent,
      completed_at: assignment.completed_at,
    },
  };
}

export async function completeSop(talentUserId: string, sopId: string) {
  const { data: assignment, error } = await supabaseAdmin
    .from('training_assignments')
    .select('id, status, notification_id')
    .eq('talent_user_id', talentUserId)
    .eq('resource_type', 'sop')
    .eq('resource_id', sopId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load assignment: ${error.message}`);
  if (!assignment) throw new AppError(403, 'This SOP has not been shared with you');

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: 'completed',
    progress_percent: 100,
    completed_at: now,
  };
  if (assignment.status === 'not_started') patch.started_at = now;
  const { error: upErr } = await supabaseAdmin
    .from('training_assignments')
    .update(patch)
    .eq('id', assignment.id);
  if (upErr) throw new AppError(500, `Failed to complete SOP: ${upErr.message}`);

  if (assignment.notification_id) {
    await supabaseAdmin
      .from('notification_recipients')
      .update({ read_at: now })
      .eq('notification_id', assignment.notification_id)
      .eq('talent_user_id', talentUserId)
      .is('read_at', null);
  }

  return { message: 'SOP marked complete' };
}
