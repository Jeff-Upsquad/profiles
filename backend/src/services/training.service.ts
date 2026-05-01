import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateChapterInput,
  UpdateChapterInput,
  CreateLessonInput,
  UpdateLessonInput,
} from '../validators/training.validators.js';
import type { ReorderInput } from '../validators/admin.validators.js';

// ---------------------------------------------------------------------------
// Admin — Chapters
// ---------------------------------------------------------------------------

export async function getChapters() {
  const { data, error } = await supabaseAdmin
    .from('training_chapters')
    .select('*, training_chapter_categories(category_id, categories(id, name, slug))')
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, `Failed to fetch chapters: ${error.message}`);

  const chapters = (data ?? []).map((ch: any) => ({
    ...ch,
    categories: (ch.training_chapter_categories ?? []).map((cc: any) => cc.categories),
    training_chapter_categories: undefined,
  }));

  // Attach lesson counts
  const chapterIds = chapters.map((ch: any) => ch.id);
  if (chapterIds.length > 0) {
    const { data: lessons, error: lErr } = await supabaseAdmin
      .from('training_lessons')
      .select('chapter_id')
      .in('chapter_id', chapterIds);

    if (lErr) throw new AppError(500, `Failed to fetch lesson counts: ${lErr.message}`);

    const countMap: Record<string, number> = {};
    for (const l of lessons ?? []) {
      countMap[l.chapter_id] = (countMap[l.chapter_id] || 0) + 1;
    }
    for (const ch of chapters) {
      (ch as any).lesson_count = countMap[ch.id] || 0;
    }
  }

  return chapters;
}

export async function getChapter(id: string) {
  const { data, error } = await supabaseAdmin
    .from('training_chapters')
    .select('*, training_chapter_categories(category_id, categories(id, name, slug))')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Chapter not found');
    throw new AppError(500, `Failed to fetch chapter: ${error.message}`);
  }

  return {
    ...data,
    categories: (data.training_chapter_categories ?? []).map((cc: any) => cc.categories),
    training_chapter_categories: undefined,
  };
}

export async function createChapter(input: CreateChapterInput) {
  const { category_ids, ...chapterData } = input;

  if (chapterData.is_onboarding) {
    await supabaseAdmin
      .from('training_chapters')
      .update({ is_onboarding: false })
      .eq('is_onboarding', true);
  }

  const { data, error } = await supabaseAdmin
    .from('training_chapters')
    .insert(chapterData)
    .select()
    .single();

  if (error) throw new AppError(500, `Failed to create chapter: ${error.message}`);

  const joinRows = category_ids.map((cid) => ({
    chapter_id: data.id,
    category_id: cid,
  }));

  const { error: joinErr } = await supabaseAdmin
    .from('training_chapter_categories')
    .insert(joinRows);

  if (joinErr) throw new AppError(500, `Failed to assign categories: ${joinErr.message}`);

  return getChapter(data.id);
}

export async function updateChapter(id: string, input: UpdateChapterInput) {
  const { category_ids, ...chapterData } = input;

  if (chapterData.is_onboarding) {
    await supabaseAdmin
      .from('training_chapters')
      .update({ is_onboarding: false })
      .eq('is_onboarding', true)
      .neq('id', id);
  }

  if (Object.keys(chapterData).length > 0) {
    const { error } = await supabaseAdmin
      .from('training_chapters')
      .update(chapterData)
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'Chapter not found');
      throw new AppError(500, `Failed to update chapter: ${error.message}`);
    }
  }

  if (category_ids) {
    const { error: delErr } = await supabaseAdmin
      .from('training_chapter_categories')
      .delete()
      .eq('chapter_id', id);

    if (delErr) throw new AppError(500, `Failed to clear categories: ${delErr.message}`);

    const joinRows = category_ids.map((cid) => ({
      chapter_id: id,
      category_id: cid,
    }));

    const { error: insErr } = await supabaseAdmin
      .from('training_chapter_categories')
      .insert(joinRows);

    if (insErr) throw new AppError(500, `Failed to assign categories: ${insErr.message}`);
  }

  return getChapter(id);
}

