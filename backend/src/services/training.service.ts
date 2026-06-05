import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateCourseInput,
  UpdateCourseInput,
  CreateChapterInput,
  UpdateChapterInput,
  CreateLessonInput,
  UpdateLessonInput,
} from '../validators/training.validators.js';
import type { ReorderInput } from '../validators/admin.validators.js';

// ---------------------------------------------------------------------------
// Admin — Courses
// ---------------------------------------------------------------------------

async function loadCourse(id: string) {
  const { data, error } = await supabaseAdmin
    .from('training_courses')
    .select('*, training_course_categories(category_id, categories(id, name, slug))')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Course not found');
    throw new AppError(500, `Failed to fetch course: ${error.message}`);
  }
  return {
    ...data,
    categories: (data.training_course_categories ?? []).map((cc: any) => cc.categories),
    training_course_categories: undefined,
  };
}

async function attachChapterCounts(courses: any[]) {
  if (courses.length === 0) return courses;
  const courseIds = courses.map((c) => c.id);
  const { data, error } = await supabaseAdmin
    .from('training_chapters')
    .select('course_id')
    .in('course_id', courseIds);
  if (error) throw new AppError(500, `Failed to fetch chapter counts: ${error.message}`);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.course_id] = (counts[row.course_id] || 0) + 1;
  }
  return courses.map((c) => ({ ...c, chapter_count: counts[c.id] || 0 }));
}

async function assertOnboardingCategoryUniqueness(
  categoryIds: string[],
  excludeCourseId?: string,
) {
  if (categoryIds.length === 0) return;
  let query = supabaseAdmin
    .from('training_course_categories')
    .select('category_id, course_id, training_courses!inner(id, is_onboarding, deleted_at)')
    .in('category_id', categoryIds)
    .eq('training_courses.is_onboarding', true)
    .is('training_courses.deleted_at', null);
  if (excludeCourseId) query = query.neq('course_id', excludeCourseId);
  const { data, error } = await query;
  if (error) throw new AppError(500, `Failed to validate category uniqueness: ${error.message}`);
  if (data && data.length > 0) {
    const conflicts = [...new Set(data.map((row: any) => row.category_id))];
    throw new AppError(
      400,
      `Each category may belong to only one onboarding course. Conflicting category ids: ${conflicts.join(', ')}`,
    );
  }
}

export async function getCourses() {
  const { data, error } = await supabaseAdmin
    .from('training_courses')
    .select('*, training_course_categories(category_id, categories(id, name, slug))')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch courses: ${error.message}`);
  const courses = (data ?? []).map((c: any) => ({
    ...c,
    categories: (c.training_course_categories ?? []).map((cc: any) => cc.categories),
    training_course_categories: undefined,
  }));
  return attachChapterCounts(courses);
}

export async function getArchivedCourses() {
  const { data, error } = await supabaseAdmin
    .from('training_courses')
    .select('*, training_course_categories(category_id, categories(id, name, slug))')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw new AppError(500, `Failed to fetch archived courses: ${error.message}`);
  return (data ?? []).map((c: any) => ({
    ...c,
    categories: (c.training_course_categories ?? []).map((cc: any) => cc.categories),
    training_course_categories: undefined,
  }));
}

export async function getCourse(id: string) {
  return loadCourse(id);
}

export async function createCourse(input: CreateCourseInput) {
  const { category_ids = [], ...courseData } = input;
  if (courseData.is_onboarding) {
    await assertOnboardingCategoryUniqueness(category_ids);
  }
  const { data, error } = await supabaseAdmin
    .from('training_courses')
    .insert(courseData)
    .select()
    .single();
  if (error) throw new AppError(500, `Failed to create course: ${error.message}`);

  if (category_ids.length > 0) {
    const rows = category_ids.map((cid) => ({ course_id: data.id, category_id: cid }));
    const { error: joinErr } = await supabaseAdmin.from('training_course_categories').insert(rows);
    if (joinErr) throw new AppError(500, `Failed to assign categories: ${joinErr.message}`);
  }
  return loadCourse(data.id);
}

export async function updateCourse(id: string, input: UpdateCourseInput) {
  const { category_ids, ...courseData } = input;

  // Read current state to know is_onboarding for uniqueness check
  let willBeOnboarding = courseData.is_onboarding;
  if (willBeOnboarding === undefined) {
    const { data: existing } = await supabaseAdmin
      .from('training_courses')
      .select('is_onboarding')
      .eq('id', id)
      .single();
    willBeOnboarding = existing?.is_onboarding ?? false;
  }

  if (willBeOnboarding && category_ids && category_ids.length > 0) {
    await assertOnboardingCategoryUniqueness(category_ids, id);
  }

  if (Object.keys(courseData).length > 0) {
    const { error } = await supabaseAdmin
      .from('training_courses')
      .update(courseData)
      .eq('id', id);
    if (error) {
      if (error.code === 'PGRST116') throw new AppError(404, 'Course not found');
      throw new AppError(500, `Failed to update course: ${error.message}`);
    }
  }

  if (category_ids) {
    const { error: delErr } = await supabaseAdmin
      .from('training_course_categories')
      .delete()
      .eq('course_id', id);
    if (delErr) throw new AppError(500, `Failed to clear categories: ${delErr.message}`);

    if (category_ids.length > 0) {
      const rows = category_ids.map((cid) => ({ course_id: id, category_id: cid }));
      const { error: insErr } = await supabaseAdmin.from('training_course_categories').insert(rows);
      if (insErr) throw new AppError(500, `Failed to assign categories: ${insErr.message}`);
    }
  }

  return loadCourse(id);
}

export async function archiveCourse(id: string) {
  const { error } = await supabaseAdmin
    .from('training_courses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to archive course: ${error.message}`);
  return { message: 'Course archived' };
}

