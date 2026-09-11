import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateItemInput, UpdatePageConfigInput } from '../validators/training.validators.js';
import type { ReorderInput } from '../validators/admin.validators.js';
import {
  getMyItems,
  getOnboardingItems,
  startItem,
  type TalentItem,
} from './training-content.service.js';

/**
 * Training, SquadHire side.
 *
 * Content — items, pages, blocks, quizzes, videos — is authored in SquadHub's
 * Resources module and synced down. This service therefore has no create/update
 * paths for content; what it owns is the *configuration* SquadHire is
 * responsible for:
 *
 *   on an item  — is_onboarding, available_to_all, countdown, is_active,
 *                 sort_order, archive/restore, category targeting
 *   on a page   — linked_module, gates_profile_creation, language
 *
 * Those columns are never written by the sync, so an admin's gating survives
 * every republish from SquadHub.
 *
 * Talent-facing reads live in training-content.service and are re-exported
 * here so callers have one import.
 */

export {
  getMyItems,
  getOnboardingItems,
  getItemForTalent,
  markPageComplete,
  markPageIncomplete,
  completeItem,
  getPageProgress,
  getModuleAccess,
  getProfileGate,
  getStartedGateCategoryIds,
  startItem,
  submitQuiz,
  getQuizAttempts,
  type TalentItem,
  type TalentPage,
  type ProfileGate,
} from './training-content.service.js';

const ITEM_SELECT = '*, training_item_categories(category_id, categories(id, name, slug))';

function shapeItem(row: any) {
  if (!row) return row;
  return {
    ...row,
    categories: (row.training_item_categories ?? []).map((l: any) => l.categories).filter(Boolean),
    category_ids: (row.training_item_categories ?? []).map((l: any) => l.category_id),
    // Where an admin goes to edit this content. SquadHub's Resources module is
    // an in-app section rather than a per-item route, so this points at the app
    // and the admin picks the item there. Built server-side so the admin UI
    // needs no SquadHub config of its own.
    squadhub_url: `${env.SQUADHUB_WEB_URL.replace(/\/$/, '')}/app`,
  };
}

async function loadItem(id: string) {
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load item: ${error.message}`);
  if (!data) throw new AppError(404, 'Training item not found');
  return shapeItem(data);
}

/** Page counts for the admin list, so a row can show how much content it holds. */
async function attachPageCounts(items: any[]) {
  if (items.length === 0) return items;
  const { data, error } = await supabaseAdmin
    .from('training_pages')
    .select('item_id')
    .in('item_id', items.map((i) => i.id))
    .eq('is_active', true);
  if (error) throw new AppError(500, `Failed to count pages: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
  }
  return items.map((i) => ({ ...i, page_count: counts.get(i.id) ?? 0 }));
}

// ---------------------------------------------------------------------------
// Admin — items
// ---------------------------------------------------------------------------

export async function getItems() {
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch training items: ${error.message}`);
  return attachPageCounts((data ?? []).map(shapeItem));
}

export async function getArchivedItems() {
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .not('deleted_at', 'is', null)
    .order('updated_at', { ascending: false });
  if (error) throw new AppError(500, `Failed to fetch archived items: ${error.message}`);
  return attachPageCounts((data ?? []).map(shapeItem));
}

export async function getItem(id: string) {
  return loadItem(id);
}

/**
 * A category may sit in at most one live onboarding item. The DB trigger
 * enforces this too; checking here turns a raw constraint violation into a
 * message that names the clashing item.
 */
async function assertOnboardingCategoryUniqueness(itemId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return;
  const { data, error } = await supabaseAdmin
    .from('training_item_categories')
    .select('category_id, training_items!inner(id, title, is_onboarding, deleted_at)')
    .in('category_id', categoryIds)
    .neq('item_id', itemId)
    .eq('training_items.is_onboarding', true)
    .is('training_items.deleted_at', null);
  if (error) throw new AppError(500, `Failed to check onboarding categories: ${error.message}`);

  const clash = (data ?? [])[0] as any;
  if (clash) {
    throw new AppError(
      400,
      `That job profile is already covered by the onboarding course "${clash.training_items?.title}"`,
    );
  }
}

async function replaceItemCategories(itemId: string, categoryIds: string[]) {
  const { error: delErr } = await supabaseAdmin
    .from('training_item_categories')
    .delete()
    .eq('item_id', itemId);
  if (delErr) throw new AppError(500, `Failed to clear categories: ${delErr.message}`);

  if (categoryIds.length === 0) return;
  const { error: insErr } = await supabaseAdmin
    .from('training_item_categories')
    .insert(categoryIds.map((category_id) => ({ item_id: itemId, category_id })));
  if (insErr) throw new AppError(500, `Failed to set categories: ${insErr.message}`);
}

/**
 * Update the SquadHire-owned configuration on an item. Title, summary and all
 * content come from SquadHub and are deliberately not writable here.
 */
export async function updateItem(id: string, input: UpdateItemInput) {
  const current = await loadItem(id);

  const patch: Record<string, unknown> = {};
  for (const key of [
    'is_active',
    'is_onboarding',
    'available_to_all',
    'countdown_enabled',
    'countdown_hours',
    'sort_order',
    'status',
  ] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }

  const willBeOnboarding = input.is_onboarding ?? current.is_onboarding;
  const nextCategoryIds = input.category_ids ?? current.category_ids;

  if (willBeOnboarding) {
    const openToAll = input.available_to_all ?? current.available_to_all;
    if (!openToAll && nextCategoryIds.length === 0) {
      throw new AppError(400, 'An onboarding course needs at least one job profile');
    }
    await assertOnboardingCategoryUniqueness(id, nextCategoryIds);
  }

  // Turning the countdown off clears its duration, so a later re-enable can't
  // silently inherit a stale deadline.
  if (input.countdown_enabled === false) patch.countdown_hours = null;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from('training_items').update(patch).eq('id', id);
    if (error) throw new AppError(500, `Failed to update item: ${error.message}`);
  }

  if (input.category_ids !== undefined) {
    await replaceItemCategories(id, input.category_ids);
  }

  return loadItem(id);
}

export async function archiveItem(id: string) {
  const { error } = await supabaseAdmin
    .from('training_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to archive item: ${error.message}`);
  return { message: 'Course archived' };
}

