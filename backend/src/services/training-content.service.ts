import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Talent-facing training, read from the SquadHub-shaped model
 * (training_items → training_pages → training_blocks).
 *
 * Content is authored on SquadHub and synced down; everything in this file is
 * read-only over that content. What SquadHire still *owns* — and what this
 * file therefore computes — is the gating: module unlocks, the profile-creation
 * gate, sequential onboarding, countdown deadlines and per-talent progress.
 *
 * ---------------------------------------------------------------------------
 * Containers vs. completable pages
 * ---------------------------------------------------------------------------
 * The old model had a fixed two levels: a chapter (no content of its own) held
 * lessons (which had content). SquadHub pages nest freely and any page may or
 * may not carry content, so "is this a chapter or a lesson?" is no longer a
 * question of depth. The rule here is content-based:
 *
 *     a page counts toward progress if it has at least one block.
 *
 * A page with no blocks is a container — a heading in the tree. That maps the
 * migrated data exactly onto its old behaviour (chapters had no blocks, lessons
 * each had one video block) while letting an author put content on any page.
 */

// Columns a talent may see. `correct_option_id` on quiz questions is
// deliberately never selected here — grading happens server-side.
const BLOCK_TALENT_COLUMNS =
  'id, page_id, type, position, text_content, file_url, file_name, file_size, mime_type, embed_url, embed_provider, caption, metadata';

export interface TalentBlock {
  id: string;
  page_id: string;
  type: string;
  position: number;
  [key: string]: unknown;
}

export interface TalentPage {
  id: string;
  item_id: string;
  parent_page_id: string | null;
  title: string;
  summary: string | null;
  icon: string | null;
  position: number;
  depth: number;
  linked_module: string | null;
  gates_profile_creation: boolean;
  /** Has content of its own, so it counts toward progress. */
  completable: boolean;
  completed: boolean;
  unlocked: boolean;
  blocks: TalentBlock[];
  children: TalentPage[];
  /** Completable pages in this page's subtree, including itself. */
  total_count: number;
  completed_count: number;
}

export interface TalentItem {
  id: string;
  kind: string;
  track: string;
  title: string;
  summary: string | null;
  icon: string | null;
  cover_image_url: string | null;
  sort_order: number;
  is_onboarding: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  started_at: string | null;
  expires_at: string | null;
  expired: boolean;
  categories: unknown[];
  pages: TalentPage[];
  /** Legacy two-level projection of `pages`. See pagesAsChapters. */
  chapters: unknown[];
  completed_count: number;
  total_count: number;
}

// ---------------------------------------------------------------------------
// Grandfathering
// ---------------------------------------------------------------------------

