/**
 * Training assignments — enroll talent in a course/SOP, notify on share,
 * sync progress, and clear the linked notification on complete.
 */
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';

export type TrainingResourceType = 'course' | 'sop';
export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';
export type AssignmentSource =
  | 'auto_category'
  | 'available_to_all'
  | 'manual_share'
  | 'onboarding'
  | 'backfill';

export interface ShareCourseInput {
  /** When true, target every active talent (ignores category_ids). */
  available_to_all?: boolean;
  /** Job-profile category ids to target. Required unless available_to_all. */
  category_ids?: string[];
  /** Create/update in-app notifications (default true). */
  notify?: boolean;
  /** Re-open completed assignments and re-notify (default false). */
  reack?: boolean;
  /** Optional custom notification title. */
  title?: string;
  /** Optional notification body. */
  body?: string;
}

// ---------------------------------------------------------------------------
// Audience resolution (job profiles = talent_profiles.category_id)
// ---------------------------------------------------------------------------

/**
 * Resolve active talent user ids matching the audience.
 * available_to_all → all active talents; else talents with a non-deleted
 * profile in any of the given categories.
 */
export async function resolveTalentIdsByJobProfiles(opts: {
  available_to_all?: boolean;
  category_ids?: string[];
}): Promise<string[]> {
  if (opts.available_to_all) {
    const { data, error } = await supabaseAdmin
      .from('talent_users')
      .select('id')
      .eq('is_active', true);
    if (error) throw new AppError(500, `Failed to resolve talents: ${error.message}`);
    return (data ?? []).map((r) => r.id as string);
  }

  const categoryIds = opts.category_ids ?? [];
  if (categoryIds.length === 0) {
    throw new AppError(400, 'Select at least one job profile (category) or choose Everyone');
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('talent_user_id')
    .in('category_id', categoryIds)
    .is('deleted_at', null);
  if (error) throw new AppError(500, `Failed to resolve profiles: ${error.message}`);

  const talentIds = [...new Set((profiles ?? []).map((p) => p.talent_user_id as string))];
  if (talentIds.length === 0) return [];

  // Restrict to active talents
  const { data: active, error: aErr } = await supabaseAdmin
    .from('talent_users')
    .select('id')
    .in('id', talentIds)
    .eq('is_active', true);
  if (aErr) throw new AppError(500, `Failed to filter active talents: ${aErr.message}`);
  return (active ?? []).map((r) => r.id as string);
}

export async function previewShareAudience(opts: {
  available_to_all?: boolean;
  category_ids?: string[];
}): Promise<{ count: number }> {
  const ids = await resolveTalentIdsByJobProfiles(opts);
  return { count: ids.length };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function createSystemNotification(opts: {
  talentUserIds: string[];
  systemType: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
}): Promise<string | null> {
  const ids = [...new Set(opts.talentUserIds)].filter(Boolean);
  if (ids.length === 0) return null;

  const { data: notification, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      kind: 'system',
      system_type: opts.systemType,
      title: opts.title,
      body: opts.body ?? null,
      link_url: opts.linkUrl ?? null,
    })
    .select('id')
    .single();

  if (error || !notification) {
    console.error('[training] notification insert failed', error?.message);
    return null;
  }

  const { error: recErr } = await supabaseAdmin
    .from('notification_recipients')
    .insert(ids.map((tid) => ({ notification_id: notification.id, talent_user_id: tid })));
  if (recErr) {
    console.error('[training] notification fan-out failed', recErr.message);
  }
  return notification.id as string;
}

async function markNotificationReadForTalent(
  notificationId: string | null | undefined,
  talentUserId: string,
): Promise<void> {
  if (!notificationId) return;
  const { error } = await supabaseAdmin
    .from('notification_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('notification_id', notificationId)
    .eq('talent_user_id', talentUserId)
    .is('read_at', null);
  if (error) {
    console.error('[training] failed to mark notification read', error.message);
  }
}

// ---------------------------------------------------------------------------
// Course progress helpers
// ---------------------------------------------------------------------------

async function getCourseLessonStats(
  courseId: string,
  talentUserId: string,
): Promise<{ total: number; done: number }> {
  const { data: chapters, error: chErr } = await supabaseAdmin
    .from('training_chapters')
    .select('id')
    .eq('course_id', courseId)
    .eq('is_active', true);
  if (chErr) throw new AppError(500, `Failed to fetch chapters: ${chErr.message}`);
  const chapterIds = (chapters ?? []).map((c) => c.id as string);
  if (chapterIds.length === 0) return { total: 0, done: 0 };

  const { data: lessons, error: lErr } = await supabaseAdmin
    .from('training_lessons')
    .select('id')
    .in('chapter_id', chapterIds)
    .eq('is_active', true);
  if (lErr) throw new AppError(500, `Failed to fetch lessons: ${lErr.message}`);
  const lessonIds = (lessons ?? []).map((l) => l.id as string);
  if (lessonIds.length === 0) return { total: 0, done: 0 };

  const { data: progress, error: pErr } = await supabaseAdmin
    .from('training_lesson_progress')
    .select('lesson_id')
    .eq('talent_user_id', talentUserId)
    .in('lesson_id', lessonIds);
  if (pErr) throw new AppError(500, `Failed to fetch progress: ${pErr.message}`);

  return { total: lessonIds.length, done: (progress ?? []).length };
}

function progressFromStats(total: number, done: number): {
  progress_percent: number;
  status: AssignmentStatus;
} {
  if (total <= 0) return { progress_percent: 0, status: 'not_started' };
  const pct = Math.min(100, Math.round((100 * done) / total));
  if (done >= total) return { progress_percent: 100, status: 'completed' };
  if (done > 0) return { progress_percent: pct, status: 'in_progress' };
  return { progress_percent: 0, status: 'not_started' };
}

// ---------------------------------------------------------------------------
// Share course
// ---------------------------------------------------------------------------

export async function shareCourse(
  courseId: string,
  input: ShareCourseInput,
): Promise<{ recipient_count: number; notified: number; reopened: number }> {
  const { data: course, error } = await supabaseAdmin
    .from('training_courses')
    .select('id, title, is_onboarding, available_to_all, deleted_at, is_active')
    .eq('id', courseId)
    .single();
  if (error || !course) {
    if (error?.code === 'PGRST116') throw new AppError(404, 'Course not found');
    throw new AppError(500, `Failed to load course: ${error?.message}`);
  }
  if (course.deleted_at) throw new AppError(400, 'Cannot share an archived course');
  if (!course.is_active) throw new AppError(400, 'Cannot share an inactive course');

  const availableToAll = !!input.available_to_all;
  const categoryIds = input.category_ids ?? [];
  const talentIds = await resolveTalentIdsByJobProfiles({
    available_to_all: availableToAll,
    category_ids: categoryIds,
  });

  if (talentIds.length === 0) {
    throw new AppError(400, 'No talent users match the selected job profiles');
  }

  const notify = input.notify !== false;
  const reack = !!input.reack;
  const source: AssignmentSource = availableToAll
    ? 'available_to_all'
    : course.is_onboarding
      ? 'onboarding'
      : 'manual_share';

  // Existing assignments for this course
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('training_assignments')
    .select('id, talent_user_id, status, notification_id')
    .eq('resource_type', 'course')
    .eq('resource_id', courseId)
    .in('talent_user_id', talentIds);
  if (exErr) throw new AppError(500, `Failed to load assignments: ${exErr.message}`);

  const existingByTalent = new Map(
    (existing ?? []).map((r) => [r.talent_user_id as string, r]),
  );

  const toNotify: string[] = [];
  let reopened = 0;
  const now = new Date().toISOString();

  // Bulk-insert missing assignments (progress syncs on lesson complete)
  const missing = talentIds.filter((tid) => !existingByTalent.has(tid));
  if (missing.length > 0) {
    const rows = missing.map((tid) => ({
      talent_user_id: tid,
      resource_type: 'course' as const,
      resource_id: courseId,
      source,
      status: 'not_started' as const,
      progress_percent: 0,
      assigned_at: now,
    }));
    // Chunk inserts to stay under payload limits
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error: insErr } = await supabaseAdmin
        .from('training_assignments')
        .upsert(slice, { onConflict: 'talent_user_id,resource_type,resource_id', ignoreDuplicates: true });
      if (insErr) throw new AppError(500, `Failed to create assignments: ${insErr.message}`);
    }
    toNotify.push(...missing);
  }

  for (const tid of talentIds) {
    const row = existingByTalent.get(tid);
    if (!row) continue;

    if (reack && row.status === 'completed') {
      const { error: upErr } = await supabaseAdmin
        .from('training_assignments')
        .update({
          status: 'not_started',
          progress_percent: 0,
          completed_at: null,
          started_at: null,
          assigned_at: now,
          source: 'manual_share',
        })
        .eq('id', row.id);
      if (upErr) throw new AppError(500, `Failed to reopen assignment: ${upErr.message}`);
      reopened += 1;
      toNotify.push(tid);
    } else if (row.status !== 'completed') {
      // Already assigned and incomplete — re-notify on share
      toNotify.push(tid);
    }
  }

  let notified = 0;
  if (notify && toNotify.length > 0) {
    const title =
      input.title?.trim() ||
      (reack ? `Updated: ${course.title}` : `New training: ${course.title}`);
    const body =
      input.body?.trim() ||
      'Open Training Program, review the content, and mark it complete.';
    const linkUrl = `/talent/training?resource=course:${courseId}`;
    const systemType = reack ? 'training_updated' : 'training_assigned';

    const notificationId = await createSystemNotification({
      talentUserIds: toNotify,
      systemType,
      title,
      body,
      linkUrl,
    });
    notified = toNotify.length;

    if (notificationId) {
      const { error: linkErr } = await supabaseAdmin
        .from('training_assignments')
        .update({ notification_id: notificationId })
        .eq('resource_type', 'course')
        .eq('resource_id', courseId)
        .in('talent_user_id', toNotify);
      if (linkErr) {
        console.error('[training] failed to link notification to assignments', linkErr.message);
      }
    }
  }

  return {
    recipient_count: talentIds.length,
    notified,
    reopened,
  };
}

