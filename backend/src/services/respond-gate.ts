import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Respond gates — a user may accept/decline/bid on a requirement card only
 * once their profile is "complete":
 *   Talent: the mandatory sections of their basic profile are filled in.
 *   Agency: they've set at least one service on their agency profile.
 *
 * Visibility stays "matched cards only" (status quo): these gates only decide
 * whether the respond / bid actions are allowed, they never change what a user
 * can *see*.
 */

export async function talentCanRespond(userId: string): Promise<boolean> {
  // Reuse the single source of truth for "basic profile mandatory complete".
  const { computeOnboardingProgress } = await import('./talent.service.js');
  const progress = await computeOnboardingProgress(userId);
  if (!progress.signed_up) return false;
  return progress.basic_profile_completed;
}

export async function agencyCanRespond(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from('agency_profiles')
    .select('services')
    .eq('agency_user_id', userId)
    .maybeSingle();
  const services = Array.isArray((profile as any)?.services)
    ? ((profile as any).services as unknown[])
    : [];
  return services.length > 0;
}

export async function assertTalentCanRespond(userId: string): Promise<void> {
  if (await talentCanRespond(userId)) return;
  throw new AppError(403, 'Complete your profile before accepting, declining, or bidding.');
}

export async function assertAgencyCanRespond(userId: string): Promise<void> {
  if (await agencyCanRespond(userId)) return;
  throw new AppError(403, 'Complete your agency profile (add at least one service) before responding.');
}