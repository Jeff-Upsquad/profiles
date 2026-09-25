import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { notifyTalentsInApp } from './jobs.service.js';
import { notifyBroadcast } from './push.service.js';
import type { CreateWebinarInput, UpdateWebinarInput } from '../validators/webinars.validators.js';

export const WEBINAR_WHATSAPP_EVENT = 'talent_webinar_reminder';

export type WebinarReminderStage = 'day' | 't30' | 't5';

export interface WebinarRow {
  id: string;
  title: string;
  starts_at: string;
  language: string;
  meeting_link: string;
  audience: string;
  status: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function listAdminWebinars() {
  const { data, error } = await supabaseAdmin
    .from('training_webinars')
    .select('id, title, starts_at, language, meeting_link, audience, status, created_at')
    .order('starts_at', { ascending: true })
    .limit(200);
  if (error) throw new AppError(500, `Failed to list webinars: ${error.message}`);
  const webinars = data ?? [];
  if (webinars.length === 0) return [];
  const ids = webinars.map((w: any) => w.id);
  const { data: regs } = await supabaseAdmin
    .from('training_webinar_registrations')
    .select('webinar_id')
    .in('webinar_id', ids);
  const counts = new Map<string, number>();
  for (const r of regs ?? []) {
    const id = (r as any).webinar_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return webinars.map((w: any) => ({ ...w, registrations: counts.get(w.id) ?? 0 }));
}

export async function createWebinar(input: CreateWebinarInput, createdBy: string | null) {
  const startsAt = new Date(input.starts_at);
  if (Number.isNaN(startsAt.getTime())) throw new AppError(400, 'Invalid date and time');
  if (startsAt.getTime() <= Date.now()) throw new AppError(400, 'Webinar must be scheduled in the future');
  const { data, error } = await supabaseAdmin
    .from('training_webinars')
    .insert({
      title: input.title.trim(),
      starts_at: startsAt.toISOString(),
      language: input.language.trim() || 'en',
      meeting_link: input.meeting_link.trim(),
      audience: input.audience,
      status: input.status,
      created_by: createdBy,
    })
    .select('id, title, starts_at, language, meeting_link, audience, status, created_at')
    .single();
  if (error || !data) throw new AppError(500, error?.message ?? 'Could not create webinar');
  return data;
}

export async function updateWebinar(id: string, input: UpdateWebinarInput) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.starts_at !== undefined) {
    const startsAt = new Date(input.starts_at);
    if (Number.isNaN(startsAt.getTime())) throw new AppError(400, 'Invalid date and time');
    patch.starts_at = startsAt.toISOString();
  }
  if (input.language !== undefined) patch.language = input.language.trim() || 'en';
  if (input.meeting_link !== undefined) patch.meeting_link = input.meeting_link.trim();
  if (input.audience !== undefined) patch.audience = input.audience;
  if (input.status !== undefined) patch.status = input.status;
  if (Object.keys(patch).length === 0) throw new AppError(400, 'Nothing to update');
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('training_webinars')
    .update(patch)
    .eq('id', id)
    .select('id, title, starts_at, language, meeting_link, audience, status, created_at')
    .single();
  if (error || !data) throw new AppError(404, error?.message ?? 'Webinar not found');
  return data;
}

export async function deleteWebinar(id: string) {
  const { error } = await supabaseAdmin.from('training_webinars').delete().eq('id', id);
  if (error) throw new AppError(500, `Failed to delete webinar: ${error.message}`);
  return { success: true };
}

export interface WebinarRegistrant {
  talent_user_id: string;
  full_name: string | null;
  phone: string | null;
  registered_at: string;
  day_notified_at: string | null;
  min30_notified_at: string | null;
  min5_notified_at: string | null;
  /** The common onboarding webinar tick on the talent-board checklist. */
  webinar_attended_at: string | null;
}