// ---------------------------------------------------------------------------
// Sync progress after lesson complete/incomplete
// ---------------------------------------------------------------------------

/**
 * Recompute assignment progress for the course that owns this lesson.
 * When complete, marks linked notification as read.
 */
export async function syncCourseAssignmentForLesson(
  talentUserId: string,
  lessonId: string,
): Promise<void> {
  const { data: lesson, error } = await supabaseAdmin
    .from('training_lessons')
    .select('chapter_id, training_chapters!inner(course_id)')
    .eq('id', lessonId)
    .single();
  if (error || !lesson) return;

  const courseId = (lesson as any).training_chapters?.course_id as string | null;
  if (!courseId) return;

  await syncCourseAssignment(talentUserId, courseId);
}

export async function syncCourseAssignment(
  talentUserId: string,
  courseId: string,
): Promise<void> {
  const stats = await getCourseLessonStats(courseId, talentUserId);
  const prog = progressFromStats(stats.total, stats.done);
  const now = new Date().toISOString();

  // Load existing assignment
  const { data: existing } = await supabaseAdmin
    .from('training_assignments')
    .select('id, status, notification_id')
    .eq('talent_user_id', talentUserId)
    .eq('resource_type', 'course')
    .eq('resource_id', courseId)
    .maybeSingle();

  if (!existing) {
    // Soft-ensure: create assignment so badge stays accurate for organic progress
    await supabaseAdmin.from('training_assignments').insert({
      talent_user_id: talentUserId,
      resource_type: 'course',
      resource_id: courseId,
      source: 'backfill',
      status: prog.status,
      progress_percent: prog.progress_percent,
      started_at: prog.status !== 'not_started' ? now : null,
      completed_at: prog.status === 'completed' ? now : null,
    });
    return;
  }

  const patch: Record<string, unknown> = {
    progress_percent: prog.progress_percent,
    status: prog.status,
  };
  if (prog.status !== 'not_started') {
    // only set started_at if null — use a conditional update via select
  }
  if (prog.status === 'completed') {
    patch.completed_at = now;
  } else {
    patch.completed_at = null;
  }

  // started_at: set when first progress if missing
  if (prog.status !== 'not_started') {
    const { data: cur } = await supabaseAdmin
      .from('training_assignments')
      .select('started_at')
      .eq('id', existing.id)
      .single();
    if (!cur?.started_at) patch.started_at = now;
  }

  const { error: upErr } = await supabaseAdmin
    .from('training_assignments')
    .update(patch)
    .eq('id', existing.id);
  if (upErr) {
    console.error('[training] failed to sync assignment', upErr.message);
    return;
  }

  if (prog.status === 'completed' && existing.status !== 'completed') {
    await markNotificationReadForTalent(existing.notification_id as string | null, talentUserId);
  }
}