export async function deleteChapter(id: string) {
  const { error } = await supabaseAdmin
    .from('training_chapters')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(500, `Failed to delete chapter: ${error.message}`);
  return { message: 'Chapter deleted' };
}

export async function reorderChapters(input: ReorderInput) {
  const updates = input.items.map((item) =>
    supabaseAdmin
      .from('training_chapters')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);
  for (const result of results) {
    if (result.error) {
      throw new AppError(500, `Failed to reorder chapters: ${result.error.message}`);
    }
  }

  return { message: 'Chapters reordered' };
}

// ---------------------------------------------------------------------------
// Admin — Lessons
// ---------------------------------------------------------------------------

async function attachVideos(lessons: any[]) {
  if (lessons.length === 0) return lessons;
  const lessonIds = lessons.map((l) => l.id);
  const { data: videos, error } = await supabaseAdmin
    .from('training_lesson_videos')
    .select('lesson_id, language, loom_url')
    .in('lesson_id', lessonIds);

  if (error) throw new AppError(500, `Failed to fetch lesson videos: ${error.message}`);

  const byLesson: Record<string, { language: string; loom_url: string }[]> = {};
  for (const v of videos ?? []) {
    if (!byLesson[v.lesson_id]) byLesson[v.lesson_id] = [];
    byLesson[v.lesson_id].push({ language: v.language, loom_url: v.loom_url });
  }

  return lessons.map((l) => ({ ...l, videos: byLesson[l.id] ?? [] }));
}

async function replaceLessonVideos(lessonId: string, videos: { language: string; loom_url: string }[]) {
  const { error: delErr } = await supabaseAdmin
    .from('training_lesson_videos')
    .delete()
    .eq('lesson_id', lessonId);

  if (delErr) throw new AppError(500, `Failed to clear videos: ${delErr.message}`);

  if (videos.length === 0) return;

  const rows = videos.map((v) => ({
    lesson_id: lessonId,
    language: v.language,
    loom_url: v.loom_url,
  }));

  const { error: insErr } = await supabaseAdmin
    .from('training_lesson_videos')
    .insert(rows);

  if (insErr) throw new AppError(500, `Failed to save videos: ${insErr.message}`);
}

export async function getLessons(chapterId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_lessons')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, `Failed to fetch lessons: ${error.message}`);
  return attachVideos(data ?? []);
}

export async function createLesson(chapterId: string, input: CreateLessonInput) {
  const { videos, ...lessonData } = input;

  const primaryUrl = videos[0]?.loom_url ?? '';

  const { data, error } = await supabaseAdmin
    .from('training_lessons')
    .insert({ ...lessonData, loom_url: primaryUrl, chapter_id: chapterId })
    .select()
    .single();

  if (error) throw new AppError(500, `Failed to create lesson: ${error.message}`);

  await replaceLessonVideos(data.id, videos);
  const [withVideos] = await attachVideos([data]);
  return withVideos;
}

export async function updateLesson(lessonId: string, input: UpdateLessonInput) {
  const { videos, ...lessonData } = input;

  if (videos && videos.length > 0) {
    (lessonData as any).loom_url = videos[0].loom_url;
  }

  if (Object.keys(lessonData).length > 0) {
    const { error } = await supabaseAdmin
      .from('training_lessons')
      .update(lessonData)
      .eq('id', lessonId);

    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'Lesson not found');
      throw new AppError(500, `Failed to update lesson: ${error.message}`);
    }
  }

  if (videos) {
    await replaceLessonVideos(lessonId, videos);
  }

  const { data, error: fetchErr } = await supabaseAdmin
    .from('training_lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (fetchErr) throw new AppError(500, `Failed to fetch lesson: ${fetchErr.message}`);

  const [withVideos] = await attachVideos([data]);
  return withVideos;
}

