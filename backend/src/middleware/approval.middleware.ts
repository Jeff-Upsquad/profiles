import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';

/**
 * Middleware that checks whether the talent user's account is approved
 * before allowing access to job profile creation endpoints.
 */
export async function requireApproval(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('approval_status')
      .eq('id', userId)
      .single();

    if (error || !data) {
      throw new AppError(404, 'Talent user not found');
    }

    if (data.approval_status !== 'approved') {
      throw new AppError(403, 'Your account is pending approval. You cannot create job profiles until your account is approved.');
    }

    next();
  } catch (err) {
    next(err);
  }
}
