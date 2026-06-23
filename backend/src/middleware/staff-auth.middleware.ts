import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.middleware.js';
import { validateStaffToken } from '../services/staff-auth.service.js';

/**
 * Validates a staff JWT and stamps `req.staff` (and a synthetic `req.user`).
 * Used by the dedicated /api/staff-auth/* surface (me, logout). The combined
 * admin-or-staff gate lives in module-access.middleware.ts.
 */
export async function staffAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }
    const session = await validateStaffToken(auth.slice(7));
    req.staff = session;
    req.user = { id: session.id, email: session.email, role: 'staff' };
    next();
  } catch (err) {
    next(err);
  }
}