export async function deleteLesson(lessonId: string) {
  const { error } = await supabaseAdmin
    .from('training_lessons')
    .delete()
    .eq('id', lessonId);

  if (error) throw new AppError(500, `Failed to delete lesson: ${error.message}`);
  return { message: 'Lesson deleted' };
}

export async function reorderLessons(input: ReorderInput) {
  const updates = input.items.map((item) =>
    supabaseAdmin
      .from('training_lessons')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
  );

  const results = await Promise.all(updates);
  for (const result of results) {
    if (result.error) {
      throw new AppError(500, `Failed to reorder lessons: ${result.error.message}`);
    }
  }

  return { message: 'Lessons reordered' };
}

// ---------------------------------------------------------------------------
// Talent — Training + Progress
// ---------------------------------------------------------------------------

export async function getTrainingForCategories(categoryIds: string[]) {
  if (categoryIds.length === 0) return [];

  const { data: joinRows, error: jErr } = await supabaseAdmin
    .from('training_chapter_categories')
    .select('chapter_id')
    .in('category_id', categoryIds);

  if (jErr) throw new AppError(500, `Failed to fetch training: ${jErr.message}`);

  const chapterIds = [...new Set((joinRows ?? []).map((r: any) => r.chapter_id))];
  if (chapterIds.length === 0) return [];

  const { data: chapters, error: cErr } = await supabaseAdmin
    .from('training_chapters')
    .select('*')
    .in('id', chapterIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (cErr) throw new AppError(500, `Failed to fetch chapters: ${cErr.message}`);

  const { data: lessons, error: lErr } = await supabaseAdmin
    .from('training_lessons')
    .select('*')
    .in('chapter_id', chapterIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (lErr) throw new AppError(500, `Failed to fetch lessons: ${lErr.message}`);

  const lessonsWithVideos = await attachVideos(lessons ?? []);

  const lessonsByChapter: Record<string, any[]> = {};
  for (const l of lessonsWithVideos) {
    if (!lessonsByChapter[l.chapter_id]) lessonsByChapter[l.chapter_id] = [];
    lessonsByChapter[l.chapter_id].push(l);
  }

  return (chapters ?? []).map((ch: any) => ({
    ...ch,
    lessons: lessonsByChapter[ch.id] ?? [],
  }));
}

export async function getLessonProgress(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_lesson_progress')
    .select('lesson_id, completed_at')
    .eq('talent_user_id', userId);

  if (error) throw new AppError(500, `Failed to fetch progress: ${error.message}`);
  return data ?? [];
}

export async function markLessonComplete(userId: string, lessonId: string) {
  const { error } = await supabaseAdmin
    .from('training_lesson_progress')
    .upsert(
      { talent_user_id: userId, lesson_id: lessonId, completed_at: new Date().toISOString() },
      { onConflict: 'talent_user_id,lesson_id' },
    );

  if (error) throw new AppError(500, `Failed to mark lesson complete: ${error.message}`);
  return { message: 'Lesson marked complete' };
}

export async function markLessonIncomplete(userId: string, lessonId: string) {
  const { error } = await supabaseAdmin
    .from('training_lesson_progress')
    .delete()
    .eq('talent_user_id', userId)
    .eq('lesson_id', lessonId);

  if (error) throw new AppError(500, `Failed to unmark lesson: ${error.message}`);
  return { message: 'Lesson marked incomplete' };
}

// ---------------------------------------------------------------------------
// Module access
// ---------------------------------------------------------------------------

export async function getModuleAccess(userId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return { unlocked: [] as string[], locked: [] as any[] };

  const { data: joinRows, error: jErr } = await supabaseAdmin
    .from('training_chapter_categories')
    .select('chapter_id')
    .in('category_id', categoryIds);

  if (jErr) throw new AppError(500, `Failed to fetch chapter categories: ${jErr.message}`);

  const chapterIds = [...new Set((joinRows ?? []).map((r: any) => r.chapter_id))];
  if (chapterIds.length === 0) return { unlocked: [] as string[], locked: [] as any[] };

  const { data: chapters, error: cErr } = await supabaseAdmin
    .from('training_chapters')
    .select('id, title, linked_module')
    .in('id', chapterIds)
    .eq('is_active', true)
    .not('linked_module', 'is', null);

  if (cErr) throw new AppError(500, `Failed to fetch chapters: ${cErr.message}`);
  if (!chapters || chapters.length === 0) return { unlocked: [] as string[], locked: [] as any[] };

  const linkedChapterIds = chapters.map((ch: any) => ch.id);

  const [lessonsResult, progressResult] = await Promise.all([
    supabaseAdmin
      .from('training_lessons')
      .select('id, chapter_id')
      .in('chapter_id', linkedChapterIds)
      .eq('is_active', true),
    supabaseAdmin
      .from('training_lesson_progress')
      .select('lesson_id')
      .eq('talent_user_id', userId),
  ]);

  if (lessonsResult.error) throw new AppError(500, `Failed to fetch lessons: ${lessonsResult.error.message}`);
  if (progressResult.error) throw new AppError(500, `Failed to fetch progress: ${progressResult.error.message}`);

  const completedSet = new Set((progressResult.data ?? []).map((p: any) => p.lesson_id));

  const lessonsByChapter: Record<string, string[]> = {};
  for (const l of lessonsResult.data ?? []) {
    if (!lessonsByChapter[l.chapter_id]) lessonsByChapter[l.chapter_id] = [];
    lessonsByChapter[l.chapter_id].push(l.id);
  }

  const unlocked: string[] = [];
  const locked: { module: string; chapter_title: string; completed: number; total: number }[] = [];

  for (const ch of chapters) {
    const lessonIds = lessonsByChapter[ch.id] ?? [];
    const completedCount = lessonIds.filter((id) => completedSet.has(id)).length;
    const total = lessonIds.length;

    if (total === 0 || completedCount === total) {
      unlocked.push(ch.linked_module);
    } else {
      locked.push({
        module: ch.linked_module,
        chapter_title: ch.title,
        completed: completedCount,
        total,
      });
    }
  }

  return { unlocked, locked };
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export async function getOnboardingChapter() {
  const { data: chapter, error } = await supabaseAdmin
    .from('training_chapters')
    .select('*')
    .eq('is_onboarding', true)
    .eq('is_active', true)
    .single();

  if (error || !chapter) return null;

  const { data: lessons, error: lErr } = await supabaseAdmin
    .from('training_lessons')
    .select('*')
    .eq('chapter_id', chapter.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (lErr) throw new AppError(500, `Failed to fetch onboarding lessons: ${lErr.message}`);

  return { ...chapter, lessons: await attachVideos(lessons ?? []) };
}

export async function completeOnboarding(userId: string) {
  const chapter = await getOnboardingChapter();
  if (!chapter) throw new AppError(400, 'No onboarding chapter configured');

  if (chapter.lessons.length > 0) {
    const { data: progress, error: pErr } = await supabaseAdmin
      .from('training_lesson_progress')
      .select('lesson_id')
      .eq('talent_user_id', userId)
      .in('lesson_id', chapter.lessons.map((l: any) => l.id));

    if (pErr) throw new AppError(500, `Failed to verify progress: ${pErr.message}`);

    const completedIds = new Set((progress ?? []).map((p: any) => p.lesson_id));
    const allComplete = chapter.lessons.every((l: any) => completedIds.has(l.id));

    if (!allComplete) throw new AppError(400, 'Complete all onboarding lessons first');
  }

  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({ onboarding_completed: true })
    .eq('id', userId);

  if (error) throw new AppError(500, `Failed to complete onboarding: ${error.message}`);
  return { message: 'Onboarding completed' };
}
