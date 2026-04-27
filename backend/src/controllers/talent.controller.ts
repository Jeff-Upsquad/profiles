import { Request, Response, NextFunction } from 'express';
import * as talentService from '../services/talent.service.js';

function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getTalentUser(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.updateTalentUser(req.user!.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getBasicProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getBasicProfile(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateBasicProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.updateBasicProfile(req.user!.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMyLeadSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getLeadSubmissionForTalent(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getMyProfiles(req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getProfile(paramStr(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.createProfile(
      req.user!.id,
      req.body.category_id,
      req.body.field_data
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.updateProfile(paramStr(req.params.id), req.user!.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function submitProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.submitProfile(paramStr(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deactivateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.deactivateProfile(paramStr(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reactivateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.reactivateProfile(paramStr(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.softDeleteProfile(paramStr(req.params.id), req.user!.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Portfolio Items
// ---------------------------------------------------------------------------

export async function getPortfolioItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getPortfolioItems(paramStr(req.params.id), req.user!.id);
    res.json({ items: result });
  } catch (err) {
    next(err);
  }
}

export async function addPortfolioItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.addPortfolioItem(paramStr(req.params.id), req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deletePortfolioItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.deletePortfolioItem(
      paramStr(req.params.id),
      req.user!.id,
      paramStr(req.params.itemId)
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updatePortfolioItem(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.updatePortfolioItem(
      paramStr(req.params.id),
      req.user!.id,
      paramStr(req.params.itemId),
      req.body
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function reorderPortfolioItems(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.reorderPortfolioItems(
      paramStr(req.params.id),
      req.user!.id,
      req.body.items
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public: Categories
// ---------------------------------------------------------------------------

export async function getCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getActiveCategories();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await talentService.getCategoryBySlug(paramStr(req.params.slug));
    res.json(result);
  } catch (err) {
    next(err);
  }
}
