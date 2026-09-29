import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { deliverCrmSystemEvent } from '../lib/crm-system-event.js';
import { notifyAgencyBroadcast } from './push.service.js';
import { formatWebinarTime, listActiveWebinarLanguages, type WebinarRow, type WebinarReminderStage } from './webinars.service.js';

type Agency = { id: string; agency_name: string | null; phone: string | null };

async function agencies(ids: string[]): Promise<Agency[]> {
  if (!ids.length) return [];
  const { data, error } = await supabaseAdmin.from('agency_users')
    .select('id, agency_name, phone').in('id', ids);
  if (error) throw new AppError(500, error.message);
  return (data ?? []) as Agency[];
}

async function notice(ids: string[], type: string, title: string, body: string, event: string | null, webinar: WebinarRow, extras: Record<string, unknown> = {}) {
  if (!ids.length) return;
  const rows = await agencies(ids);
  const { error } = await supabaseAdmin.from('agency_training_notifications')
    .insert(rows.map((a) => ({ agency_user_id: a.id, type, title, body })));
  if (error) console.error('[agency-webinars] panel notice failed:', error.message);
  void notifyAgencyBroadcast(ids, { title, body, route: '/agency/training' }).catch((e) =>
    console.error('[agency-webinars] push failed:', e));
  if (!event) return;
  for (const a of rows) {
    if (!a.phone) continue;
    const first = (a.agency_name ?? '').trim().split(/\s+/)[0] || 'there';
    void deliverCrmSystemEvent({
      audience: 'talent', event, name: a.agency_name, phone: a.phone,
      data: {
        talent_name: first, webinar_name: webinar.title,
        date_time: webinar.starts_at,
        date_time_text: formatWebinarTime(webinar.starts_at, a.phone),
        meeting_link: webinar.meeting_link, language: webinar.language,
        ...extras,
      },
      bodyParams: event === 'talent_webinar_new_scheduled'
        ? [first, webinar.title, webinar.language, formatWebinarTime(webinar.starts_at, a.phone)]
        : undefined,
    }).catch((e) => console.error('[agency-webinars] WhatsApp failed:', e));
  }
}