export async function listWebinarRegistrations(webinarId: string): Promise<WebinarRegistrant[]> {
  const { data, error } = await supabaseAdmin
    .from('training_webinar_registrations')
    .select(
      'talent_user_id, created_at, day_notified_at, min30_notified_at, min5_notified_at, talent:talent_users(full_name, phone, onboarding_webinar_attended_at)',
    )
    .eq('webinar_id', webinarId)
    .order('created_at', { ascending: true })
    .limit(2000);
  if (error) throw new AppError(500, `Failed to load registrations: ${error.message}`);
  return (data ?? []).map((r: any) => ({
    talent_user_id: r.talent_user_id as string,
    full_name: (r.talent?.full_name as string | null) ?? null,
    phone: (r.talent?.phone as string | null) ?? null,
    registered_at: r.created_at as string,
    day_notified_at: (r.day_notified_at as string | null) ?? null,
    min30_notified_at: (r.min30_notified_at as string | null) ?? null,
    min5_notified_at: (r.min5_notified_at as string | null) ?? null,
    webinar_attended_at: (r.talent?.onboarding_webinar_attended_at as string | null) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Talent
// ---------------------------------------------------------------------------

async function isThailandTalent(talentUserId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from('talent_users')
    .select('phone, current_location')
    .eq('id', talentUserId)
    .maybeSingle();
  const u = user as { phone: string | null; current_location: string | null } | null;
  if (u?.phone && /\+?66/.test(u.phone.replace(/[\s-]/g, ''))) return true;
  if (u?.current_location && /thai/i.test(u.current_location)) return true;
  const { data: basic } = await supabaseAdmin
    .from('talent_basic_profiles')
    .select('permanent_country')
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (basic && /thai/i.test(String((basic as any).permanent_country ?? ''))) return true;
  return false;
}

export async function listUpcomingForTalent(talentUserId: string) {
  const thailand = await isThailandTalent(talentUserId);
  const { data, error } = await supabaseAdmin
    .from('training_webinars')
    .select('id, title, starts_at, language, meeting_link, audience, status')
    .eq('status', 'published')
    .gte('starts_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true })
    .limit(50);
  if (error) throw new AppError(500, `Failed to load webinars: ${error.message}`);
  const visible = (data ?? []).filter(
    (w: any) => w.audience === 'all' || thailand || w.audience === 'thailand',
  );
  // Thailand webinars are the product here — everyone sees them, Thailand
  // talents are the registration audience. So no hard geo-hide: list all.
  const ids = visible.map((w: any) => w.id);
  let registered = new Set<string>();
  if (ids.length > 0) {
    const { data: regs } = await supabaseAdmin
      .from('training_webinar_registrations')
      .select('webinar_id')
      .eq('talent_user_id', talentUserId)
      .in('webinar_id', ids);
    registered = new Set((regs ?? []).map((r: any) => r.webinar_id as string));
  }
  return visible.map((w: any) => ({ ...w, registered: registered.has(w.id) }));
}

export async function registerForWebinar(talentUserId: string, webinarId: string) {
  const { data: webinar, error } = await supabaseAdmin
    .from('training_webinars')
    .select('id, title, starts_at, status')
    .eq('id', webinarId)
    .maybeSingle();
  if (error || !webinar) throw new AppError(404, 'Webinar not found');
  if ((webinar as any).status !== 'published') throw new AppError(400, 'This webinar is not open for registration');
  if (new Date((webinar as any).starts_at).getTime() <= Date.now()) {
    throw new AppError(400, 'This webinar has already started');
  }
  const { error: regErr } = await supabaseAdmin
    .from('training_webinar_registrations')
    .upsert({ webinar_id: webinarId, talent_user_id: talentUserId }, { onConflict: 'webinar_id,talent_user_id' });
  if (regErr) throw new AppError(500, `Could not register: ${regErr.message}`);

  // Instant confirmation in the notification panel (not one of the 3 timed
  // reminders — just the "you're in" receipt with the meeting link).
  try {
    await notifyTalentsInApp(
      [talentUserId],
      'webinar_registered',
      `Registered: ${(webinar as any).title}`,
      `You're registered. We'll remind you on the day, 30 min before, and 5 min before it starts.`,
      '/talent/training',
    );
  } catch (e) {
    console.error('[webinars] registration confirm notify failed:', e);
  }
  // Talent-board follow-through: "Onboarding webinar" → "Webinar registered".
  try {
    const { advanceOnWebinarRegistration } = await import('./onboarding-hub.service.js');
    await advanceOnWebinarRegistration(talentUserId);
  } catch (e) {
    console.error('[webinars] talent-board advance failed:', e);
  }
  return { success: true };
}

export async function unregisterFromWebinar(talentUserId: string, webinarId: string) {
  await supabaseAdmin
    .from('training_webinar_registrations')
    .delete()
    .eq('webinar_id', webinarId)
    .eq('talent_user_id', talentUserId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Reminders — day-of, T-30m, T-5m
// ---------------------------------------------------------------------------

function reminderCopy(stage: WebinarReminderStage, title: string, meetingLink: string): { title: string; body: string } {
  if (stage === 'day') {
    return {
      title: `Today: ${title}`,
      body: `Your webinar "${title}" is today. Join here when it starts: ${meetingLink}`,
    };
  }
  if (stage === 't30') {
    return {
      title: `Starting in 30 min: ${title}`,
      body: `Your webinar "${title}" starts in 30 minutes. Join here: ${meetingLink}`,
    };
  }
  return {
    title: `Starting in 5 min: ${title}`,
    body: `Your webinar "${title}" starts in 5 minutes — join now: ${meetingLink}`,
  };
}

function systemTypeFor(stage: WebinarReminderStage): string {
  if (stage === 'day') return 'webinar_day_reminder';
  if (stage === 't30') return 'webinar_30m_reminder';
  return 'webinar_5m_reminder';
}

function stampColumn(stage: WebinarReminderStage): string {
  if (stage === 'day') return 'day_notified_at';
  if (stage === 't30') return 'min30_notified_at';
  return 'min5_notified_at';
}

async function sendStageReminder(
  webinar: WebinarRow,
  talentIds: string[],
  stage: WebinarReminderStage,
): Promise<void> {
  if (talentIds.length === 0) return;
  const copy = reminderCopy(stage, webinar.title, webinar.meeting_link);
  // 1) Notification panel (in-app rows).
  try {
    await notifyTalentsInApp(talentIds, systemTypeFor(stage), copy.title, copy.body, '/talent/training');
  } catch (e) {
    console.error(`[webinars] ${stage} in-app notify failed:`, e);
  }
  // 2) Push.
  notifyBroadcast(talentIds, { title: copy.title, body: copy.body, route: '/talent/training' }).catch((e) =>
    console.error(`[webinars] ${stage} push failed:`, e),
  );
  // 3) WhatsApp via CRM system event. The CRM sends `followup_text` as a free
  //    "quick" message while the talent's 24h window is open, otherwise falls
  //    back to the mapped opener template and queues the details as a reply
  //    follow-up — the same pattern as profile-changes WhatsApps.
  const { data: talents } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, phone')
    .in('id', talentIds);
  const when = new Date(webinar.starts_at).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  for (const t of (talents ?? []) as any[]) {
    if (!t.phone) continue;
    const first = String(t.full_name ?? '').trim().split(/\s+/)[0] || 'there';
    const followup = `Hi ${first}, reminder: "${webinar.title}" (${webinar.language}) is ${stage === 'day' ? 'today' : stage === 't30' ? 'starting in 30 minutes' : 'starting in 5 minutes'} — ${when}. Join here: ${webinar.meeting_link}`;
    void deliverCrmSystemEvent({
      audience: 'talent',
      event: WEBINAR_WHATSAPP_EVENT,
      name: t.full_name ?? null,
      phone: t.phone,
      data: {
        webinar_name: webinar.title,
        date_time: webinar.starts_at,
        language: webinar.language,
        meeting_link: webinar.meeting_link,
        reminder_stage: stage,
        changes: `${webinar.title} (${when})`,
        followup_text: followup,
      },
    }).catch((e) => console.error(`[webinars] ${stage} WA threw:`, e));
  }
}

/**
 * 60s-tick sweeper. For each published webinar, claims due registrations with
 * a conditional UPDATE (exactly-once per stage) then fans out panel + push +
 * WhatsApp. Windows:
 *  - day : same calendar day (Asia/Bangkok) and event still in the future
 *  - t30 : starts within 30 min
 *  - t5  : starts within 5 min
 */
export async function sweepWebinarReminders(nowMs = Date.now()): Promise<void> {
  const now = new Date(nowMs);
  const bangkokDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const { data: webinars, error } = await supabaseAdmin
    .from('training_webinars')
    .select('id, title, starts_at, language, meeting_link, audience, status')
    .eq('status', 'published')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', new Date(nowMs + 12 * 60 * 60 * 1000).toISOString())
    .limit(50);
  if (error) {
    console.error('[webinars] sweep query failed:', error.message);
    return;
  }

  for (const w of (webinars ?? []) as WebinarRow[]) {
    const startsMs = new Date(w.starts_at).getTime();
    const diffMs = startsMs - nowMs;
    const eventDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(w.starts_at));
    // One stage per tick, most urgent wins — a last-minute registrant gets a
    // single T-5m ping, not all three at once.
    let stage: WebinarReminderStage | null = null;
    if (diffMs > 0 && diffMs <= 5 * 60 * 1000) stage = 't5';
    else if (diffMs > 0 && diffMs <= 30 * 60 * 1000) stage = 't30';
    else if (eventDay === bangkokDay && diffMs > 0) stage = 'day';
    if (!stage) continue;

    try {
      const column = stampColumn(stage);
      // Claim due rows first so concurrent ticks can't double-send.
      const { data: claimed } = await supabaseAdmin
        .from('training_webinar_registrations')
        .update({ [column]: now.toISOString() })
        .eq('webinar_id', w.id)
        .is(column, null)
        .select('talent_user_id');
      const ids = (claimed ?? []).map((r: any) => r.talent_user_id as string).filter(Boolean);
      if (ids.length > 0) await sendStageReminder(w, ids, stage);
    } catch (err) {
      console.error(`[webinars] ${stage} sweep failed for`, w.id, err);
    }
  }
}
