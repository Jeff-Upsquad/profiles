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

/**
 * A rejected / disqualified Jobs application closes the Jobs section (feed,
 * interviews, offers) until an admin reinstates it. Preferences stay editable
 * — the basic-profile form saves them, and the matcher skips rejected talents.
 */
export async function requireJobsNotRejected(req: Request, _res: Response, next: NextFunction) {
  try {
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('jobs_pipeline_stage')
      .eq('id', req.user!.id)
      .single();
    if (error || !data) throw new AppError(404, 'Talent user not found');
    if (data.jobs_pipeline_stage === 'rejected') {
      throw new AppError(403, 'Your Jobs application was not approved, so job openings are unavailable.');
    }
    next();
  } catch (error) {
    next(error);
  }
}
