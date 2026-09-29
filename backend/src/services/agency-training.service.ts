import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { buildItemPayloads, type TalentItem, type TalentPage } from './training-content.service.js';
import { agencyRequirementsComplete, redactAgencyCard } from '../lib/agency-training-access.js';

const ITEM_SELECT = '*, training_item_categories(category_id, categories(id, name, slug))';

function flatten(pages: TalentPage[]): TalentPage[] {
  return pages.flatMap((page) => [page, ...flatten(page.children)]);
}

export async function getAgencyTraining(agencyUserId: string): Promise<TalentItem[]> {
  const { data, error } = await supabaseAdmin.from('training_items')
    .select(ITEM_SELECT)
    .eq('agency_audience', true)
    .eq('status', 'published')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to load agency training: ${error.message}`);
  return buildItemPayloads((data ?? []).map((item: any) => ({
    ...item,
    categories: (item.training_item_categories ?? []).map((row: any) => row.categories).filter(Boolean),
  })), agencyUserId, false, 'agency');
}

/** A published, nonempty onboarding document must be completed before access opens. */
export async function agencyTrainingStatus(agencyUserId: string) {
  const items = await getAgencyTraining(agencyUserId);
  const required = items.filter((item) => item.is_onboarding);
  const completed = agencyRequirementsComplete(required);
  return { completed, required: required.map((item) => ({
    id: item.id, title: item.title, completed: item.completed_count, total: item.total_count,
  })) };
}

export async function assertAgencyTrainingComplete(agencyUserId: string): Promise<void> {
  if ((await agencyTrainingStatus(agencyUserId)).completed) return;
  throw new AppError(403, 'Complete your agency training program to unlock this action.');
}

async function agencyPage(agencyUserId: string, pageId: string): Promise<TalentPage> {
  const items = await getAgencyTraining(agencyUserId);
  const page = items.flatMap((item) => flatten(item.pages)).find((row) => row.id === pageId);
  if (!page) throw new AppError(404, 'Training page not found');
  if (!page.unlocked) throw new AppError(403, 'Complete the previous training section first.');
  if (!page.completable) throw new AppError(400, 'This page has no training content to complete.');
  return page;
}

export async function startAgencyCourse(agencyUserId: string, courseId: string) {
  const items = await getAgencyTraining(agencyUserId);
  const item = items.find((row) => row.id === courseId);
  if (!item) throw new AppError(404, 'Agency training course not found');
  if (!item.countdown_enabled) throw new AppError(400, 'This course does not have a countdown');
  if (item.started_at) return { started_at: item.started_at };
  const started_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from('agency_training_course_starts')
    .upsert({ agency_user_id: agencyUserId, course_id: courseId, started_at },
      { onConflict: 'agency_user_id,course_id', ignoreDuplicates: true });
  if (error) throw new AppError(500, error.message);
  return { started_at };
}

export async function completeAgencyPage(agencyUserId: string, pageId: string) {
  const page = await agencyPage(agencyUserId, pageId);
  const quizIds = page.blocks.filter((b) => b.type === 'quiz').map((b) => b.id);
  if (quizIds.length) {
    const { data, error } = await supabaseAdmin.from('agency_training_quiz_attempts')
      .select('block_id, passed').eq('agency_user_id', agencyUserId).in('block_id', quizIds);
    if (error) throw new AppError(500, error.message);
    const passed = new Set((data ?? []).filter((a) => a.passed).map((a) => a.block_id));
    if (quizIds.some((id) => !passed.has(id))) throw new AppError(403, 'Pass every quiz on this page first.');
  }
  const { error } = await supabaseAdmin.from('agency_training_page_progress')
    .upsert({ agency_user_id: agencyUserId, page_id: pageId }, { onConflict: 'agency_user_id,page_id', ignoreDuplicates: true });
  if (error) throw new AppError(500, error.message);
  return { completed: true };
}

export async function submitAgencyQuiz(agencyUserId: string, blockId: string, answers: Record<string, string>) {
  const { data: block, error: blockError } = await supabaseAdmin.from('training_blocks')
    .select('id, page_id, type').eq('id', blockId).maybeSingle();
  if (blockError || !block || block.type !== 'quiz') throw new AppError(404, 'Quiz not found');
  const page = await agencyPage(agencyUserId, block.page_id);
  if (!page.blocks.some((b) => b.id === blockId)) throw new AppError(404, 'Quiz not found');
  const { data: questions, error } = await supabaseAdmin.from('training_quiz_questions')
    .select('id, correct_option_id, explanation').eq('block_id', blockId);
  if (error) throw new AppError(500, error.message);
  if (!questions?.length) throw new AppError(400, 'This quiz has no questions');
  const results = questions.map((q) => ({
    question_id: q.id,
    given_option_id: answers[q.id] ?? null,
    correct_option_id: q.correct_option_id,
    correct: answers[q.id] === q.correct_option_id,
    explanation: q.explanation ?? null,
  }));
  const score_percent = Math.round(100 * results.filter((r) => r.correct).length / results.length);
  const passed = results.every((r) => r.correct);
  const { error: saveError } = await supabaseAdmin.from('agency_training_quiz_attempts')
    .insert({ agency_user_id: agencyUserId, block_id: blockId, answers, score_percent, passed });
  if (saveError) throw new AppError(500, saveError.message);
  return { score_percent, passed, results };
}

/** Remove client-identifying/freeform fields at the API boundary during training.
 * The browser never receives names or raw notes, so CSS cannot reveal them.
 */
export async function redactAgencyCardsUntilTrained<T extends { card: any }>(
  agencyUserId: string, cards: T[],
): Promise<T[]> {
  if ((await agencyTrainingStatus(agencyUserId)).completed) return cards;
  return cards.map(redactAgencyCard);
}
