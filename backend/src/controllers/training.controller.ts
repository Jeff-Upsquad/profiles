import { Request, Response, NextFunction } from 'express';
import * as trainingService from '../services/training.service.js';
import * as trainingAssignments from '../services/training-assignments.service.js';
import * as trainingSopService from '../services/training-sop.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ---------------------------------------------------------------------------
// Admin — Courses
// ---------------------------------------------------------------------------

export async function getCourses(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getCourses();
    res.json(data);
  } catch (err) { next(err); }
}

export async function getArchivedCourses(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getArchivedCourses();
    res.json(data);
  } catch (err) { next(err); }
}

export async function getCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getCourse(req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}

export async function createCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.createCourse(req.body);
    res.status(201).json(data);
  } catch (err) { next(err); }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.updateCourse(req.params.id as string, req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function archiveCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.archiveCourse(req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}

export async function restoreCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.restoreCourse(req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}

export async function reorderCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.reorderCourses(req.body);
    res.json(data);
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Admin — Course enrollment management
// ---------------------------------------------------------------------------

export async function getUserCourseEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getUserCourseEnrollments(req.params.userId as string);
    res.json({ enrollments: data });
  } catch (err) { next(err); }
}

export async function reopenCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.reopenCourse(req.params.userId as string, req.params.courseId as string);
    res.json(data);
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Admin — Share course by job profile
// ---------------------------------------------------------------------------

export async function previewShareAudience(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingAssignments.previewShareAudience(req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function shareCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingAssignments.shareCourse(req.params.id as string, req.body);
    res.json(data);
  } catch (err) { next(err); }
}

export async function getCourseShareStats(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingAssignments.getCourseShareStats(req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Talent — Course start (countdown)
// ---------------------------------------------------------------------------

export async function startCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = await trainingService.startCourse(userId, req.params.id as string);
    res.json(data);
  } catch (err) { next(err); }
}

export async function requestCourseReopen(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const data = await trainingService.requestCourseReopen(
      userId,
      req.params.id as string,
      req.body?.reason,
    );
    res.status(data.already ? 200 : 201).json(data);
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Admin — Chapters
// ---------------------------------------------------------------------------

export async function getChapters(req: Request, res: Response, next: NextFunction) {
  try {
    const courseQuery = req.query.course_id;
    let courseId: string | null | undefined = undefined;
    if (typeof courseQuery === 'string') {
      courseId = courseQuery === 'null' ? null : courseQuery;
    }
    const data = await trainingService.getChapters(courseId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getChapter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getChapter(req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createChapter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.createChapter(req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateChapter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.updateChapter(req.params.id as string, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteChapter(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.deleteChapter(req.params.id as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reorderChapters(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.reorderChapters(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin — Lessons
// ---------------------------------------------------------------------------

export async function getLessons(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getLessons(req.params.chapterId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function createLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.createLesson(req.params.chapterId as string, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

export async function updateLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.updateLesson(req.params.lessonId as string, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function deleteLesson(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.deleteLesson(req.params.lessonId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function reorderLessons(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.reorderLessons(req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent — Training
// ---------------------------------------------------------------------------

async function fetchUserCategoryIds(userId: string): Promise<string[]> {
  const { data: profiles, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('category_id')
    .eq('talent_user_id', userId);
  if (error) throw new AppError(500, `Failed to fetch profiles: ${error.message}`);
  return [...new Set((profiles ?? []).map((p: any) => p.category_id))];
}

export async function getMyTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    // Categories the talent has a profile in, plus any whose profile-gate lesson
    // they've completed — so a gate course stays listed in the Training Program
    // (rewatchable) even before they finish building that profile.
    const [profileCategoryIds, gateCategoryIds] = await Promise.all([
      fetchUserCategoryIds(userId),
      trainingService.getStartedGateCategoryIds(userId),
    ]);
    const categoryIds = [...new Set([...profileCategoryIds, ...gateCategoryIds])];

    const [courses, chapters, progress] = await Promise.all([
      trainingService.getMyCourses(userId, categoryIds),
      trainingService.getTrainingForCategories(categoryIds),
      trainingService.getLessonProgress(userId),
    ]);

    const completedSet = new Set(progress.map((p: any) => p.lesson_id));

    // Legacy chapter shape for backward compat (chapters not yet in a course)
    const chaptersWithProgress = chapters.map((ch: any) => {
      const lessons = (ch.lessons ?? []).map((l: any) => ({
        ...l,
        completed: completedSet.has(l.id),
      }));
      return {
        ...ch,
        lessons,
        completed_count: lessons.filter((l: any) => l.completed).length,
        total_count: lessons.length,
      };
    });

    const [assignments, incompleteCount, sops] = await Promise.all([
      trainingAssignments.getMyAssignments(userId),
      trainingAssignments.getIncompleteAssignmentCount(userId),
      trainingSopService.getMySops(userId).catch(() => []),
    ]);

    res.json({
      courses,
      chapters: chaptersWithProgress,
      sops,
      assignments,
      incomplete_count: incompleteCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function getIncompleteTrainingCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await trainingAssignments.getIncompleteAssignmentCount(req.user!.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

export async function getMyOnboardingCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await fetchUserCategoryIds(userId);
    const courses = await trainingService.getOnboardingCourses(userId, categoryIds);
    res.json({ courses });
  } catch (err) {
    next(err);
  }
}

export async function markComplete(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.markLessonComplete(req.user!.id, req.params.lessonId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function markIncomplete(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.markLessonIncomplete(req.user!.id, req.params.lessonId as string);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent — Module access
// ---------------------------------------------------------------------------

export async function getModuleAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const { data: profiles, error } = await supabaseAdmin
      .from('talent_profiles')
      .select('category_id')
      .eq('talent_user_id', userId);

    if (error) throw new AppError(500, `Failed to fetch profiles: ${error.message}`);

    const categoryIds = [...new Set((profiles ?? []).map((p: any) => p.category_id))];
    const access = await trainingService.getModuleAccess(userId, categoryIds);
    res.json(access);
  } catch (err) {
    next(err);
  }
}

// Profile-creation gate for a single category (the one being built). Returns
// { locked, chapter } — the chapter (with lessons) that must be completed
// before the talent can create a job profile in that category.
export async function getProfileGate(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryId = req.params.categoryId as string;
    const gate = await trainingService.getProfileGate(userId, categoryId);
    res.json(gate);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent — Onboarding
// ---------------------------------------------------------------------------

export async function getOnboardingTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const chapter = await trainingService.getOnboardingChapter();
    if (!chapter) {
      res.json({ chapter: null });
      return;
    }

    const progress = await trainingService.getLessonProgress(req.user!.id);
    const completedSet = new Set(progress.map((p: any) => p.lesson_id));

    const lessons = (chapter.lessons ?? []).map((l: any) => ({
      ...l,
      completed: completedSet.has(l.id),
    }));

    res.json({
      chapter: {
        ...chapter,
        lessons,
        completed_count: lessons.filter((l: any) => l.completed).length,
        total_count: lessons.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await fetchUserCategoryIds(userId);
    const data = await trainingService.completeOnboarding(userId, categoryIds);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