export async function restoreCourse(id: string) {
  const { error } = await supabaseAdmin
    .from('training_courses')
    .update({ deleted_at: null })
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to restore course: ${error.message}`);
  return { message: 'Course restored' };
}

export async function reorderCourses(input: ReorderInput) {
  const updates = input.items.map((item) =>
    supabaseAdmin.from('training_courses').update({ sort_order: item.sort_order }).eq('id', item.id),
  );
  const results = await Promise.all(updates);
  for (const r of results) {
    if (r.error) throw new AppError(500, `Failed to reorder courses: ${r.error.message}`);
  }
  return { message: 'Courses reordered' };
}

/**
 * Records that the talent has clicked Start on a countdown-enabled course.
 * No-op (idempotent) if the user has already started it; throws 400 if the
 * course doesn't have countdown_enabled set.
 */
export async function startCourse(userId: string, courseId: string) {
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('training_courses')
    .select('id, countdown_enabled, deleted_at')
    .eq('id', courseId)
    .single();
  if (courseErr || !course) throw new AppError(404, 'Course not found');
  if (course.deleted_at) throw new AppError(404, 'Course not found');
  if (!course.countdown_enabled) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }

  // Idempotent: ignore conflict if already started
  const { data: existing } = await supabaseAdmin
    .from('training_course_starts')
    .select('started_at')
    .eq('talent_user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (existing) return { message: 'Course already started', started_at: existing.started_at };

  const startedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('training_course_starts')
    .insert({ talent_user_id: userId, course_id: courseId, started_at: startedAt });
  if (error) throw new AppError(500, `Failed to start course: ${error.message}`);
  return { message: 'Course started', started_at: startedAt };
}

// ---------------------------------------------------------------------------
// Admin — Chapters
// ---------------------------------------------------------------------------

export async function getChapters(courseId?: string | null) {
  let query = supabaseAdmin
    .from('training_chapters')
    .select('*, training_chapter_categories(category_id, categories(id, name, slug))')
    .order('sort_order', { ascending: true });

  if (courseId === null) {
    query = query.is('course_id', null);
  } else if (typeof courseId === 'string') {
    query = query.eq('course_id', courseId);
  }

  const { data, error } = await query;

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

  if (category_ids && category_ids.length > 0) {
    const joinRows = category_ids.map((cid) => ({
      chapter_id: data.id,
      category_id: cid,
    }));

    const { error: joinErr } = await supabaseAdmin
      .from('training_chapter_categories')
      .insert(joinRows);

    if (joinErr) throw new AppError(500, `Failed to assign categories: ${joinErr.message}`);
  }

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
    .is('course_id', null)
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

  return (chapters ?? [])
    .map((ch: any) => ({
      ...ch,
      lessons: lessonsByChapter[ch.id] ?? [],
    }))
    .filter((ch: any) => ch.lessons.length > 0);
}

export async function getLessonProgress(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_lesson_progress')
    .select('lesson_id, completed_at')
    .eq('talent_user_id', userId);

  if (error) throw new AppError(500, `Failed to fetch progress: ${error.message}`);
  return data ?? [];
}

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

// Admin-set flag that exempts this talent from the onboarding course.
// Treated as a parallel grandfather to hasApprovedProfile — any gate that
// approves-profile-bypasses should also onboarding-bypass.
async function isOnboardingBypassed(userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('skip_onboarding')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to check bypass flag: ${error.message}`);
  return !!data?.skip_onboarding;
}

