import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';

/**
 * Account review is a separate ops process from signup. Pending (and approved)
 * talent can log in, build, and submit profiles. Only a rejected account is
 * blocked from submitting for business review.
 */
function assertNotRejected(status: string | null | undefined) {
  if (status === 'rejected') {
    throw new AppError(
      403,
      'Your account was not approved. You can still edit drafts, but you cannot submit a profile for review.',
    );
  }
}

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

    assertNotRejected(data.approval_status);
    next();
  } catch (err) {
    next(err);
  }
}

/** @deprecated Alias of requireApproval — signup no longer waits on approval. */
export const requireApprovalOrAutoApprove = requireApproval;
