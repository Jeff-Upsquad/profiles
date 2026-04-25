import { Request, Response, NextFunction } from 'express';
import * as service from '../services/talent-access.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateGrantInput,
  UpdateGrantInput,
  ExtendGrantInput,
  ListGrantsQuery,
  LoginInput,
  ProfilesQuery,
  FilterOptionsQuery,
} from '../validators/talent-access.validators.js';

// ---------------------------------------------------------------------------
// Admin: grant management
// ---------------------------------------------------------------------------

export async function createGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const adminId = req.user?.id;
    if (!adminId) throw new AppError(401, 'Unauthenticated');
    const result = await service.createGrant(req.body as CreateGrantInput, adminId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listGrants(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.listGrants(req.query as unknown as ListGrantsQuery);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getGrant(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.updateGrant(req.params.id as string, req.body as UpdateGrantInput);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.revokeGrant(req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function extendGrant(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.extendGrant(req.params.id as string, req.body as ExtendGrantInput);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteGrant(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteGrant(req.params.id as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Public: login + browse
// ---------------------------------------------------------------------------

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as LoginInput;
    const result = await service.login(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.getSessionInfo(req.talentAccess);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listProfiles(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.listProfiles(
      req.talentAccess,
      req.query as unknown as ProfilesQuery,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const result = await service.getProfile(req.talentAccess, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getFilterOptions(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.talentAccess) throw new AppError(401, 'Unauthenticated');
    const { category_id } = req.query as unknown as FilterOptionsQuery;
    const result = await service.getFilterOptions(req.talentAccess, category_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
