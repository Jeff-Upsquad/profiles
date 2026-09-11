import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Ingest for training content published from SquadHub's Resources module.
 *
 * SquadHub owns the content; SquadHire owns the gating. The whole point of
 * this file is that those two never collide:
 *
 *   written by the sync   title, summary, icon, cover, kind, track, the page
 *                         tree, blocks, video variants, quiz questions
 *   never touched         is_onboarding, available_to_all, countdown_*,
 *                         is_active, status, sort_order, category targeting,
 *                         linked_module, gates_profile_creation, language,
 *                         a page's is_active
 *
 * So an admin's locks survive every republish, and a republish can never
 * silently un-gate a module or drop an onboarding course on people.
 *
 * Rows are matched on their SquadHub ids (`squadhub_item_id`,
 * `squadhub_page_id`, …) rather than on our own primary keys, because our ids
 * were inherited from the pre-sync data and are not what SquadHub knows an
 * object by.
 */

export interface SyncBlockVideo {
  language: string;
  embed_url?: string | null;
  embed_provider?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
}

export interface SyncQuizQuestion {
  id: string;
  position: number;
  prompt: string;
  options?: unknown;
  correct_option_id: string;
  explanation?: string | null;
}

export interface SyncBlock {
  id: string;
  type: string;
  position: number;
  text_content?: unknown;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  embed_url?: string | null;
  embed_provider?: string | null;
  caption?: string | null;
  metadata?: Record<string, any> | null;
  videos?: SyncBlockVideo[];
  quiz_questions?: SyncQuizQuestion[];
}

export interface SyncPage {
  id: string;
  parent_id: string | null;
  title: string;
  summary?: string | null;
  icon?: string | null;
  position: number;
  blocks: SyncBlock[];
}

export interface SyncItemPayload {
  id: string;
  kind: 'course' | 'post';
  track: 'learning' | 'sop';
  title: string;
  summary?: string | null;
  icon?: string | null;
  cover_image_url?: string | null;
  /** False when the item was unpublished or its talent audience was removed. */
  visible: boolean;
  pages: SyncPage[];
}

const ALLOWED_BLOCK_TYPES = new Set([
  'text',
  'image',
  'video_upload',
  'video_embed',
  'audio',
  'pdf',
  'quiz',
]);

/**
 * Apply one published item.
 *
 * Idempotent: re-sending the same payload converges on the same rows. Content
 * that disappeared upstream is deleted here, which is what makes a page
 * removed in SquadHub actually vanish for talents — but only ever content,
 * never an item, because deleting an item would take its assignments and
 * progress with it.
 */
export async function syncItem(payload: SyncItemPayload) {
  if (!payload?.id) throw new AppError(400, 'Missing item id');

  const itemId = await upsertItem(payload);

  if (!payload.visible) {
    // Unpublished upstream: hide it from talents but keep the row, its
    // progress and its gating so republishing restores everything.
    const { error } = await supabaseAdmin
      .from('training_items')
      .update({ status: 'draft', synced_at: new Date().toISOString() })
      .eq('id', itemId);
    if (error) throw new AppError(500, `Failed to unpublish item: ${error.message}`);
    return { item_id: itemId, pages: 0, blocks: 0, unpublished: true };
  }

  const pageIdByRemote = await upsertPages(itemId, payload.pages ?? []);
  const blockCount = await upsertBlocks(payload.pages ?? [], pageIdByRemote);

  const { error: stampErr } = await supabaseAdmin
    .from('training_items')
    .update({ synced_at: new Date().toISOString() })
    .eq('id', itemId);
  if (stampErr) throw new AppError(500, `Failed to stamp sync: ${stampErr.message}`);

  return {
    item_id: itemId,
    pages: pageIdByRemote.size,
    blocks: blockCount,
    unpublished: false,
  };
}

