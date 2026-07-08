import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

/**
 * Business in-app notification channel (business_notifications, 00106).
 *
 * Net-new: business users had no notifications surface. Written by the jobs
 * services (candidate applied, question asked, interview RSVP, offer
 * responses, ...) and read by the business-portal bell. Deliberately NOT the
 * talent notifications tables — those FK to talent_users and carry
 * admin-broadcast semantics.
 */

export interface CreateBusinessNotificationInput {
  businessUserId: string;
  type: string; // 'job_candidate_applied', 'job_question_asked', ...
  title: string;
  body?: string | null;
  ref?: Record<string, unknown>; // {card_id, candidate_id, round_id, offer_id, question_id, route}
}

/**
 * Fire-and-forget insert — a notification write must never fail the jobs
 * mutation that triggered it. No-op when businessUserId is missing (cards can
 * arrive before the business_users row exists).
 */
export async function createBusinessNotification(
  input: CreateBusinessNotificationInput,
): Promise<void> {
  if (!input.businessUserId) return;
  try {
    const { error } = await supabaseAdmin.from('business_notifications').insert({
      business_user_id: input.businessUserId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      ref: input.ref ?? {},
    });
    if (error) {
      console.error('[business-notifications] insert failed', {
        type: input.type,
        error: error.message,
      });
    }
  } catch (err) {
    console.error('[business-notifications] insert threw', err);
  }
}

export async function listForBusiness(businessUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_notifications')
    .select('id, type, title, body, ref, read_at, created_at')
    .eq('business_user_id', businessUserId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new AppError(500, `Failed to load notifications: ${error.message}`);
  return data ?? [];
}

export async function getUnreadCount(businessUserId: string): Promise<{ unread: number }> {
  const { count, error } = await supabaseAdmin
    .from('business_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('business_user_id', businessUserId)
    .is('read_at', null);
  if (error) throw new AppError(500, `Failed to get unread count: ${error.message}`);
  return { unread: count ?? 0 };
}

export async function markRead(businessUserId: string, notificationId: string) {
  const { data, error } = await supabaseAdmin
    .from('business_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('business_user_id', businessUserId)
    .is('read_at', null)
    .select('id, read_at')
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to mark read: ${error.message}`);
  return data ?? { id: notificationId, read_at: null };
}

export async function markAllRead(businessUserId: string): Promise<{ updated: number }> {
  const { error, count } = await supabaseAdmin
    .from('business_notifications')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .eq('business_user_id', businessUserId)
    .is('read_at', null);
  if (error) throw new AppError(500, `Failed to mark all read: ${error.message}`);
  return { updated: count ?? 0 };
}
