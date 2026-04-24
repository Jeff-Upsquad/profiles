import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.middleware.js';

const HEADER_NAME = 'x-squadhub-signature';

/**
 * Verifies the X-SquadHub-Signature header against SQUADHUB_WEBHOOK_SECRET
 * using a constant-time compare. If the secret isn't configured at all we
 * respond 503 so SquadHub knows to retry later rather than silently accept.
 */
export function verifySquadhubSecret(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expected = env.SQUADHUB_WEBHOOK_SECRET;
  if (!expected) {
    return next(new AppError(503, 'SquadHub webhook secret not configured'));
  }

  const provided = req.header(HEADER_NAME) ?? req.header('X-SquadHub-Signature');
  if (typeof provided !== 'string' || provided.length === 0) {
    return next(new AppError(401, 'Missing webhook signature'));
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return next(new AppError(401, 'Invalid webhook signature'));
  }

  next();
}