/** Create or update the item row, touching only SquadHub-owned columns. */
async function upsertItem(payload: SyncItemPayload): Promise<string> {
  const content = {
    kind: payload.kind ?? 'course',
    track: payload.track ?? 'learning',
    title: payload.title,
    summary: payload.summary ?? null,
    icon: payload.icon ?? null,
    cover_image_url: payload.cover_image_url ?? null,
  };

  const { data: existing, error: findErr } = await supabaseAdmin
    .from('training_items')
    .select('id')
    .eq('squadhub_item_id', payload.id)
    .maybeSingle();
  if (findErr) throw new AppError(500, `Failed to look up item: ${findErr.message}`);

  if (existing) {
    const { error } = await supabaseAdmin
      .from('training_items')
      .update(content)
      .eq('id', existing.id);
    if (error) throw new AppError(500, `Failed to update item: ${error.message}`);
    return existing.id as string;
  }

  // First time we've seen this item. It arrives as a draft with no targeting:
  // an admin decides who it reaches and what it unlocks before any talent
  // sees it. Publishing is never automatic.
  const { data, error } = await supabaseAdmin
    .from('training_items')
    .insert({
      ...content,
      squadhub_item_id: payload.id,
      status: 'draft',
      is_active: true,
      available_to_all: false,
      is_onboarding: false,
    })
    .select('id')
    .single();
  if (error) throw new AppError(500, `Failed to create item: ${error.message}`);
  return data.id as string;
}

/**
 * Reconcile the page tree. Returns SquadHub page id → our page id.
 *
 * Parents are resolved in a second pass because a payload may list a child
 * before its parent, and a page we haven't inserted yet has no id to point at.
 */
async function upsertPages(itemId: string, pages: SyncPage[]): Promise<Map<string, string>> {
  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('training_pages')
    .select('id, squadhub_page_id')
    .eq('item_id', itemId);
  if (exErr) throw new AppError(500, `Failed to load pages: ${exErr.message}`);

  const existingByRemote = new Map<string, string>();
  for (const row of existingRows ?? []) {
    if (row.squadhub_page_id) existingByRemote.set(row.squadhub_page_id as string, row.id as string);
  }

  const idByRemote = new Map<string, string>();

  // Pass 1 — content and position, no parents yet.
  for (const page of pages) {
    const content = {
      title: page.title,
      summary: page.summary ?? null,
      icon: page.icon ?? null,
      position: page.position ?? 0,
    };
    const known = existingByRemote.get(page.id);
    if (known) {
      const { error } = await supabaseAdmin.from('training_pages').update(content).eq('id', known);
      if (error) throw new AppError(500, `Failed to update page: ${error.message}`);
      idByRemote.set(page.id, known);
    } else {
      const { data, error } = await supabaseAdmin
        .from('training_pages')
        .insert({ ...content, item_id: itemId, squadhub_page_id: page.id, is_active: true })
        .select('id')
        .single();
      if (error) throw new AppError(500, `Failed to create page: ${error.message}`);
      idByRemote.set(page.id, data.id as string);
    }
  }

  // Pass 2 — parents, now that every page has an id.
  for (const page of pages) {
    const localId = idByRemote.get(page.id);
    if (!localId) continue;
    const parentLocalId = page.parent_id ? (idByRemote.get(page.parent_id) ?? null) : null;
    const { error } = await supabaseAdmin
      .from('training_pages')
      .update({ parent_page_id: parentLocalId })
      .eq('id', localId);
    if (error) throw new AppError(500, `Failed to link page parent: ${error.message}`);
  }

  // Pages removed upstream. Only synced pages are eligible — a page with no
  // squadhub_page_id predates the sync and is not SquadHub's to delete.
  const incoming = new Set(pages.map((p) => p.id));
  const stale = [...existingByRemote.entries()]
    .filter(([remoteId]) => !incoming.has(remoteId))
    .map(([, localId]) => localId);
  if (stale.length > 0) {
    const { error } = await supabaseAdmin.from('training_pages').delete().in('id', stale);
    if (error) throw new AppError(500, `Failed to remove pages: ${error.message}`);
  }

  return idByRemote;
}