export async function restoreItem(id: string) {
  const { error } = await supabaseAdmin
    .from('training_items')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to restore item: ${error.message}`);
  return { message: 'Course restored' };
}

export async function reorderItems(input: ReorderInput) {
  for (const { id, sort_order } of input.items) {
    const { error } = await supabaseAdmin
      .from('training_items')
      .update({ sort_order })
      .eq('id', id);
    if (error) throw new AppError(500, `Failed to reorder items: ${error.message}`);
  }
  return { message: 'Order updated' };
}

// ---------------------------------------------------------------------------
// Admin — page gating
// ---------------------------------------------------------------------------

/**
 * The item's page tree, with the gating config on each node and a flag for
 * whether the page holds content. The admin lock screen renders this; there is
 * no content in the payload because it isn't editable here.
 */
export async function getItemPages(itemId: string) {
  const { data: pages, error } = await supabaseAdmin
    .from('training_pages')
    .select(
      'id, item_id, parent_page_id, title, icon, position, is_active, linked_module, gates_profile_creation, language',
    )
    .eq('item_id', itemId)
    .order('position', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch pages: ${error.message}`);

  const rows = pages ?? [];
  const pageIds = rows.map((p: any) => p.id);

  let withContent = new Set<string>();
  if (pageIds.length > 0) {
    const { data: blocks, error: bErr } = await supabaseAdmin
      .from('training_blocks')
      .select('page_id')
      .in('page_id', pageIds);
    if (bErr) throw new AppError(500, `Failed to count blocks: ${bErr.message}`);
    withContent = new Set((blocks ?? []).map((b: any) => b.page_id));
  }

  return rows.map((p: any) => ({ ...p, has_content: withContent.has(p.id) }));
}

/**
 * Set the gating config on one page. `linked_module` and
 * `gates_profile_creation` are the two locks SquadHire owns; `is_active` lets
 * an admin hide a synced page from talents without touching SquadHub.
 */
