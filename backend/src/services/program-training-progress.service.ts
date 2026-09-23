import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export type ProgramTrack = 'jobs' | 'partner';

export interface ProgramCourseProgress {
  id: string;
  title: string;
  published: boolean;
  completed: number;
  total: number;
  started: boolean;
  done: boolean;
}

export type ProgramProgress = Record<ProgramTrack, ProgramCourseProgress | null>;

/** Batch status for the two optional courses. Only pages with content count. */
export async function programProgressFor(userIds: string[]): Promise<Map<string, ProgramProgress>> {
  const result = new Map<string, ProgramProgress>();
  for (const id of userIds) result.set(id, { jobs: null, partner: null });
  if (!userIds.length) return result;

  const { data: items, error: itemError } = await supabaseAdmin
    .from('training_items')
    .select('id, title, program_track, status, is_active')
    .in('program_track', ['jobs', 'partner'])
    .is('deleted_at', null);
  if (itemError) throw new AppError(500, `Failed to load program courses: ${itemError.message}`);
  if (!items?.length) return result;

  const itemIds = items.map((item) => item.id);
  const { data: pages, error: pageError } = await supabaseAdmin
    .from('training_pages')
    .select('id, item_id')
    .in('item_id', itemIds)
    .eq('is_active', true);
  if (pageError) throw new AppError(500, `Failed to load program pages: ${pageError.message}`);
  const pageIds = (pages ?? []).map((page) => page.id);
  const [blocksRes, progressRes, startsRes] = await Promise.all([
    pageIds.length
      ? supabaseAdmin.from('training_blocks').select('page_id').in('page_id', pageIds)
      : Promise.resolve({ data: [], error: null }),
    pageIds.length
      ? supabaseAdmin.from('training_page_progress').select('talent_user_id, page_id')
          .in('talent_user_id', userIds).in('page_id', pageIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('training_course_starts').select('talent_user_id, course_id')
      .in('talent_user_id', userIds).in('course_id', itemIds),
  ]);
  for (const [name, response] of [['blocks', blocksRes], ['progress', progressRes], ['starts', startsRes]] as const) {
    if (response.error) throw new AppError(500, `Failed to load program ${name}: ${response.error.message}`);
  }

  const contentPages = new Set((blocksRes.data ?? []).map((block) => block.page_id));
  const itemByPage = new Map((pages ?? [])
    .filter((page) => contentPages.has(page.id))
    .map((page) => [page.id, page.item_id]));
  const totalByItem = new Map<string, number>();
  for (const itemId of itemByPage.values()) totalByItem.set(itemId, (totalByItem.get(itemId) ?? 0) + 1);

  const completedByUserItem = new Map<string, number>();
  for (const row of progressRes.data ?? []) {
    const itemId = itemByPage.get(row.page_id);
    if (!itemId) continue;
    const key = `${row.talent_user_id}:${itemId}`;
    completedByUserItem.set(key, (completedByUserItem.get(key) ?? 0) + 1);
  }
  const started = new Set((startsRes.data ?? []).map((row) => `${row.talent_user_id}:${row.course_id}`));

  for (const userId of userIds) {
    const entry = result.get(userId)!;
    for (const item of items) {
      const track = item.program_track as ProgramTrack;
      const key = `${userId}:${item.id}`;
      const total = totalByItem.get(item.id) ?? 0;
      const completed = completedByUserItem.get(key) ?? 0;
      const published = item.status === 'published' && item.is_active;
      entry[track] = {
        id: item.id,
        title: item.title,
        published,
        completed,
        total,
        started: started.has(key) || completed > 0,
        done: published && total > 0 && completed === total,
      };
    }
  }
  return result;
}
