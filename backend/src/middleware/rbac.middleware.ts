import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.middleware.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

/**
 * Factory that returns middleware requiring the authenticated user
 * to have one of the specified roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Insufficient permissions'));
    }

    next();
  };
}
