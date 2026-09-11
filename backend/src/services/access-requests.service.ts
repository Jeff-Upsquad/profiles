import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as adminService from './admin.service.js';
import * as trainingService from './training.service.js';

export interface BusinessAccessRequest {
  id: string;
  type: 'business';
  company_name: string | null;
  contact_person_name: string | null;
  contact_email: string | null;
  access_expires_at: string | null;
  access_requested_at: string;
}

export interface CourseAccessRequest {
  id: string;
  type: 'course';
  talent_user_id: string;
  talent_name: string | null;
  talent_email: string | null;
  course_id: string;
  course_title: string;
  countdown_hours: number | null;
  current_expires_at: string | null;
  reason: string | null;
  requested_at: string;
}

export interface PendingRequestsResponse {
  business: BusinessAccessRequest[];
  course: CourseAccessRequest[];
}

export async function listPendingRequests(): Promise<PendingRequestsResponse> {
  // Business: any business_user with a non-null access_requested_at.
  // (The user only sets it when their access is expired and they click Request Access.)
  const { data: businessRows, error: businessErr } = await supabaseAdmin
    .from('business_users')
    .select('id, company_name, contact_person_name, contact_email, access_expires_at, access_requested_at')
    .not('access_requested_at', 'is', null)
    .order('access_requested_at', { ascending: false });

  if (businessErr) throw new AppError(500, businessErr.message);

  const business: BusinessAccessRequest[] = (businessRows ?? []).map((b) => ({
    id: b.id as string,
    type: 'business',
    company_name: b.company_name as string | null,
    contact_person_name: b.contact_person_name as string | null,
    contact_email: b.contact_email as string | null,
    access_expires_at: b.access_expires_at as string | null,
    access_requested_at: b.access_requested_at as string,
  }));

  // Course: pending course_reopen_requests joined with talent + course info.
  const { data: courseRows, error: courseErr } = await supabaseAdmin
    .from('course_reopen_requests')
    // course_id is looked up separately rather than embedded: its FK still
    // points at the retired training_courses table, and the course lives in
    // training_items now (same id).
    .select(
      'id, talent_user_id, course_id, reason, requested_at, ' +
        'talent_users!inner(id, full_name)'
    )
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (courseErr) throw new AppError(500, courseErr.message);

  const talentIds = [...new Set((courseRows ?? []).map((r: any) => r.talent_user_id))];

  const courseIds = [...new Set((courseRows ?? []).map((r: any) => r.course_id))];
  const itemsById = new Map<string, { title: string; countdown_hours: number | null }>();
  if (courseIds.length > 0) {
    const { data: items, error: itemsErr } = await supabaseAdmin
      .from('training_items')
      .select('id, title, countdown_hours')
      .in('id', courseIds);
    if (itemsErr) throw new AppError(500, itemsErr.message);
    for (const i of items ?? []) {
      itemsById.set(i.id as string, {
        title: i.title as string,
        countdown_hours: (i.countdown_hours as number | null) ?? null,
      });
    }
  }

  // Map talent emails (auth.users) and started_at for each (talent, course)
  const talentEmails = new Map<string, string | null>();
  const startsKey = (uid: string, cid: string) => `${uid}:${cid}`;
  const startsMap = new Map<string, string>();

  if (talentIds.length > 0) {
    // Fetch auth emails one by one (no bulk endpoint in Supabase admin SDK)
    await Promise.all(
      talentIds.map(async (uid) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
        talentEmails.set(uid, data?.user?.email ?? null);
      }),
    );

    const { data: starts } = await supabaseAdmin
      .from('training_course_starts')
      .select('talent_user_id, course_id, started_at')
      .in(
        'talent_user_id',
        talentIds,
      );
    for (const s of starts ?? []) {
      startsMap.set(startsKey(s.talent_user_id as string, s.course_id as string), s.started_at as string);
    }
  }

  const course: CourseAccessRequest[] = (courseRows ?? []).map((r: any) => {
    const startedAt = startsMap.get(startsKey(r.talent_user_id, r.course_id));
    const item = itemsById.get(r.course_id as string);
    const hours = item?.countdown_hours ?? null;
    const currentExpiresAt =
      startedAt && hours
        ? new Date(new Date(startedAt).getTime() + hours * 60 * 60 * 1000).toISOString()
        : null;

    return {
      id: r.id,
      type: 'course',
      talent_user_id: r.talent_user_id,
      talent_name: r.talent_users?.full_name ?? null,
      talent_email: talentEmails.get(r.talent_user_id) ?? null,
      course_id: r.course_id,
      course_title: item?.title ?? 'Unknown course',
      countdown_hours: hours,
      current_expires_at: currentExpiresAt,
      reason: r.reason ?? null,
      requested_at: r.requested_at,
    };
  });

  return { business, course };
}

export async function grantBusinessAccess(
  businessId: string,
  _expiresAt?: string,
) {
  return adminService.clearBusinessAccessExpiry(businessId);
}

export async function grantCourseReopen(requestId: string, adminUserId: string) {
  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('course_reopen_requests')
    .select('id, talent_user_id, course_id, status')
    .eq('id', requestId)
    .single();

  if (fetchErr || !request) throw new AppError(404, 'Request not found');
  if (request.status !== 'pending') {
    throw new AppError(400, `Request is already ${request.status}`);
  }

  // Reset the countdown — talent will start fresh on next press of Start
  await trainingService.reopenItem(
    request.talent_user_id as string,
    request.course_id as string,
  );

  const { error: updateErr } = await supabaseAdmin
    .from('course_reopen_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
    })
    .eq('id', requestId);

  if (updateErr) throw new AppError(500, updateErr.message);

  return { message: 'Request approved and course reopened' };
}

export async function rejectCourseReopen(
  requestId: string,
  adminUserId: string,
  adminNotes?: string,
) {
  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('course_reopen_requests')
    .select('id, status')
    .eq('id', requestId)
    .single();

  if (fetchErr || !request) throw new AppError(404, 'Request not found');
  if (request.status !== 'pending') {
    throw new AppError(400, `Request is already ${request.status}`);
  }

  const { error: updateErr } = await supabaseAdmin
    .from('course_reopen_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminUserId,
      admin_notes: adminNotes ?? null,
    })
    .eq('id', requestId);

  if (updateErr) throw new AppError(500, updateErr.message);

  return { message: 'Request rejected' };
}