async function hasApprovedProfile(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .limit(1);
  if (error) throw new AppError(500, `Failed to check approval status: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function isOnboardingBypassed(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('skip_onboarding')
    .eq('id', userId)
    .maybeSingle();
  if (error) return false;
  return data?.skip_onboarding === true;
}

/** Approved talents and admin-bypassed talents skip every lock. */
async function isGrandfathered(userId: string): Promise<boolean> {
  if (await hasApprovedProfile(userId)) return true;
  return isOnboardingBypassed(userId);
}

// ---------------------------------------------------------------------------
// Loading the page tree
// ---------------------------------------------------------------------------

interface RawPage {
  id: string;
  item_id: string;
  parent_page_id: string | null;
  title: string;
  summary: string | null;
  icon: string | null;
  position: number;
  linked_module: string | null;
  gates_profile_creation: boolean;
}

/**
 * Load every active page of the given items, with blocks attached.
 *
 * Video blocks carry their language alternates and quiz blocks their questions
 * (answers stripped), so the reader gets one self-contained payload.
 */
async function loadPagesWithBlocks(itemIds: string[]): Promise<{
  pages: RawPage[];
  blocksByPage: Map<string, TalentBlock[]>;
}> {
  if (itemIds.length === 0) return { pages: [], blocksByPage: new Map() };

  const { data: pages, error: pErr } = await supabaseAdmin
    .from('training_pages')
    .select('id, item_id, parent_page_id, title, summary, icon, position, linked_module, gates_profile_creation')
    .in('item_id', itemIds)
    .eq('is_active', true)
    .order('position', { ascending: true });
  if (pErr) throw new AppError(500, `Failed to fetch pages: ${pErr.message}`);

  const pageIds = (pages ?? []).map((p: any) => p.id);
  const blocksByPage = new Map<string, TalentBlock[]>();
  if (pageIds.length === 0) return { pages: (pages ?? []) as RawPage[], blocksByPage };

  const { data: blocks, error: bErr } = await supabaseAdmin
    .from('training_blocks')
    .select(BLOCK_TALENT_COLUMNS)
    .in('page_id', pageIds)
    .order('position', { ascending: true });
  if (bErr) throw new AppError(500, `Failed to fetch blocks: ${bErr.message}`);

  const allBlocks = (blocks ?? []) as any[];
  const videoIds = allBlocks
    .filter((b) => b.type === 'video_embed' || b.type === 'video_upload')
    .map((b) => b.id);
  const quizIds = allBlocks.filter((b) => b.type === 'quiz').map((b) => b.id);

  const [videosRes, questionsRes] = await Promise.all([
    videoIds.length
      ? supabaseAdmin
          .from('training_block_videos')
          .select('block_id, language, embed_url, embed_provider, file_url, file_name, mime_type')
          .in('block_id', videoIds)
          .order('language', { ascending: true })
      : Promise.resolve({ data: [] as any[], error: null }),
    quizIds.length
      ? supabaseAdmin
          .from('training_quiz_questions')
          .select('id, block_id, position, prompt, options')
          .in('block_id', quizIds)
          .order('position', { ascending: true })
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const videosByBlock = new Map<string, any[]>();
  for (const v of videosRes.data ?? []) {
    const list = videosByBlock.get(v.block_id) ?? [];
    list.push(v);
    videosByBlock.set(v.block_id, list);
  }
  const questionsByBlock = new Map<string, any[]>();
  for (const q of questionsRes.data ?? []) {
    const list = questionsByBlock.get(q.block_id) ?? [];
    list.push(q);
    questionsByBlock.set(q.block_id, list);
  }

  for (const b of allBlocks) {
    const enriched: TalentBlock = { ...b };
    const videos = videosByBlock.get(b.id);
    if (videos?.length) enriched.videos = videos;
    const questions = questionsByBlock.get(b.id);
    if (questions?.length) enriched.quiz_questions = questions;

    const list = blocksByPage.get(b.page_id) ?? [];
    list.push(enriched);
    blocksByPage.set(b.page_id, list);
  }

  return { pages: (pages ?? []) as RawPage[], blocksByPage };
}

/**
 * Assemble one item's flat page rows into a tree, rolling progress counts up
 * from the leaves. Unlock state is applied by the caller, which knows the
 * item-level rules (onboarding sequence, countdown).
 */
function buildPageTree(
  rows: RawPage[],
  blocksByPage: Map<string, TalentBlock[]>,
  completedPageIds: Set<string>,
): TalentPage[] {
  const childrenOf = new Map<string | null, RawPage[]>();
  for (const row of rows) {
    const list = childrenOf.get(row.parent_page_id) ?? [];
    list.push(row);
    childrenOf.set(row.parent_page_id, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.position - b.position);

  // Guard against a cycle in parent links — a corrupt sync must not hang the
  // request, and a page visited twice is dropped rather than recursed into.
  const seen = new Set<string>();

  function build(row: RawPage, depth: number): TalentPage {
    seen.add(row.id);
    const blocks = blocksByPage.get(row.id) ?? [];
    const completable = blocks.length > 0;
    const completed = completable && completedPageIds.has(row.id);

    const children = (childrenOf.get(row.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .map((c) => build(c, depth + 1));

    let total = completable ? 1 : 0;
    let done = completed ? 1 : 0;
    for (const child of children) {
      total += child.total_count;
      done += child.completed_count;
    }

    return {
      id: row.id,
      item_id: row.item_id,
      parent_page_id: row.parent_page_id,
      title: row.title,
      summary: row.summary,
      icon: row.icon,
      position: row.position,
      depth,
      linked_module: row.linked_module,
      gates_profile_creation: row.gates_profile_creation,
      completable,
      completed,
      unlocked: true,
      blocks,
      children,
      total_count: total,
      completed_count: done,
    };
  }

  // A page whose parent was filtered out (inactive) is promoted to the root so
  // its content never silently disappears from the reader.
  const presentIds = new Set(rows.map((r) => r.id));
  const roots = rows.filter((r) => !r.parent_page_id || !presentIds.has(r.parent_page_id));
  roots.sort((a, b) => a.position - b.position);
  return roots.filter((r) => !seen.has(r.id)).map((r) => build(r, 0));
}

/** Walk a page tree, applying `fn` to every node. */
function walkPages(pages: TalentPage[], fn: (page: TalentPage) => void): void {
  for (const page of pages) {
    fn(page);
    walkPages(page.children, fn);
  }
}

/** Every page in the tree, flattened in reading order. */
function flattenPages(pages: TalentPage[]): TalentPage[] {
  const out: TalentPage[] = [];
  walkPages(pages, (p) => out.push(p));
  return out;
}

/** Mark a whole subtree locked (used by the countdown and sequential gates). */
function lockSubtree(pages: TalentPage[]): void {
  walkPages(pages, (p) => {
    p.unlocked = false;
  });
}

// ---------------------------------------------------------------------------
// Item payloads
// ---------------------------------------------------------------------------

async function loadItemStarts(userId: string, itemIds: string[]): Promise<Record<string, string>> {
  if (itemIds.length === 0) return {};
  const { data, error } = await supabaseAdmin
    .from('training_course_starts')
    .select('course_id, started_at')
    .eq('talent_user_id', userId)
    .in('course_id', itemIds);
  if (error) throw new AppError(500, `Failed to fetch course starts: ${error.message}`);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.course_id] = row.started_at;
  return map;
}

export async function buildItemPayloads(
  items: any[],
  userId: string,
  grandfathered: boolean,
): Promise<TalentItem[]> {
  if (items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const [{ pages, blocksByPage }, startsByItem, progressRes] = await Promise.all([
    loadPagesWithBlocks(itemIds),
    loadItemStarts(userId, itemIds),
    supabaseAdmin.from('training_page_progress').select('page_id').eq('talent_user_id', userId),
  ]);
  if (progressRes.error) {
    throw new AppError(500, `Failed to fetch progress: ${progressRes.error.message}`);
  }
  const completedPageIds = new Set((progressRes.data ?? []).map((p: any) => p.page_id));

  const pagesByItem = new Map<string, RawPage[]>();
  for (const p of pages) {
    const list = pagesByItem.get(p.item_id) ?? [];
    list.push(p);
    pagesByItem.set(p.item_id, list);
  }

  const now = Date.now();

  return items.map((item: any): TalentItem => {
    const tree = buildPageTree(pagesByItem.get(item.id) ?? [], blocksByPage, completedPageIds);

    const countdownEnabled = item.countdown_enabled === true;
    const countdownHours: number | null = item.countdown_hours ?? null;
    const startedAt: string | null = startsByItem[item.id] ?? null;
    let expiresAt: string | null = null;
    let expired = false;
    if (countdownEnabled && countdownHours && startedAt) {
      const expiresMs = new Date(startedAt).getTime() + countdownHours * 3600_000;
      expiresAt = new Date(expiresMs).toISOString();
      expired = !grandfathered && expiresMs < now;
    }

    if (!grandfathered) {
      // Countdown: nothing opens until Start is pressed, and everything shuts
      // again once the deadline passes.
      if (expired || (countdownEnabled && !startedAt)) {
        lockSubtree(tree);
      } else if (item.is_onboarding) {
        // Sequential gate: a top-level section opens only once every earlier
        // section is fully complete. The first section is always open.
        let priorComplete = true;
        for (const section of tree) {
          if (!priorComplete) lockSubtree([section]);
          priorComplete =
            priorComplete && (section.total_count === 0 || section.completed_count === section.total_count);
        }
      }
    }

    let completed = 0;
    let total = 0;
    for (const section of tree) {
      completed += section.completed_count;
      total += section.total_count;
    }

    return {
      id: item.id,
      kind: item.kind,
      track: item.track,
      title: item.title,
      summary: item.summary ?? null,
      icon: item.icon ?? null,
      cover_image_url: item.cover_image_url ?? null,
      sort_order: item.sort_order,
      is_onboarding: item.is_onboarding,
      countdown_enabled: countdownEnabled,
      countdown_hours: countdownHours,
      started_at: startedAt,
      expires_at: expiresAt,
      expired,
      categories: item.categories ?? [],
      pages: tree,
      // Back-compat for installed Flutter builds; see pagesAsChapters.
      chapters: pagesAsChapters(tree),
      completed_count: completed,
      total_count: total,
    };
  });
}

/**
 * Legacy `chapters` projection of an item's page tree.
 *
 * The Flutter talent app reads `courses[].chapters[].lessons[]` and is
 * distributed as an APK with no in-app update prompt, so installed builds
 * cannot be moved onto the page shape on our schedule. Emitting both keeps
 * those builds working unchanged while the web reader uses `pages`.
 *
 * Remove this once the app has been updated and old builds are out of use.
 */
function pagesAsChapters(pages: TalentPage[]): unknown[] {
  const contentPages = (page: TalentPage): TalentPage[] => {
    const out: TalentPage[] = [];
    const walk = (node: TalentPage) => {
      if (node.completable) out.push(node);
      for (const child of node.children) walk(child);
    };
    walk(page);
    return out;
  };

  return pages.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.summary,
    sort_order: section.position,
    completed_count: section.completed_count,
    total_count: section.total_count,
    unlocked: section.unlocked,
    linked_module: section.linked_module,
    lessons: contentPages(section).map((page) => {
      const video = page.blocks.find(
        (b) => b.type === 'video_embed' || b.type === 'video_upload',
      ) as { embed_url?: string; file_url?: string; videos?: { language: string; embed_url?: string; file_url?: string }[] } | undefined;
      return {
        id: page.id,
        chapter_id: section.id,
        title: page.title,
        description: page.summary,
        loom_url: video?.embed_url ?? video?.file_url ?? '',
        videos: (video?.videos ?? []).map((v) => ({
          language: v.language,
          loom_url: v.embed_url ?? v.file_url ?? '',
        })),
        blocks: page.blocks,
        sort_order: page.position,
        completed: page.completed,
      };
    }),
  }));
}

/** Shape the category rows the item queries join in. */
function withCategories(rows: any[]): any[] {
  return rows.map((row) => ({
    ...row,
    categories: (row.training_item_categories ?? [])
      .map((link: any) => link.categories)
      .filter(Boolean),
  }));
}

const ITEM_SELECT = '*, training_item_categories(category_id, categories(id, name, slug))';

/**
 * Every live item the talent can see, by the same visibility rules the course
 * model used: `available_to_all` opens an item to everyone; otherwise an item
 * with categories needs a match, and a non-onboarding item with no categories
 * is open to all.
 */
export async function getMyItems(userId: string, categoryIds: string[]): Promise<TalentItem[]> {
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .eq('is_active', true)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch training items: ${error.message}`);

  const categorySet = new Set(categoryIds);
  const visible = withCategories(data ?? []).filter((item: any) => {
    if (item.available_to_all) return true;
    const itemCategoryIds: string[] = (item.training_item_categories ?? []).map(
      (l: any) => l.category_id,
    );
    if (itemCategoryIds.length === 0) return !item.is_onboarding;
    return itemCategoryIds.some((id) => categorySet.has(id));
  });

  return buildItemPayloads(visible, userId, await isGrandfathered(userId));
}