export async function updatePageConfig(pageId: string, input: UpdatePageConfigInput) {
  const patch: Record<string, unknown> = {};
  for (const key of ['linked_module', 'gates_profile_creation', 'language', 'is_active'] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  if (Object.keys(patch).length === 0) {
    throw new AppError(400, 'Nothing to update');
  }

  const { data, error } = await supabaseAdmin
    .from('training_pages')
    .update(patch)
    .eq('id', pageId)
    .select(
      'id, item_id, parent_page_id, title, position, is_active, linked_module, gates_profile_creation, language',
    )
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to update page: ${error.message}`);
  if (!data) throw new AppError(404, 'Page not found');
  return data;
}

// ---------------------------------------------------------------------------
// Onboarding completion
// ---------------------------------------------------------------------------

async function isOnboardingBypassed(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('skip_onboarding')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return data?.skip_onboarding === true;
}

async function markOnboardingComplete(userId: string, message: string) {
  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({ onboarding_completed: true })
    .eq('id', userId);
  if (error) throw new AppError(500, `Failed to complete onboarding: ${error.message}`);

  try {
    const { syncOnboardingStage } = await import('./automation.service.js');
    await syncOnboardingStage(userId);
  } catch (e) {
    console.error('[automation] syncOnboardingStage failed:', e);
  }
  return { message };
}

export async function completeOnboarding(userId: string, categoryIds: string[]) {
  // An admin bypass means the talent was never asked to watch the course, so
  // the progress check below would reject them for no reason.
  if (await isOnboardingBypassed(userId)) {
    return markOnboardingComplete(userId, 'Onboarding completed (admin bypass)');
  }

  const items = await getOnboardingItems(userId, categoryIds);
  for (const item of items) {
    for (const section of item.pages) {
      if (section.total_count > 0 && section.completed_count !== section.total_count) {
        throw new AppError(400, `Complete all pages in "${section.title}" first`);
      }
    }
  }

  return markOnboardingComplete(userId, 'Onboarding completed');
}

// ---------------------------------------------------------------------------
// Admin — enrolment / countdown management
// ---------------------------------------------------------------------------

export async function getUserItemEnrollments(userId: string) {
  const { data: starts, error: startsErr } = await supabaseAdmin
    .from('training_course_starts')
    .select('course_id, started_at')
    .eq('talent_user_id', userId);
  if (startsErr) throw new AppError(500, `Failed to fetch enrollments: ${startsErr.message}`);
  if (!starts || starts.length === 0) return [];

  const itemIds = starts.map((s) => s.course_id as string);
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('training_items')
    .select('id, title, countdown_enabled, countdown_hours, deleted_at')
    .in('id', itemIds);
  if (itemsErr) throw new AppError(500, `Failed to fetch items: ${itemsErr.message}`);

  const byId = new Map((items ?? []).map((i: any) => [i.id as string, i]));
  const now = Date.now();

  return starts
    .map((s) => {
      const item = byId.get(s.course_id as string);
      if (!item || item.deleted_at) return null;
      const hours = item.countdown_hours as number | null;
      const startedMs = new Date(s.started_at as string).getTime();
      const expiresAt = hours ? new Date(startedMs + hours * 3600_000).toISOString() : null;
      return {
        course_id: item.id,
        course_title: item.title,
        countdown_enabled: item.countdown_enabled,
        countdown_hours: hours,
        started_at: s.started_at,
        expires_at: expiresAt,
        expired: expiresAt ? new Date(expiresAt).getTime() < now : false,
      };
    })
    .filter(Boolean);
}

async function loadCountdownItem(itemId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select('id, countdown_enabled, countdown_hours, deleted_at')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load course: ${error.message}`);
  if (!data || data.deleted_at) throw new AppError(404, 'Course not found');
  if (!data.countdown_enabled) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }
  return data;
}

/** Admin action: clear a talent's start so their countdown runs fresh. */
export async function reopenItem(userId: string, itemId: string) {
  await loadCountdownItem(itemId);

  const { data: existing } = await supabaseAdmin
    .from('training_course_starts')
    .select('started_at')
    .eq('talent_user_id', userId)
    .eq('course_id', itemId)
    .maybeSingle();
  if (!existing) throw new AppError(404, 'No enrollment found for this user and course');

  const { error } = await supabaseAdmin
    .from('training_course_starts')
    .delete()
    .eq('talent_user_id', userId)
    .eq('course_id', itemId);
  if (error) throw new AppError(500, `Failed to reopen course: ${error.message}`);

  return { message: 'Course reopened' };
}

/**
 * Talent-side request to reopen an expired course. Idempotent: a second call
 * while a request is pending returns the existing one rather than stacking
 * duplicates in the admin queue.
 */
export async function requestItemReopen(userId: string, itemId: string, reason?: string) {
  const item = await loadCountdownItem(itemId);
  if (!item.countdown_hours) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }

  const { data: start } = await supabaseAdmin
    .from('training_course_starts')
    .select('started_at')
    .eq('talent_user_id', userId)
    .eq('course_id', itemId)
    .maybeSingle();
  if (!start) throw new AppError(400, 'You have not started this course yet');

  const expiry = new Date(
    new Date(start.started_at as string).getTime() + (item.countdown_hours as number) * 3600_000,
  );
  if (expiry > new Date()) throw new AppError(400, 'This course has not expired yet');

  const { data: existing } = await supabaseAdmin
    .from('course_reopen_requests')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('course_id', itemId)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) {
    return {
      message: 'You already have a pending request',
      requestId: existing.id as string,
      already: true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('course_reopen_requests')
    .insert({ talent_user_id: userId, course_id: itemId, reason: reason ?? null })
    .select('id')
    .single();
  if (error) throw new AppError(500, `Failed to create request: ${error.message}`);

  return { message: 'Request sent', requestId: data.id as string, already: false };
}

// Kept for the countdown Start button, which the talent routes call directly.
export { startItem as startCourse };

/**
 * Training visible for a set of categories, without a specific talent — used
 * by admin previews. Progress is resolved against `userId` when one is given.
 */
export async function getTrainingForCategories(
  categoryIds: string[],
  userId: string,
): Promise<TalentItem[]> {
  return getMyItems(userId, categoryIds);
}
