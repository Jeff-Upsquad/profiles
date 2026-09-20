import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from './errorHandler.middleware.js';

async function check(req: Request, next: NextFunction, kind: 'profile' | 'partner' | 'jobs') {
  try {
    const userId = req.user?.id;
    if (!userId) throw new AppError(401, 'Authentication required');
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('wants_jobs, partner_approval_status')
      .eq('id', userId)
      .single();
    if (error || !data) throw new AppError(404, 'Talent user not found');
    const partnerApproved = data.partner_approval_status === 'approved';
    const allowed = kind === 'profile'
      ? data.wants_jobs || partnerApproved
      : kind === 'partner' ? partnerApproved
        : data.wants_jobs;
    if (!allowed) throw new AppError(403, kind === 'partner'
      ? 'Partner Program access is pending approval.'
      : kind === 'jobs' ? 'Select Jobs in your basic profile to access job openings.'
        : 'Your Partner Program application is pending approval. You can complete training while you wait.');
    next();
  } catch (error) {
    next(error);
  }
}

export const requireProfileAccess = (req: Request, _res: Response, next: NextFunction) => check(req, next, 'profile');
export const requirePartnerAccess = (req: Request, _res: Response, next: NextFunction) => check(req, next, 'partner');
export const requireJobsAccess = (req: Request, _res: Response, next: NextFunction) => check(req, next, 'jobs');
