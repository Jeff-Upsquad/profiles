import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

/**
 * Extracts Bearer token from the Authorization header,
 * verifies it with Supabase Auth, and attaches the user to req.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      throw new AppError(401, 'Invalid or expired token');
    }

    const role = (user.user_metadata?.role as UserRole) ?? 'talent';

    req.user = {
      id: user.id,
      email: user.email!,
      role,
    };

    next();
  } catch (err) {
    next(err);
  }
}
