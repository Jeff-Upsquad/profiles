import { Request, Response, NextFunction } from 'express';
import * as trainingService from '../services/training.service.js';
import * as trainingAssignments from '../services/training-assignments.service.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Training endpoints.
 *
 * Admin routes here configure gating and targeting only — content is authored
 * in SquadHub. Talent routes read the synced content and record progress.
 *
 * The admin-facing names keep saying "course" because that is what the admin
 * UI and its URLs call them; underneath, a course is a training_item.
 */

// ---------------------------------------------------------------------------
// Admin — courses (items)
// ---------------------------------------------------------------------------

export async function getCourses(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.getItems());
  } catch (err) {
    next(err);
  }
}

export async function getArchivedCourses(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.getArchivedItems());
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.getItem(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.updateItem(req.params.id as string, req.body));
  } catch (err) {
    next(err);
  }
}

export async function archiveCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.archiveItem(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function restoreCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.restoreItem(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function reorderCourses(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.reorderItems(req.body));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin — page gating
// ---------------------------------------------------------------------------

export async function getCoursePages(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.getItemPages(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function updatePageConfig(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.updatePageConfig(req.params.pageId as string, req.body));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Admin — enrolment / sharing
// ---------------------------------------------------------------------------

export async function getUserCourseEnrollments(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.getUserItemEnrollments(req.params.userId as string));
  } catch (err) {
    next(err);
  }
}

export async function reopenCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await trainingService.reopenItem(req.params.userId as string, req.params.courseId as string),
    );
  } catch (err) {
    next(err);
  }
}

export async function previewShareAudience(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingAssignments.previewShareAudience(req.body));
  } catch (err) {
    next(err);
  }
}

export async function shareCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingAssignments.shareCourse(req.params.id as string, req.body));
  } catch (err) {
    next(err);
  }
}

export async function getCourseShareStats(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingAssignments.getCourseShareStats(req.params.id as string));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

async function fetchUserCategoryIds(userId: string): Promise<string[]> {
  const { data: profiles, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('category_id')
    .eq('talent_user_id', userId);
  if (error) throw new AppError(500, `Failed to fetch profiles: ${error.message}`);
  return [...new Set((profiles ?? []).map((p: any) => p.category_id))];
}

/**
 * The categories a talent should see training for: those they hold a profile
 * in, plus any whose profile gate they have started. The second half keeps a
 * gate course listed while they are working through it, before the profile
 * it unlocks exists.
 */
async function trainingCategoryIds(userId: string): Promise<string[]> {
  const [profileCategoryIds, gateCategoryIds] = await Promise.all([
    fetchUserCategoryIds(userId),
    trainingService.getStartedGateCategoryIds(userId),
  ]);
  return [...new Set([...profileCategoryIds, ...gateCategoryIds])];
}

export async function getMyTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await trainingCategoryIds(userId);

    const [items, assignments, incompleteCount] = await Promise.all([
      trainingService.getMyItems(userId, categoryIds),
      trainingAssignments.getMyAssignments(userId),
      trainingAssignments.getIncompleteAssignmentCount(userId),
    ]);

    // `courses` and `sops` are the two tracks of one item list. They stay as
    // separate keys because the talent UI presents them as separate sections.
    res.json({
      courses: items.filter((i) => i.track !== 'sop'),
      sops: items.filter((i) => i.track === 'sop'),
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
    res.json({ courses: await trainingService.getOnboardingItems(userId, categoryIds) });
  } catch (err) {
    next(err);
  }
}

export async function getCourseForTalent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await trainingCategoryIds(userId);
    const item = await trainingService.getItemForTalent(userId, req.params.id as string, categoryIds);
    if (!item) throw new AppError(404, 'Course not found');
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function markComplete(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.markPageComplete(req.user!.id, req.params.pageId as string));
  } catch (err) {
    next(err);
  }
}

export async function markIncomplete(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.markPageIncomplete(req.user!.id, req.params.pageId as string));
  } catch (err) {
    next(err);
  }
}

export async function startCourse(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.startItem(req.user!.id, req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function requestCourseReopen(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await trainingService.requestItemReopen(
        req.user!.id,
        req.params.id as string,
        req.body?.reason,
      ),
    );
  } catch (err) {
    next(err);
  }
}

export async function completeItem(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await trainingService.completeItem(req.user!.id, req.params.id as string));
  } catch (err) {
    next(err);
  }
}

export async function submitQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await trainingService.submitQuiz(req.user!.id, req.params.blockId as string, req.body.answers),
    );
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent — gating
// ---------------------------------------------------------------------------

export async function getModuleAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await fetchUserCategoryIds(userId);
    res.json(await trainingService.getModuleAccess(userId, categoryIds));
  } catch (err) {
    next(err);
  }
}

/**
 * Profile-creation gate for one category. Returns { locked, page, item } — the
 * page that must be completed before a job profile can be built there.
 */
export async function getProfileGate(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(
      await trainingService.getProfileGate(req.user!.id, req.params.categoryId as string),
    );
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Talent — onboarding
// ---------------------------------------------------------------------------

export async function getOnboardingTraining(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await fetchUserCategoryIds(userId);
    const items = await trainingService.getOnboardingItems(userId, categoryIds);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function completeOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const categoryIds = await fetchUserCategoryIds(userId);
    res.json(await trainingService.completeOnboarding(userId, categoryIds));
  } catch (err) {
    next(err);
  }
}