// ---------------------------------------------------------------------------
// Talent badge count + list
// ---------------------------------------------------------------------------

/**
 * Incomplete assignment count for the Training Program sidebar badge.
 * Only counts resources that still exist and are active/published.
 */
export async function getIncompleteAssignmentCount(talentUserId: string): Promise<number> {
  const { data: rows, error } = await supabaseAdmin
    .from('training_assignments')
    .select('id, resource_type, resource_id')
    .eq('talent_user_id', talentUserId)
    .neq('status', 'completed');
  if (error) throw new AppError(500, `Failed to count assignments: ${error.message}`);
  if (!rows?.length) return 0;

  const courseIds = rows.filter((r) => r.resource_type === 'course').map((r) => r.resource_id);
  const sopIds = rows.filter((r) => r.resource_type === 'sop').map((r) => r.resource_id);

  let activeCourseIds = new Set<string>();
  if (courseIds.length > 0) {
    const { data: courses, error: cErr } = await supabaseAdmin
      .from('training_courses')
      .select('id')
      .in('id', courseIds)
      .eq('is_active', true)
      .is('deleted_at', null);
    if (cErr) throw new AppError(500, `Failed to filter courses: ${cErr.message}`);
    activeCourseIds = new Set((courses ?? []).map((c) => c.id as string));
  }

  let activeSopIds = new Set<string>();
  if (sopIds.length > 0) {
    // SOPs table lands in a later migration; ignore if missing.
    try {
      const { data: sops, error: sErr } = await supabaseAdmin
        .from('training_sops')
        .select('id')
        .in('id', sopIds)
        .eq('status', 'published')
        .is('deleted_at', null);
      if (!sErr && sops) {
        activeSopIds = new Set(sops.map((s) => s.id as string));
      }
    } catch {
      // table may not exist yet
    }
  }

  return rows.filter((r) => {
    if (r.resource_type === 'course') return activeCourseIds.has(r.resource_id as string);
    if (r.resource_type === 'sop') return activeSopIds.has(r.resource_id as string);
    return false;
  }).length;
}

export async function getMyAssignments(talentUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('training_assignments')
    .select(
      'id, resource_type, resource_id, status, progress_percent, assigned_at, started_at, completed_at, source, notification_id',
    )
    .eq('talent_user_id', talentUserId)
    .order('assigned_at', { ascending: false });
  if (error) throw new AppError(500, `Failed to fetch assignments: ${error.message}`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Admin share stats
// ---------------------------------------------------------------------------

export async function getCourseShareStats(courseId: string): Promise<{
  assigned: number;
  completed: number;
  in_progress: number;
  not_started: number;
}> {
  const { data, error } = await supabaseAdmin
    .from('training_assignments')
    .select('status')
    .eq('resource_type', 'course')
    .eq('resource_id', courseId);
  if (error) throw new AppError(500, `Failed to load share stats: ${error.message}`);

  const stats = { assigned: 0, completed: 0, in_progress: 0, not_started: 0 };
  for (const row of data ?? []) {
    stats.assigned += 1;
    if (row.status === 'completed') stats.completed += 1;
    else if (row.status === 'in_progress') stats.in_progress += 1;
    else stats.not_started += 1;
  }
  return stats;
}