/** The onboarding items among those the talent can see. */
export async function getOnboardingItems(userId: string, categoryIds: string[]): Promise<TalentItem[]> {
  const items = await getMyItems(userId, categoryIds);
  return items.filter((i) => i.is_onboarding);
}

/** One item, or null when the talent can't see it. */
export async function getItemForTalent(
  userId: string,
  itemId: string,
  categoryIds: string[],
): Promise<TalentItem | null> {
  const items = await getMyItems(userId, categoryIds);
  return items.find((i) => i.id === itemId) ?? null;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

/**
 * Is this page closed to the talent right now?
 *
 * Rebuilds the page's item through the normal payload path so the answer can
 * never drift from what the reader displayed — one set of gating rules, not
 * two implementations that have to agree.
 */
async function isPageLocked(userId: string, pageId: string): Promise<boolean> {
  if (await isGrandfathered(userId)) return false;

  const { data: page, error } = await supabaseAdmin
    .from('training_pages')
    .select('item_id')
    .eq('id', pageId)
    .maybeSingle();
  if (error || !page) return false;

  const { data: item } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .eq('id', page.item_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!item) return false;

  const [payload] = await buildItemPayloads(withCategories([item]), userId, false);
  if (!payload) return false;

  const target = flattenPages(payload.pages).find((p) => p.id === pageId);
  return target ? !target.unlocked : false;
}

export async function markPageComplete(userId: string, pageId: string) {
  if (await isPageLocked(userId, pageId)) {
    throw new AppError(403, 'This section is locked. Complete the previous section first.');
  }

  const { error } = await supabaseAdmin
    .from('training_page_progress')
    .upsert(
      { talent_user_id: userId, page_id: pageId, completed_at: new Date().toISOString() },
      { onConflict: 'talent_user_id,page_id' },
    );
  if (error) throw new AppError(500, `Failed to mark page complete: ${error.message}`);

  await syncAssignment(userId, pageId, 'complete');
  return { message: 'Page marked complete' };
}

export async function markPageIncomplete(userId: string, pageId: string) {
  const { error } = await supabaseAdmin
    .from('training_page_progress')
    .delete()
    .eq('talent_user_id', userId)
    .eq('page_id', pageId);
  if (error) throw new AppError(500, `Failed to unmark page: ${error.message}`);

  await syncAssignment(userId, pageId, 'incomplete');
  return { message: 'Page marked incomplete' };
}

/**
 * Keep training_assignments (the Training badge + clear-on-complete
 * notification) in step with progress. A failure here must never fail the
 * talent's request — the progress row is already written and is the source of
 * truth; the assignment is a derived convenience.
 */
async function syncAssignment(userId: string, pageId: string, phase: 'complete' | 'incomplete') {
  try {
    const { syncItemAssignmentForPage } = await import('./training-assignments.service.js');
    await syncItemAssignmentForPage(userId, pageId);
  } catch (err) {
    console.error(`[training] assignment sync after ${phase} failed:`, err);
  }
}

/**
 * Mark every completable page of an item done in one go.
 *
 * This is how an SOP is acknowledged — the talent reads the whole thing and
 * confirms once, rather than ticking each page. Locked pages are skipped, so a
 * countdown or sequential gate still can't be short-circuited by this call.
 */
export async function completeItem(userId: string, itemId: string) {
  const { data: item } = await supabaseAdmin
    .from('training_items')
    .select(ITEM_SELECT)
    .eq('id', itemId)
    .eq('is_active', true)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle();
  if (!item) throw new AppError(404, 'Not found');

  const grandfathered = await isGrandfathered(userId);
  const [payload] = await buildItemPayloads(withCategories([item]), userId, grandfathered);
  if (!payload) throw new AppError(404, 'Not found');

  const pending = flattenPages(payload.pages).filter(
    (p) => p.completable && p.unlocked && !p.completed,
  );

  if (pending.length > 0) {
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from('training_page_progress').upsert(
      pending.map((p) => ({ talent_user_id: userId, page_id: p.id, completed_at: now })),
      { onConflict: 'talent_user_id,page_id' },
    );
    if (error) throw new AppError(500, `Failed to record completion: ${error.message}`);
  }

  try {
    const { syncCourseAssignment } = await import('./training-assignments.service.js');
    await syncCourseAssignment(userId, itemId);
  } catch (err) {
    console.error('[training] assignment sync after item completion failed:', err);
  }

  return { message: 'Marked as read', completed: pending.length };
}

export async function getPageProgress(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_page_progress')
    .select('page_id, completed_at')
    .eq('talent_user_id', userId);
  if (error) throw new AppError(500, `Failed to fetch progress: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Module access + profile gate
// ---------------------------------------------------------------------------

/**
 * Items linked to any of the given categories. Inactive and archived items are
 * excluded, so switching an item off releases the modules it was gating.
 */
async function itemsForCategories(categoryIds: string[]): Promise<any[]> {
  if (categoryIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .select(`${ITEM_SELECT}, training_item_categories!inner(category_id)`)
    .in('training_item_categories.category_id', categoryIds)
    .eq('is_active', true)
    .eq('status', 'published')
    .is('deleted_at', null);
  if (error) throw new AppError(500, `Failed to fetch items for categories: ${error.message}`);
  return withCategories(data ?? []);
}

/**
 * Which talent-portal modules are unlocked for this talent.
 *
 * A page carrying `linked_module` unlocks that module once its whole subtree is
 * complete. A page with nothing completable in it unlocks immediately — an
 * empty gate is not a gate.
 */
export async function getModuleAccess(userId: string, categoryIds: string[]) {
  const empty = { unlocked: [] as string[], locked: [] as any[] };
  if (categoryIds.length === 0) return empty;

  const items = await itemsForCategories(categoryIds);
  if (items.length === 0) return empty;

  const grandfathered = await isGrandfathered(userId);
  const payloads = await buildItemPayloads(items, userId, grandfathered);

  const unlocked: string[] = [];
  const locked: {
    module: string;
    page_id: string;
    page_title: string;
    completed: number;
    total: number;
  }[] = [];

  for (const item of payloads) {
    for (const page of flattenPages(item.pages)) {
      if (!page.linked_module) continue;
      if (grandfathered || page.total_count === 0 || page.completed_count === page.total_count) {
        unlocked.push(page.linked_module);
      } else {
        locked.push({
          module: page.linked_module,
          page_id: page.id,
          page_title: page.title,
          completed: page.completed_count,
          total: page.total_count,
        });
      }
    }
  }

  return { unlocked, locked };
}

export interface ProfileGate {
  locked: boolean;
  /** The gate page to render, or null when this category has no gate. */
  page: TalentPage | null;
  item: { id: string; title: string } | null;
}

/**
 * Profile-creation gate for one category. A page flagged
 * `gates_profile_creation` on an item linked to that category must be complete
 * before the talent can build a profile there.
 *
 * Unlike module access this does NOT grandfather approved talents — every
 * category's gate is required — but the admin `skip_onboarding` bypass still
 * applies for QA.
 */
export async function getProfileGate(userId: string, categoryId: string): Promise<ProfileGate> {
  const open: ProfileGate = { locked: false, page: null, item: null };

  if (await isOnboardingBypassed(userId)) return open;

  const items = await itemsForCategories([categoryId]);
  if (items.length === 0) return open;

  // Approved talents still have to clear the gate, but the countdown and
  // sequential locks shouldn't hide the gate page from them.
  const payloads = await buildItemPayloads(items, userId, true);

  let firstGate: { page: TalentPage; item: TalentItem } | null = null;
  for (const item of payloads) {
    for (const page of flattenPages(item.pages)) {
      if (!page.gates_profile_creation) continue;
      const complete = page.total_count === 0 || page.completed_count === page.total_count;
      if (!complete) {
        return { locked: true, page, item: { id: item.id, title: item.title } };
      }
      if (!firstGate) firstGate = { page, item };
    }
  }

  // Every gate for this category is complete — report the first one so the UI
  // can still show what was required.
  if (firstGate) {
    return { locked: false, page: firstGate.page, item: { id: firstGate.item.id, title: firstGate.item.title } };
  }
  return open;
}

/**
 * Categories whose profile gate the talent has started but not finished. The
 * Training Program keeps listing a gate item while it is in progress, even
 * though the talent has no profile in that category yet.
 */
export async function getStartedGateCategoryIds(userId: string): Promise<string[]> {
  const { data: progress, error: pErr } = await supabaseAdmin
    .from('training_page_progress')
    .select('page_id')
    .eq('talent_user_id', userId);
  if (pErr) throw new AppError(500, `Failed to fetch progress: ${pErr.message}`);

  const pageIds = (progress ?? []).map((p: any) => p.page_id);
  if (pageIds.length === 0) return [];

  const { data: pages, error: pagesErr } = await supabaseAdmin
    .from('training_pages')
    .select('item_id')
    .in('id', pageIds);
  if (pagesErr) throw new AppError(500, `Failed to fetch pages: ${pagesErr.message}`);

  const itemIds = [...new Set((pages ?? []).map((p: any) => p.item_id))];
  if (itemIds.length === 0) return [];

  const { data: links, error: lErr } = await supabaseAdmin
    .from('training_item_categories')
    .select('category_id')
    .in('item_id', itemIds);
  if (lErr) throw new AppError(500, `Failed to fetch item categories: ${lErr.message}`);

  return [...new Set((links ?? []).map((l: any) => l.category_id))];
}

// ---------------------------------------------------------------------------
// Countdown start
// ---------------------------------------------------------------------------

export async function startItem(userId: string, itemId: string) {
  const { data: item, error } = await supabaseAdmin
    .from('training_items')
    .select('id, countdown_enabled, deleted_at')
    .eq('id', itemId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to load item: ${error.message}`);
  if (!item || item.deleted_at) throw new AppError(404, 'Course not found');
  if (!item.countdown_enabled) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }

  const { error: insErr } = await supabaseAdmin
    .from('training_course_starts')
    .upsert(
      { talent_user_id: userId, course_id: itemId, started_at: new Date().toISOString() },
      { onConflict: 'talent_user_id,course_id', ignoreDuplicates: true },
    );
  if (insErr) throw new AppError(500, `Failed to start course: ${insErr.message}`);

  return { message: 'Course started' };
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

/**
 * Grade a quiz submission. Correct answers never leave the server on the read
 * path, so grading has to happen here; the response carries per-question
 * correctness and the explanation, which the reader only ever sees after
 * submitting.
 */
export async function submitQuiz(
  userId: string,
  blockId: string,
  answers: Record<string, string>,
) {
  const { data: block, error: bErr } = await supabaseAdmin
    .from('training_blocks')
    .select('id, page_id, type')
    .eq('id', blockId)
    .maybeSingle();
  if (bErr) throw new AppError(500, `Failed to load quiz: ${bErr.message}`);
  if (!block || block.type !== 'quiz') throw new AppError(404, 'Quiz not found');

  if (await isPageLocked(userId, block.page_id)) {
    throw new AppError(403, 'This section is locked.');
  }

  const { data: questions, error: qErr } = await supabaseAdmin
    .from('training_quiz_questions')
    .select('id, prompt, correct_option_id, explanation, position')
    .eq('block_id', blockId)
    .order('position', { ascending: true });
  if (qErr) throw new AppError(500, `Failed to load quiz questions: ${qErr.message}`);
  if (!questions || questions.length === 0) throw new AppError(400, 'This quiz has no questions');

  const results = questions.map((q: any) => {
    const given = answers[q.id] ?? null;
    return {
      question_id: q.id,
      given_option_id: given,
      correct_option_id: q.correct_option_id,
      correct: given === q.correct_option_id,
      explanation: q.explanation ?? null,
    };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const scorePercent = Math.round((100 * correctCount) / questions.length);
  const passed = correctCount === questions.length;

  const { error: insErr } = await supabaseAdmin.from('training_quiz_attempts').insert({
    talent_user_id: userId,
    block_id: blockId,
    answers,
    score_percent: scorePercent,
    passed,
  });
  if (insErr) throw new AppError(500, `Failed to record quiz attempt: ${insErr.message}`);

  return { score_percent: scorePercent, passed, results };
}

/** The talent's most recent attempt per quiz block on a page. */
export async function getQuizAttempts(userId: string, blockIds: string[]) {
  if (blockIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('training_quiz_attempts')
    .select('block_id, score_percent, passed, submitted_at')
    .eq('talent_user_id', userId)
    .in('block_id', blockIds)
    .order('submitted_at', { ascending: false });
  if (error) throw new AppError(500, `Failed to fetch quiz attempts: ${error.message}`);

  const latest = new Map<string, any>();
  for (const row of data ?? []) {
    if (!latest.has(row.block_id)) latest.set(row.block_id, row);
  }
  return [...latest.values()];
}
