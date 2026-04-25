import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.middleware.js';
import { validateAccessToken } from '../services/talent-access.service.js';

/**
 * Validates a Talent-Access JWT and stamps `req.talentAccess`.
 *
 * Re-reads the underlying grant + categories on every request, so
 * revocation, expiration, and category edits in the admin app take
 * effect on the very next call.
 */
export async function talentAccessAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }
    const token = auth.slice(7);
    const session = await validateAccessToken(token);
    req.talentAccess = session;
    next();
  } catch (err) {
    next(err);
  }
}
