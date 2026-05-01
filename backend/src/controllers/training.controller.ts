import { Request, Response, NextFunction } from 'express';
import * as trainingService from '../services/training.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

// ---------------------------------------------------------------------------
// Admin — Chapters
// ---------------------------------------------------------------------------

export async function getChapters(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await trainingService.getChapters();
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

export async function getMyTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;

    const { data: profiles, error } = await supabaseAdmin
      .from('talent_profiles')
      .select('category_id')
      .eq('user_id', userId);

    if (error) throw new AppError(500, `Failed to fetch profiles: ${error.message}`);

    const categoryIds = [...new Set((profiles ?? []).map((p: any) => p.category_id))];

    const [chapters, progress] = await Promise.all([
      trainingService.getTrainingForCategories(categoryIds),
      trainingService.getLessonProgress(userId),
    ]);

    const completedSet = new Set(progress.map((p: any) => p.lesson_id));

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

    res.json({ chapters: chaptersWithProgress });
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
      .eq('user_id', userId);

    if (error) throw new AppError(500, `Failed to fetch profiles: ${error.message}`);

    const categoryIds = [...new Set((profiles ?? []).map((p: any) => p.category_id))];
    const access = await trainingService.getModuleAccess(userId, categoryIds);
    res.json(access);
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
    const data = await trainingService.completeOnboarding(req.user!.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
