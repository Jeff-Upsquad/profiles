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
    const result = await talentService.createProfile(req.user!.id, req.body.category_id);
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
