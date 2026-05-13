import { Request, Response, NextFunction } from 'express';
import * as savedFilterService from '../services/saved-filter.service.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

function requireAdminUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) throw new AppError(401, 'Authenticated admin required');
  return userId;
}

export async function listSavedLeadFilters(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = requireAdminUserId(req);
    const formType = (req.query.form_type as string | undefined) || undefined;
    const filters = await savedFilterService.listSavedLeadFilters(adminUserId, formType);
    res.json({ filters });
  } catch (err) {
    next(err);
  }
}

export async function createSavedLeadFilter(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = requireAdminUserId(req);
    const { name, form_type, filter_json } = req.body ?? {};
    if (typeof name !== 'string') throw new AppError(400, 'name is required');
    if (filter_json === undefined) throw new AppError(400, 'filter_json is required');
    const filter = await savedFilterService.createSavedLeadFilter({
      adminUserId,
      name,
      formType: typeof form_type === 'string' && form_type.length > 0 ? form_type : null,
      filterJson: filter_json,
    });
    res.status(201).json({ filter });
  } catch (err) {
    next(err);
  }
}

export async function updateSavedLeadFilter(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = requireAdminUserId(req);
    const id = req.params.id as string;
    const { name, filter_json } = req.body ?? {};
    const patch: { name?: string; filterJson?: unknown } = {};
    if (typeof name === 'string') patch.name = name;
    if (filter_json !== undefined) patch.filterJson = filter_json;
    if (Object.keys(patch).length === 0) throw new AppError(400, 'No fields to update');
    const filter = await savedFilterService.updateSavedLeadFilter(id, adminUserId, patch);
    res.json({ filter });
  } catch (err) {
    next(err);
  }
}

export async function deleteSavedLeadFilter(req: Request, res: Response, next: NextFunction) {
  try {
    const adminUserId = requireAdminUserId(req);
    const id = req.params.id as string;
    const result = await savedFilterService.deleteSavedLeadFilter(id, adminUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