/** Reconcile every page's blocks, with their video variants and quiz questions. */
async function upsertBlocks(
  pages: SyncPage[],
  pageIdByRemote: Map<string, string>,
): Promise<number> {
  let count = 0;

  for (const page of pages) {
    const pageId = pageIdByRemote.get(page.id);
    if (!pageId) continue;

    const blocks = (page.blocks ?? []).filter((b) => ALLOWED_BLOCK_TYPES.has(b.type));

    const { data: existingRows, error: exErr } = await supabaseAdmin
      .from('training_blocks')
      .select('id, squadhub_block_id')
      .eq('page_id', pageId);
    if (exErr) throw new AppError(500, `Failed to load blocks: ${exErr.message}`);

    const existingByRemote = new Map<string, string>();
    for (const row of existingRows ?? []) {
      if (row.squadhub_block_id) {
        existingByRemote.set(row.squadhub_block_id as string, row.id as string);
      }
    }

    for (const block of blocks) {
      const content = {
        type: block.type,
        position: block.position ?? 0,
        text_content: block.text_content ?? null,
        file_url: block.file_url ?? null,
        file_name: block.file_name ?? null,
        file_size: block.file_size ?? null,
        mime_type: block.mime_type ?? null,
        embed_url: block.embed_url ?? null,
        embed_provider: block.embed_provider ?? null,
        caption: block.caption ?? null,
        metadata: block.metadata ?? {},
      };

      let blockId = existingByRemote.get(block.id);
      if (blockId) {
        const { error } = await supabaseAdmin
          .from('training_blocks')
          .update(content)
          .eq('id', blockId);
        if (error) throw new AppError(500, `Failed to update block: ${error.message}`);
      } else {
        const { data, error } = await supabaseAdmin
          .from('training_blocks')
          .insert({ ...content, page_id: pageId, squadhub_block_id: block.id })
          .select('id')
          .single();
        if (error) throw new AppError(500, `Failed to create block: ${error.message}`);
        blockId = data.id as string;
      }

      await replaceBlockVideos(blockId, block.videos ?? []);
      await replaceQuizQuestions(blockId, block.quiz_questions ?? []);
      count += 1;
    }

    const incoming = new Set(blocks.map((b) => b.id));
    const stale = [...existingByRemote.entries()]
      .filter(([remoteId]) => !incoming.has(remoteId))
      .map(([, localId]) => localId);
    if (stale.length > 0) {
      const { error } = await supabaseAdmin.from('training_blocks').delete().in('id', stale);
      if (error) throw new AppError(500, `Failed to remove blocks: ${error.message}`);
    }
  }

  return count;
}

/** Variants are replaced wholesale so a language dropped upstream disappears. */
async function replaceBlockVideos(blockId: string, videos: SyncBlockVideo[]) {
  const { error: delErr } = await supabaseAdmin
    .from('training_block_videos')
    .delete()
    .eq('block_id', blockId);
  if (delErr) throw new AppError(500, `Failed to clear video variants: ${delErr.message}`);

  const usable = videos.filter((v) => v.language && (v.embed_url || v.file_url));
  if (usable.length === 0) return;

  const { error } = await supabaseAdmin.from('training_block_videos').insert(
    usable.map((v) => ({
      block_id: blockId,
      language: v.language,
      embed_url: v.embed_url ?? null,
      embed_provider: v.embed_provider ?? null,
      file_url: v.file_url ?? null,
      file_name: v.file_name ?? null,
      file_size: v.file_size ?? null,
      mime_type: v.mime_type ?? null,
    })),
  );
  if (error) throw new AppError(500, `Failed to write video variants: ${error.message}`);
}

/**
 * Quiz questions are matched on their SquadHub id rather than replaced, so a
 * talent's past attempts keep pointing at questions that still exist.
 */
async function replaceQuizQuestions(blockId: string, questions: SyncQuizQuestion[]) {
  const { data: existingRows, error: exErr } = await supabaseAdmin
    .from('training_quiz_questions')
    .select('id, squadhub_question_id')
    .eq('block_id', blockId);
  if (exErr) throw new AppError(500, `Failed to load quiz questions: ${exErr.message}`);

  const existingByRemote = new Map<string, string>();
  for (const row of existingRows ?? []) {
    if (row.squadhub_question_id) {
      existingByRemote.set(row.squadhub_question_id as string, row.id as string);
    }
  }

  for (const q of questions) {
    const content = {
      position: q.position ?? 0,
      prompt: q.prompt,
      options: q.options ?? [],
      correct_option_id: q.correct_option_id,
      explanation: q.explanation ?? null,
    };
    const known = existingByRemote.get(q.id);
    if (known) {
      const { error } = await supabaseAdmin
        .from('training_quiz_questions')
        .update(content)
        .eq('id', known);
      if (error) throw new AppError(500, `Failed to update quiz question: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin
        .from('training_quiz_questions')
        .insert({ ...content, block_id: blockId, squadhub_question_id: q.id });
      if (error) throw new AppError(500, `Failed to create quiz question: ${error.message}`);
    }
  }

  const incoming = new Set(questions.map((q) => q.id));
  const stale = [...existingByRemote.entries()]
    .filter(([remoteId]) => !incoming.has(remoteId))
    .map(([, localId]) => localId);
  if (stale.length > 0) {
    const { error } = await supabaseAdmin
      .from('training_quiz_questions')
      .delete()
      .in('id', stale);
    if (error) throw new AppError(500, `Failed to remove quiz questions: ${error.message}`);
  }
}
