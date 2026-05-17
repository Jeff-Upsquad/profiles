import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateNotificationInput,
  TargetFilters,
} from '../validators/notifications.validators.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns ids of talent_users matching the given filters.
 * An empty/omitted filter set matches ALL talent users.
 */
async function findMatchingTalentIds(filters: TargetFilters): Promise<string[]> {
  let q = supabaseAdmin.from('talent_users').select('id');

  if (filters.approval_status && filters.approval_status.length > 0) {
    q = q.in('approval_status', filters.approval_status);
  }
  if (typeof filters.is_active === 'boolean') {
    q = q.eq('is_active', filters.is_active);
  }
  if (filters.gender && filters.gender.length > 0) {
    q = q.in('gender', filters.gender);
  }
  if (filters.languages && filters.languages.length > 0) {
    // languages_spoken is a JSONB array. cs (contains) requires all listed
    // values to be present; we want ANY-of, so use overlap with the JSONB.
    // Supabase-js exposes this via .overlaps() on jsonb arrays.
    q = q.overlaps('languages_spoken', filters.languages);
  }
  if (filters.location_contains) {
    q = q.ilike('current_location', `%${filters.location_contains}%`);
  }

  const { data, error } = await q;
  if (error) throw new AppError(500, `Failed to resolve recipients: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function previewRecipients(filters: TargetFilters): Promise<{ count: number }> {
  const ids = await findMatchingTalentIds(filters);
  return { count: ids.length };
}

export async function listAdminNotifications() {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, kind, system_type, title, body, media, target_filters, created_by, created_at')
    .eq('kind', 'broadcast')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new AppError(500, `Failed to list notifications: ${error.message}`);

  const ids = (data ?? []).map((n) => n.id);
  if (ids.length === 0) return [];

  // Aggregate recipient + read counts in a single query.
  const { data: recipRows, error: recipErr } = await supabaseAdmin
    .from('notification_recipients')
    .select('notification_id, read_at')
    .in('notification_id', ids);
  if (recipErr) throw new AppError(500, `Failed to load recipient stats: ${recipErr.message}`);

  const stats = new Map<string, { sent: number; read: number }>();
  for (const r of recipRows ?? []) {
    const id = r.notification_id as string;
    const s = stats.get(id) ?? { sent: 0, read: 0 };
    s.sent += 1;
    if (r.read_at) s.read += 1;
    stats.set(id, s);
  }

  return (data ?? []).map((n) => ({
    ...n,
    recipient_count: stats.get(n.id)?.sent ?? 0,
    read_count: stats.get(n.id)?.read ?? 0,
  }));
}

export async function createBroadcast(
  input: CreateNotificationInput,
  createdBy: string,
) {
  const recipientIds = await findMatchingTalentIds(input.filters);
  if (recipientIds.length === 0) {
    throw new AppError(400, 'No talent users match the selected filters');
  }

  const { data: notification, error: insertErr } = await supabaseAdmin
    .from('notifications')
    .insert({
      kind: 'broadcast',
      title: input.title.trim(),
      body: input.body?.trim() || null,
      media: input.media ?? [],
      target_filters: input.filters,
      created_by: createdBy,
    })
    .select()
    .single();
  if (insertErr) throw new AppError(500, `Failed to create notification: ${insertErr.message}`);

  // Fan-out: one row per recipient. Insert in chunks to stay safely under
  // any payload/parameter limits if the audience is very large.
  const chunkSize = 1000;
  for (let i = 0; i < recipientIds.length; i += chunkSize) {
    const chunk = recipientIds.slice(i, i + chunkSize).map((tid) => ({
      notification_id: notification.id,
      talent_user_id: tid,
    }));
    const { error: recipErr } = await supabaseAdmin
      .from('notification_recipients')
      .insert(chunk);
    if (recipErr) {
      // Best-effort cleanup so we don't leave a half-fanned-out notification.
      await supabaseAdmin.from('notifications').delete().eq('id', notification.id);
      throw new AppError(500, `Failed to fan out notification: ${recipErr.message}`);
    }
  }

  return { ...notification, recipient_count: recipientIds.length, read_count: 0 };
}

export async function deleteNotification(id: string) {
  const { error } = await supabaseAdmin.from('notifications').delete().eq('id', id);
  if (error) throw new AppError(500, `Failed to delete notification: ${error.message}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

export async function listTalentNotifications(talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('notification_recipients')
    .select(
      `
      id,
      read_at,
      created_at,
      notification:notifications (
        id, kind, system_type, title, body, media
      )
    `,
    )
    .eq('talent_user_id', talentUserId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new AppError(500, `Failed to load notifications: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    notification_id: row.notification?.id,
    kind: row.notification?.kind,
    system_type: row.notification?.system_type ?? null,
    title: row.notification?.title ?? '',
    body: row.notification?.body ?? null,
    media: row.notification?.media ?? [],
    read: !!row.read_at,
    read_at: row.read_at,
    created_at: row.created_at,
  }));
}

export async function markRead(recipientId: string, talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .is('read_at', null)
    .select('id, read_at')
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to mark read: ${error.message}`);
  return data ?? { id: recipientId, read_at: null };
}

export async function markAllRead(talentUserId: string) {
  const { error, count } = await supabaseAdmin
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() }, { count: 'exact' })
    .eq('talent_user_id', talentUserId)
    .is('read_at', null);
  if (error) throw new AppError(500, `Failed to mark all read: ${error.message}`);
  return { updated: count ?? 0 };
}

export async function getUnreadCount(talentUserId: string) {
  const { count, error } = await supabaseAdmin
    .from('notification_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('talent_user_id', talentUserId)
    .is('read_at', null);
  if (error) throw new AppError(500, `Failed to get unread count: ${error.message}`);
  return { unread: count ?? 0 };
}