/**
 * Server-side guard for chapter locks. Returns true if the lesson's chapter
 * is currently locked for this user — by either:
 *   - the course's countdown deadline (course is countdown_enabled and the
 *     user hasn't started it yet, OR has started but the deadline has passed)
 *   - sequential gating in an onboarding course (prior chapter incomplete)
 *
 * Approved talents (grandfather) bypass all locks.
 */
async function isLessonChapterLocked(userId: string, lessonId: string): Promise<boolean> {
  if (await hasApprovedProfile(userId)) return false;
  if (await isOnboardingBypassed(userId)) return false;

  const { data: lesson, error: lErr } = await supabaseAdmin
    .from('training_lessons')
    .select('chapter_id')
    .eq('id', lessonId)
    .single();
  if (lErr || !lesson) return false;

  const { data: chapter, error: cErr } = await supabaseAdmin
    .from('training_chapters')
    .select('id, sort_order, course_id')
    .eq('id', lesson.chapter_id)
    .single();
  if (cErr || !chapter || !chapter.course_id) return false;

  const { data: course, error: courseErr } = await supabaseAdmin
    .from('training_courses')
    .select('id, is_onboarding, deleted_at, countdown_enabled, countdown_hours')
    .eq('id', chapter.course_id)
    .single();
  if (courseErr || !course) return false;
  if (course.deleted_at) return false;

  // Countdown gate: must have started; deadline mustn't have passed
  if (course.countdown_enabled) {
    const { data: startRow } = await supabaseAdmin
      .from('training_course_starts')
      .select('started_at')
      .eq('talent_user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle();
    if (!startRow) return true; // not started yet
    if (course.countdown_hours) {
      const expiresMs = new Date(startRow.started_at).getTime() + course.countdown_hours * 3600_000;
      if (expiresMs < Date.now()) return true; // deadline passed
    }
  }

  if (!course.is_onboarding) return false;

  // Find prior chapters in the same course (sequential gate, onboarding only)
  const { data: priorChapters, error: priorErr } = await supabaseAdmin
    .from('training_chapters')
    .select('id, sort_order')
    .eq('course_id', course.id)
    .eq('is_active', true)
    .lt('sort_order', chapter.sort_order)
    .order('sort_order', { ascending: true });
  if (priorErr) return false;
  if (!priorChapters || priorChapters.length === 0) return false; // first chapter is always unlocked

  const priorChapterIds = priorChapters.map((c: any) => c.id);
  const { data: priorLessons } = await supabaseAdmin
    .from('training_lessons')
    .select('id, chapter_id')
    .in('chapter_id', priorChapterIds)
    .eq('is_active', true);

  const lessonsByChapter: Record<string, string[]> = {};
  for (const l of priorLessons ?? []) {
    if (!lessonsByChapter[l.chapter_id]) lessonsByChapter[l.chapter_id] = [];
    lessonsByChapter[l.chapter_id].push(l.id);
  }

  const allPriorLessonIds = Object.values(lessonsByChapter).flat();
  if (allPriorLessonIds.length === 0) return false;

  const { data: progress } = await supabaseAdmin
    .from('training_lesson_progress')
    .select('lesson_id')
    .eq('talent_user_id', userId)
    .in('lesson_id', allPriorLessonIds);

  const completedSet = new Set((progress ?? []).map((p: any) => p.lesson_id));
  // All prior chapters must have all their lessons completed
  for (const chId of priorChapterIds) {
    const lIds = lessonsByChapter[chId] ?? [];
    if (lIds.some((id) => !completedSet.has(id))) return true;
  }
  return false;
}

export async function markLessonComplete(userId: string, lessonId: string) {
  if (await isLessonChapterLocked(userId, lessonId)) {
    throw new AppError(403, 'This chapter is locked. Complete the previous chapter first.');
  }

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

  // Grandfather: users with at least one approved profile bypass module locks
  const { data: approvedProfiles, error: apErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .limit(1);

  if (apErr) throw new AppError(500, `Failed to check approval status: ${apErr.message}`);
  const hasApprovedProfile = (approvedProfiles?.length ?? 0) > 0;

  // Parallel grandfather: an admin-set onboarding bypass unlocks everything
  // just like having an approved profile would. Roll it into the same
  // `hasApprovedProfile` signal so the chapter loop below treats them
  // identically.
  const bypassed = !hasApprovedProfile && (await isOnboardingBypassed(userId));
  const treatsAsGrandfathered = hasApprovedProfile || bypassed;

  // Find chapters via legacy training_chapter_categories link (chapters without a course)
  const { data: chapterJoinRows, error: jErr } = await supabaseAdmin
    .from('training_chapter_categories')
    .select('chapter_id')
    .in('category_id', categoryIds);

  if (jErr) throw new AppError(500, `Failed to fetch chapter categories: ${jErr.message}`);

  // Find chapters via course-level category link (course → chapters)
  const { data: courseJoinRows, error: cjErr } = await supabaseAdmin
    .from('training_course_categories')
    .select('course_id, training_courses!inner(deleted_at)')
    .in('category_id', categoryIds)
    .is('training_courses.deleted_at', null);

  if (cjErr) throw new AppError(500, `Failed to fetch course categories: ${cjErr.message}`);

  const courseIds = [...new Set((courseJoinRows ?? []).map((r: any) => r.course_id))];
  let courseChapterIds: string[] = [];
  if (courseIds.length > 0) {
    const { data: courseChapters, error: ccErr } = await supabaseAdmin
      .from('training_chapters')
      .select('id')
      .in('course_id', courseIds);
    if (ccErr) throw new AppError(500, `Failed to fetch course chapters: ${ccErr.message}`);
    courseChapterIds = (courseChapters ?? []).map((c: any) => c.id);
  }

  const chapterIds = [
    ...new Set([
      ...(chapterJoinRows ?? []).map((r: any) => r.chapter_id),
      ...courseChapterIds,
    ]),
  ];
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

    if (treatsAsGrandfathered || total === 0 || completedCount === total) {
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
// Talent — Courses
// ---------------------------------------------------------------------------

interface CourseChapterShape {
  id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  linked_module: string | null;
  lessons: any[];
  completed_count: number;
  total_count: number;
  unlocked: boolean;
}

interface CourseShape {
  id: string;
  title: string;
  description?: string | null;
  sort_order: number;
  is_onboarding: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  started_at: string | null;
  expires_at: string | null;
  expired: boolean;
  categories: any[];
  chapters: CourseChapterShape[];
  completed_count: number;
  total_count: number;
}

async function loadCourseStarts(
  userId: string,
  courseIds: string[],
): Promise<Record<string, string>> {
  if (courseIds.length === 0) return {};
  const { data, error } = await supabaseAdmin
    .from('training_course_starts')
    .select('course_id, started_at')
    .eq('talent_user_id', userId)
    .in('course_id', courseIds);
  if (error) throw new AppError(500, `Failed to fetch course starts: ${error.message}`);
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.course_id] = row.started_at;
  }
  return map;
}

async function buildCoursePayloads(
  courses: any[],
  userId: string,
  approved: boolean,
): Promise<CourseShape[]> {
  if (courses.length === 0) return [];

  const courseIds = courses.map((c) => c.id);
  const [chaptersRes, startsByCourse] = await Promise.all([
    supabaseAdmin
      .from('training_chapters')
      .select('id, course_id, title, description, sort_order, linked_module')
      .in('course_id', courseIds)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    loadCourseStarts(userId, courseIds),
  ]);
  const { data: chapters, error: chErr } = chaptersRes;
  if (chErr) throw new AppError(500, `Failed to fetch chapters: ${chErr.message}`);
  const now = Date.now();

  const chapterIds = (chapters ?? []).map((c: any) => c.id);
  let lessons: any[] = [];
  let progressRows: any[] = [];
  if (chapterIds.length > 0) {
    const [lessonsRes, progressRes] = await Promise.all([
      supabaseAdmin
        .from('training_lessons')
        .select('*')
        .in('chapter_id', chapterIds)
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('training_lesson_progress')
        .select('lesson_id')
        .eq('talent_user_id', userId)
        .in('lesson_id', [] as string[]), // populated below if lessons exist
    ]);
    if (lessonsRes.error) throw new AppError(500, `Failed to fetch lessons: ${lessonsRes.error.message}`);
    lessons = await attachVideos(lessonsRes.data ?? []);
    if (lessons.length > 0) {
      const lessonIds = lessons.map((l: any) => l.id);
      const { data: progress, error: pErr } = await supabaseAdmin
        .from('training_lesson_progress')
        .select('lesson_id')
        .eq('talent_user_id', userId)
        .in('lesson_id', lessonIds);
      if (pErr) throw new AppError(500, `Failed to fetch progress: ${pErr.message}`);
      progressRows = progress ?? [];
    }
    void progressRes; // satisfy lint
  }

  const completedSet = new Set(progressRows.map((p: any) => p.lesson_id));
  const lessonsByChapter: Record<string, any[]> = {};
  for (const l of lessons) {
    if (!lessonsByChapter[l.chapter_id]) lessonsByChapter[l.chapter_id] = [];
    lessonsByChapter[l.chapter_id].push({ ...l, completed: completedSet.has(l.id) });
  }

  const chaptersByCourse: Record<string, any[]> = {};
  for (const ch of chapters ?? []) {
    if (!chaptersByCourse[ch.course_id]) chaptersByCourse[ch.course_id] = [];
    chaptersByCourse[ch.course_id].push(ch);
  }

  return courses.map((course: any) => {
    const courseChapters = chaptersByCourse[course.id] ?? [];
    let priorComplete = true; // first chapter is always unlocked
    let courseCompleted = 0;
    let courseTotal = 0;

    // Countdown computation
    const countdownEnabled = course.countdown_enabled === true;
    const countdownHours: number | null = course.countdown_hours ?? null;
    const startedAt: string | null = startsByCourse[course.id] ?? null;
    let expiresAt: string | null = null;
    let expired = false;
    if (countdownEnabled && countdownHours && startedAt) {
      const expiresMs = new Date(startedAt).getTime() + countdownHours * 3600_000;
      expiresAt = new Date(expiresMs).toISOString();
      expired = !approved && expiresMs < now;
    }

    const shapedChapters: CourseChapterShape[] = courseChapters.map((ch: any) => {
      const lessonList = lessonsByChapter[ch.id] ?? [];
      const completed_count = lessonList.filter((l: any) => l.completed).length;
      const total_count = lessonList.length;
      courseCompleted += completed_count;
      courseTotal += total_count;

      let unlocked = true;
      if (!approved) {
        if (course.is_onboarding) {
          unlocked = priorComplete;
        }
        // Countdown lock: applies to all chapters in the course when expired,
        // and keeps everything locked until Start has been clicked on a
        // countdown-enabled course.
        if (expired) unlocked = false;
        if (countdownEnabled && !startedAt) unlocked = false;
      }
      // Update priorComplete for next chapter
      priorComplete = priorComplete && (total_count === 0 || completed_count === total_count);

      return {
        id: ch.id,
        title: ch.title,
        description: ch.description,
        sort_order: ch.sort_order,
        linked_module: ch.linked_module ?? null,
        lessons: lessonList,
        completed_count,
        total_count,
        unlocked,
      };
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      sort_order: course.sort_order,
      is_onboarding: course.is_onboarding,
      countdown_enabled: countdownEnabled,
      countdown_hours: countdownHours,
      started_at: startedAt,
      expires_at: expiresAt,
      expired,
      categories: course.categories ?? [],
      chapters: shapedChapters,
      completed_count: courseCompleted,
      total_count: courseTotal,
    };
  });
}

/**
 * Fetch all courses visible to the talent based on their profile categories.
 * Onboarding courses require category match; non-onboarding are visible if
 * they have no categories OR if any user category matches.
 */
export async function getMyCourses(userId: string, categoryIds: string[]): Promise<CourseShape[]> {
  // Pull all active, non-archived courses with their categories
  const { data: courses, error } = await supabaseAdmin
    .from('training_courses')
    .select('*, training_course_categories(category_id, categories(id, name, slug))')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch courses: ${error.message}`);

  const userCatSet = new Set(categoryIds);
  const visibleCourses = (courses ?? [])
    .map((c: any) => ({
      ...c,
      categories: (c.training_course_categories ?? []).map((cc: any) => cc.categories),
      training_course_categories: undefined,
    }))
    .filter((c: any) => {
      if (c.available_to_all) return true;
      const courseCatIds = (c.categories ?? []).map((cat: any) => cat.id);
      if (c.is_onboarding) {
        return courseCatIds.some((id: string) => userCatSet.has(id));
      }
      // Non-onboarding: visible to all if no categories, else require match
      return courseCatIds.length === 0 || courseCatIds.some((id: string) => userCatSet.has(id));
    });

  const approved = (await hasApprovedProfile(userId)) || (await isOnboardingBypassed(userId));
  return buildCoursePayloads(visibleCourses, userId, approved);
}

export async function getOnboardingCourses(userId: string, categoryIds: string[]): Promise<CourseShape[]> {
  const { data: courses, error } = await supabaseAdmin
    .from('training_courses')
    .select('*, training_course_categories(category_id, categories(id, name, slug))')
    .eq('is_onboarding', true)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });
  if (error) throw new AppError(500, `Failed to fetch onboarding courses: ${error.message}`);

  const userCatSet = new Set(categoryIds);
  const visibleCourses = (courses ?? [])
    .map((c: any) => ({
      ...c,
      categories: (c.training_course_categories ?? []).map((cc: any) => cc.categories),
      training_course_categories: undefined,
    }))
    .filter((c: any) => {
      if (c.available_to_all) return true;
      const courseCatIds = (c.categories ?? []).map((cat: any) => cat.id);
      return courseCatIds.some((id: string) => userCatSet.has(id));
    });

  const approved = (await hasApprovedProfile(userId)) || (await isOnboardingBypassed(userId));
  return buildCoursePayloads(visibleCourses, userId, approved);
}

// ---------------------------------------------------------------------------
// Onboarding (legacy single-chapter API kept for backward compatibility)
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

/**
 * Mark `talent_users.onboarding_completed = true` once every chapter of every
 * matched onboarding course is fully complete. Falls back to the legacy
 * single-chapter onboarding gate if no onboarding courses exist yet.
 */
export async function completeOnboarding(userId: string, categoryIds: string[]) {
  // Admins may have set skip_onboarding for this user; in that case we
  // just confirm the flag on onboarding_completed and return — the
  // per-lesson progress check below would otherwise reject a user who
  // was never required to watch the course in the first place.
  if (await isOnboardingBypassed(userId)) {
    const { error } = await supabaseAdmin
      .from('talent_users')
      .update({ onboarding_completed: true })
      .eq('id', userId);
    if (error) throw new AppError(500, `Failed to complete onboarding: ${error.message}`);
    return { message: 'Onboarding completed (admin bypass)' };
  }

  const onboardingCourses = await getOnboardingCourses(userId, categoryIds);

  if (onboardingCourses.length > 0) {
    for (const course of onboardingCourses) {
      for (const ch of course.chapters) {
        if (ch.total_count > 0 && ch.completed_count !== ch.total_count) {
          throw new AppError(400, `Complete all lessons in "${ch.title}" first`);
        }
      }
    }
  } else {
    // Legacy fallback: single onboarding chapter
    const chapter = await getOnboardingChapter();
    if (chapter && chapter.lessons.length > 0) {
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
  }

  const { error } = await supabaseAdmin
    .from('talent_users')
    .update({ onboarding_completed: true })
    .eq('id', userId);

  if (error) throw new AppError(500, `Failed to complete onboarding: ${error.message}`);
  return { message: 'Onboarding completed' };
}

// ---------------------------------------------------------------------------
// Admin — Course enrollment management
// ---------------------------------------------------------------------------

export async function getUserCourseEnrollments(userId: string) {
  const { data: starts, error: startsErr } = await supabaseAdmin
    .from('training_course_starts')
    .select('course_id, started_at')
    .eq('talent_user_id', userId);
  if (startsErr) throw new AppError(500, `Failed to fetch enrollments: ${startsErr.message}`);
  if (!starts || starts.length === 0) return [];

  const courseIds = starts.map((s) => s.course_id);
  const { data: courses, error: coursesErr } = await supabaseAdmin
    .from('training_courses')
    .select('id, title, countdown_hours')
    .in('id', courseIds);
  if (coursesErr) throw new AppError(500, `Failed to fetch courses: ${coursesErr.message}`);

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));
  const now = Date.now();

  return starts.map((s) => {
    const course = courseMap.get(s.course_id);
    const countdownHours = course?.countdown_hours ?? null;
    let expiresAt: string | null = null;
    let expired = false;
    if (countdownHours && s.started_at) {
      const expiresMs = new Date(s.started_at).getTime() + countdownHours * 3600_000;
      expiresAt = new Date(expiresMs).toISOString();
      expired = expiresMs < now;
    }
    return {
      course_id: s.course_id,
      course_title: course?.title ?? 'Unknown',
      countdown_hours: countdownHours,
      started_at: s.started_at,
      expires_at: expiresAt,
      expired,
    };
  });
}

export async function reopenCourse(userId: string, courseId: string) {
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('training_courses')
    .select('id, countdown_enabled, deleted_at')
    .eq('id', courseId)
    .single();
  if (courseErr || !course) throw new AppError(404, 'Course not found');
  if (course.deleted_at) throw new AppError(404, 'Course not found');
  if (!course.countdown_enabled) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }

  const { data: existing } = await supabaseAdmin
    .from('training_course_starts')
    .select('started_at')
    .eq('talent_user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();
  if (!existing) throw new AppError(404, 'No enrollment found for this user and course');

  const { error } = await supabaseAdmin
    .from('training_course_starts')
    .delete()
    .eq('talent_user_id', userId)
    .eq('course_id', courseId);
  if (error) throw new AppError(500, `Failed to reopen course: ${error.message}`);

  return { message: 'Course reopened' };
}

// Talent-side request to reopen an expired course. Idempotent — if a pending
// request already exists for this (talent, course), returns it instead of
// creating a duplicate.
export async function requestCourseReopen(
  userId: string,
  courseId: string,
  reason?: string,
) {
  const { data: course, error: courseErr } = await supabaseAdmin
    .from('training_courses')
    .select('id, countdown_enabled, countdown_hours, deleted_at')
    .eq('id', courseId)
    .single();
  if (courseErr || !course) throw new AppError(404, 'Course not found');
  if (course.deleted_at) throw new AppError(404, 'Course not found');
  if (!course.countdown_enabled || !course.countdown_hours) {
    throw new AppError(400, 'This course does not have a countdown deadline');
  }

  const { data: start } = await supabaseAdmin
    .from('training_course_starts')
    .select('started_at')
    .eq('talent_user_id', userId)
    .eq('course_id', courseId)
    .maybeSingle();

  if (!start) {
    throw new AppError(400, 'You have not started this course yet');
  }
  const expiry = new Date(
    new Date(start.started_at as string).getTime() +
      (course.countdown_hours as number) * 60 * 60 * 1000,
  );
  if (expiry > new Date()) {
    throw new AppError(400, 'This course has not expired yet');
  }

  // Check for existing pending request (idempotent).
  const { data: existing } = await supabaseAdmin
    .from('course_reopen_requests')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('course_id', courseId)
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
    .insert({
      talent_user_id: userId,
      course_id: courseId,
      reason: reason ?? null,
    })
    .select('id')
    .single();

  if (error) throw new AppError(500, `Failed to create request: ${error.message}`);

  return { message: 'Request sent', requestId: data.id as string, already: false };
}