export async function listUpcomingForAgency(agencyUserId: string) {
  const { data, error } = await supabaseAdmin.from('training_webinars')
    .select('id, title, starts_at, language, meeting_link, status')
    .eq('recipient_type', 'agency').eq('status', 'published')
    .gte('starts_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('starts_at', { ascending: true }).limit(50);
  if (error) throw new AppError(500, error.message);
  const ids = (data ?? []).map((w) => w.id);
  if (!ids.length) return [];
  const { data: regs, error: regError } = await supabaseAdmin.from('agency_webinar_registrations')
    .select('webinar_id').eq('agency_user_id', agencyUserId).in('webinar_id', ids);
  if (regError) throw new AppError(500, regError.message);
  const registered = new Set((regs ?? []).map((r) => r.webinar_id));
  return (data ?? []).map((w) => ({ ...w, registered: registered.has(w.id) }));
}

export async function registerAgency(agencyUserId: string, webinarId: string) {
  const { data: webinar, error } = await supabaseAdmin.from('training_webinars')
    .select('id, title, starts_at, language, meeting_link, status, recipient_type')
    .eq('id', webinarId).maybeSingle();
  if (error || !webinar || webinar.recipient_type !== 'agency') throw new AppError(404, 'Agency webinar not found');
  if (webinar.status !== 'published' || new Date(webinar.starts_at).getTime() <= Date.now())
    throw new AppError(400, 'This webinar is not open for registration');
  const { error: saveError } = await supabaseAdmin.from('agency_webinar_registrations')
    .upsert({ webinar_id: webinarId, agency_user_id: agencyUserId }, { onConflict: 'webinar_id,agency_user_id', ignoreDuplicates: true });
  if (saveError) throw new AppError(500, saveError.message);
  await notice([agencyUserId], 'webinar_registered', `Registered: ${webinar.title}`,
    "You're registered. We'll remind you on the day, 30 minutes and 5 minutes before.", null, webinar as WebinarRow);
  return { success: true };
}

export async function unregisterAgency(agencyUserId: string, webinarId: string) {
  const { error } = await supabaseAdmin.from('agency_webinar_registrations')
    .delete().eq('webinar_id', webinarId).eq('agency_user_id', agencyUserId);
  if (error) throw new AppError(500, error.message);
  return { success: true };
}

export async function getAgencyInterests(agencyUserId: string) {
  const { data, error } = await supabaseAdmin.from('agency_webinar_interests')
    .select('language').eq('agency_user_id', agencyUserId);
  if (error) throw new AppError(500, error.message);
  return (data ?? []).map((r) => r.language);
}

export async function addAgencyInterest(agencyUserId: string, language: string) {
  const allowed = await listActiveWebinarLanguages();
  const code = language.trim().toLowerCase();
  if (!allowed.some((l) => l.code === code)) throw new AppError(400, 'This webinar language is not available');
  const { error } = await supabaseAdmin.from('agency_webinar_interests')
    .upsert({ agency_user_id: agencyUserId, language: code }, { onConflict: 'agency_user_id,language', ignoreDuplicates: true });
  if (error) throw new AppError(500, error.message);
  return { success: true };
}

export async function removeAgencyInterest(agencyUserId: string, language: string) {
  const { error } = await supabaseAdmin.from('agency_webinar_interests')
    .delete().eq('agency_user_id', agencyUserId).eq('language', language);
  if (error) throw new AppError(500, error.message);
  return { success: true };
}

export async function listAgencyNotifications(agencyUserId: string) {
  const { data, error } = await supabaseAdmin.from('agency_training_notifications')
    .select('id, type, title, body, created_at, read_at')
    .eq('agency_user_id', agencyUserId).order('created_at', { ascending: false }).limit(30);
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}

export async function sendAgencyNewScheduled(webinar: WebinarRow): Promise<number> {
  const { data: interests, error } = await supabaseAdmin.from('agency_webinar_interests')
    .select('agency_user_id').eq('language', webinar.language.trim().toLowerCase()).limit(2000);
  if (error) throw new AppError(500, error.message);
  const ids = [...new Set((interests ?? []).map((r) => r.agency_user_id))];
  if (!ids.length) return 0;
  const { data: regs } = await supabaseAdmin.from('agency_webinar_registrations')
    .select('agency_user_id').eq('webinar_id', webinar.id).in('agency_user_id', ids);
  const registered = new Set((regs ?? []).map((r) => r.agency_user_id));
  const waiting = ids.filter((id) => !registered.has(id));
  await notice(waiting, 'webinar_new_scheduled', `New webinar: ${webinar.title}`,
    `A ${webinar.language} webinar is scheduled for ${formatWebinarTime(webinar.starts_at, null)}. Open Training to register.`,
    'talent_webinar_new_scheduled', webinar);
  return waiting.length;
}

export async function sendAgencyRescheduled(webinar: WebinarRow, oldStartsAt: string): Promise<number> {
  const { data, error } = await supabaseAdmin.from('agency_webinar_registrations')
    .select('agency_user_id').eq('webinar_id', webinar.id);
  if (error) throw new AppError(500, error.message);
  const ids = (data ?? []).map((r) => r.agency_user_id);
  await notice(ids, 'webinar_rescheduled', `Rescheduled: ${webinar.title}`,
    `Moved from ${formatWebinarTime(oldStartsAt, null)} to ${formatWebinarTime(webinar.starts_at, null)}. You're still registered.`,
    'talent_webinar_rescheduled', webinar, {
      old_date_time: formatWebinarTime(oldStartsAt, null),
      new_date_time: formatWebinarTime(webinar.starts_at, null),
    });
  return ids.length;
}

export async function sendAgencyMissed(webinar: WebinarRow): Promise<number> {
  const { data, error } = await supabaseAdmin.from('agency_webinar_registrations')
    .select('agency_user_id').eq('webinar_id', webinar.id)
    .is('attended_at', null).is('missed_notified_at', null);
  if (error) throw new AppError(500, error.message);
  const ids = (data ?? []).map((r) => r.agency_user_id);
  if (!ids.length) return 0;
  const { data: claimed, error: claimError } = await supabaseAdmin.from('agency_webinar_registrations')
    .update({ missed_notified_at: new Date().toISOString() })
    .eq('webinar_id', webinar.id).in('agency_user_id', ids).is('missed_notified_at', null)
    .select('agency_user_id');
  if (claimError) throw new AppError(500, claimError.message);
  const due = (claimed ?? []).map((r) => r.agency_user_id);
  await notice(due, 'webinar_missed', `You missed: ${webinar.title}`,
    'You did not attend this webinar. Register for the next agency session in Training.',
    'talent_webinar_missed', webinar, { next_webinar_text: 'to be announced soon' });
  return due.length;
}

export async function sendAgencyReminder(webinar: WebinarRow, stage: WebinarReminderStage, now: Date): Promise<void> {
  const column = stage === 'day' ? 'day_notified_at' : stage === 't30' ? 'min30_notified_at' : 'min5_notified_at';
  const { data, error } = await supabaseAdmin.from('agency_webinar_registrations')
    .update({ [column]: now.toISOString() })
    .eq('webinar_id', webinar.id).is(column, null).select('agency_user_id');
  if (error) throw new AppError(500, error.message);
  const ids = (data ?? []).map((r) => r.agency_user_id);
  const lead = stage === 'day' ? 'today' : stage === 't30' ? 'in 30 minutes' : 'in 5 minutes';
  await notice(ids, `webinar_${stage}_reminder`, `Your webinar starts ${lead}: ${webinar.title}`,
    `Join here: ${webinar.meeting_link}`, 'talent_webinar_reminder', webinar, {
      starts_in: stage === 'day' ? 'today' : `starting ${lead}`,
      reminder_stage: stage,
    });
}

export async function listAgencyRegistrations(webinarId: string) {
  const { data, error } = await supabaseAdmin.from('agency_webinar_registrations')
    .select('agency_user_id, registered_at, attended_at, day_notified_at, min30_notified_at, min5_notified_at, agency:agency_users(agency_name, phone)')
    .eq('webinar_id', webinarId).order('registered_at', { ascending: true }).limit(2000);
  if (error) throw new AppError(500, error.message);
  return (data ?? []).map((r: any) => ({
    talent_user_id: r.agency_user_id, agency_user_id: r.agency_user_id, full_name: r.agency?.agency_name ?? null,
    phone: r.agency?.phone ?? null, registered_at: r.registered_at,
    webinar_attended_at: r.attended_at, day_notified_at: r.day_notified_at,
    min30_notified_at: r.min30_notified_at, min5_notified_at: r.min5_notified_at,
  }));
}

export async function setAgencyAttended(webinarId: string, agencyUserId: string, attended: boolean) {
  const { data, error } = await supabaseAdmin.from('agency_webinar_registrations')
    .update({ attended_at: attended ? new Date().toISOString() : null })
    .eq('webinar_id', webinarId).eq('agency_user_id', agencyUserId)
    .select('agency_user_id, attended_at').maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Registration not found');
  return data;
}
