import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';
import { validateBusinessToken } from '../services/business-auth.service.js';
import type { UserRole } from '../../../shared/src/types/auth.js';

/**
 * Extracts Bearer token from the Authorization header,
 * verifies it with Supabase Auth (talent/admin) or custom JWT (business),
 * and attaches the user to req.
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

    // Try Supabase auth first (for talent/admin)
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (!error && user) {
      const role = (user.user_metadata?.role as UserRole) ?? 'talent';
      req.user = {
        id: user.id,
        email: user.email!,
        role,
      };
      return next();
    }

    // Try custom business JWT
    const businessUser = await validateBusinessToken(token);
    if (businessUser) {
      req.user = businessUser;
      return next();
    }

    throw new AppError(401, 'Invalid or expired token');
  } catch (err) {
    next(err);
  }
}
