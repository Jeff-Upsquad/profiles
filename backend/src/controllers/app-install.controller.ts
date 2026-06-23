import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as appInstallService from '../services/app-install.service.js';
import type { AppCheckinInput } from '../validators/app-install.validators.js';

/** Talent app → POST /api/talent/app-checkin (talent role). Records the build
 *  the user currently has installed; fired once per launch after login. */
export async function checkin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError(401, 'Authentication required');
    await appInstallService.recordCheckin(req.user.id, req.body as AppCheckinInput);
    res.json({ recorded: true });
  } catch (err) {
    next(err);
  }
}

/** Admin panel → GET /api/admin/talent-app/installs (admin role). */
export async function listInstalls(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const installs = await appInstallService.listInstalls();
    res.json({ installs });
  } catch (err) {
    next(err);
  }
}
