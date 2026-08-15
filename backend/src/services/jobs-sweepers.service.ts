import { supabaseAdmin } from '../config/supabase.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyJobEvent } from './push.service.js';
import { fireJobsCrmEvent } from './talent-whatsapp.service.js';
import {
  contentBusinessName,
  contentTitle,
  getTalentNames,
  notifyTalentsInApp,
} from './jobs.service.js';
import { expireOverdueOffers } from './offers.service.js';
import { sweepMeetingReminders } from './conversations.service.js';

/**
 * Interview-day orchestration cron (60s tick):
 *
 *  1. T-24h reminders — physical AND virtual rounds; stamped on
 *     day_before_notified_at so a round is reminded exactly once.
 *  2. T-10min confirm window — stamps confirm_opened_at and pings every
 *     accepted invite to confirm availability (the FIFO-queue entry tap).
 *  3. window_end + 30min auto-complete — closes the round, marks residual
 *     no-shows (accepted-but-never-confirmed AND confirmed-but-never-started)
 *     and flushes still-in-progress invites to done.
 *  4. Offer expiry (expires_on passed → 'expired').
 *
 * All notification sends are per-round batches; a crash in one round's fan-out
 * doesn't block the others. Interview WhatsApps bypass the engagement
 * throttle — they're appointments, not marketing.
 */

const SWEEP_INTERVAL_MS = 60_000;
const T24H_MS = 24 * 60 * 60 * 1_000;
const T10M_MS = 10 * 60 * 1_000;
const AUTOCOMPLETE_GRACE_MS = 30 * 60 * 1_000;

const ROUND_FIELDS =
  'id, card_id, mode, window_start, window_end, minutes_per_interview, location_snapshot, status, day_before_notified_at, confirm_opened_at';

async function getCardContent(cardId: string): Promise<Record<string, unknown>> {
  const { data } = await supabaseAdmin
    .from('subscription_cards')
    .select('content, business_user_id')
    .eq('id', cardId)
    .maybeSingle();
  return ((data as any)?.content ?? {}) as Record<string, unknown>;
}

async function getAcceptedInviteTalents(roundId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('interview_invites')
    .select('talent_user_id')
    .eq('round_id', roundId)
    .eq('rsvp', 'accepted');
  return (data ?? []).map((i: any) => i.talent_user_id as string);
}

async function sweepDayBeforeReminders(now: number): Promise<void> {
  const { data: rounds, error } = await supabaseAdmin
    .from('interview_rounds')
    .select(ROUND_FIELDS)
    .eq('status', 'scheduled')
    .is('day_before_notified_at', null)
    .lte('window_start', new Date(now + T24H_MS).toISOString())
    .gt('window_start', new Date(now).toISOString());
  if (error) {
    console.error('[jobs-sweeper] T-24h query failed', error.message);
    return;
  }

  for (const round of (rounds ?? []) as any[]) {
    // Claim the round first — a concurrent tick must not double-send.
    const { data: claimed } = await supabaseAdmin
      .from('interview_rounds')
      .update({ day_before_notified_at: new Date().toISOString() })
      .eq('id', round.id)
      .is('day_before_notified_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    try {
      const talentIds = await getAcceptedInviteTalents(round.id as string);
      if (talentIds.length === 0) continue;

      const { data: cardRow } = await supabaseAdmin
        .from('subscription_cards')
        .select('content, business_user_id')
        .eq('id', round.card_id)
        .maybeSingle();
      const content = ((cardRow as any)?.content ?? {}) as Record<string, unknown>;
      const title = contentTitle(content);
      const businessName = contentBusinessName(content);
      const locationSnapshot = (round.location_snapshot ?? {}) as Record<string, unknown>;

      notifyTalentsInApp(
        talentIds,
        'job_interview_reminder',
        'Interview tomorrow',
        `Reminder: your ${round.mode} interview for ${title} at ${businessName} is within 24 hours.`,
        // One shared row fans to many talents — per-invite links can't work here.
        '/talent/job-openings',
      ).catch(() => {});
      notifyJobEvent(talentIds, {
        type: 'job_interview',
        title: 'Interview tomorrow',
        body: `Reminder: your interview for ${title} is within 24 hours.`,
        cardId: round.card_id as string,
      }).catch((err) => console.error('[jobs-sweeper] reminder push threw', err));

      const names = await getTalentNames(talentIds);
      for (const tid of talentIds) {
        fireJobsCrmEvent(
          'talent_job_interview_reminder',
          tid,
          {
            talent_name: names.get(tid) ?? '',
            job_title: title,
            business_name: businessName,
            interview_date: String(round.window_start).slice(0, 10),
            window_start_time: round.window_start,
            mode: round.mode,
            location_label: String(locationSnapshot.label ?? ''),
            maps_url: String(locationSnapshot.maps_url ?? ''),
          },
          { bypass: true },
        ).catch((err) => console.error('[jobs-sweeper] reminder WA threw', err));
      }

      const businessUserId = (cardRow as any)?.business_user_id as string | null;
      if (businessUserId) {
        await createBusinessNotification({
          businessUserId,
          type: 'job_interview_reminder',
          title: `Interview round for ${title} starts within 24 hours (${talentIds.length} confirmed attendee${talentIds.length === 1 ? '' : 's'})`,
          ref: { card_id: round.card_id, round_id: round.id, route: 'jobs' },
        });
      }
    } catch (err) {
      console.error('[jobs-sweeper] T-24h fan-out failed for round', round.id, err);
    }
  }
}

async function sweepConfirmWindows(now: number): Promise<void> {
  const { data: rounds, error } = await supabaseAdmin
    .from('interview_rounds')
    .select(ROUND_FIELDS)
    .eq('status', 'scheduled')
    .is('confirm_opened_at', null)
    .lte('window_start', new Date(now + T10M_MS).toISOString());
  if (error) {
    console.error('[jobs-sweeper] T-10 query failed', error.message);
    return;
  }

  for (const round of (rounds ?? []) as any[]) {
    const { data: claimed } = await supabaseAdmin
      .from('interview_rounds')
      .update({ confirm_opened_at: new Date().toISOString() })
      .eq('id', round.id)
      .is('confirm_opened_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;

    try {
      const talentIds = await getAcceptedInviteTalents(round.id as string);
      if (talentIds.length === 0) continue;

      const content = await getCardContent(round.card_id as string);
      const title = contentTitle(content);
      const businessName = contentBusinessName(content);

      notifyTalentsInApp(
        talentIds,
        'job_interview_confirm',
        'Confirm your availability now',
        `Your interview window for ${title} at ${businessName} opens in 10 minutes. Tap Confirm to join the queue — spots are first-come, first-served.`,
        // One shared row fans to many talents — per-invite links can't work here.
        '/talent/job-openings',
      ).catch(() => {});
      notifyJobEvent(talentIds, {
        type: 'job_interview_confirm',
        title: 'Confirm your availability now',
        body: `Your interview for ${title} starts soon — confirm to join the queue.`,
        cardId: round.card_id as string,
      }).catch((err) => console.error('[jobs-sweeper] confirm push threw', err));

      const names = await getTalentNames(talentIds);
      for (const tid of talentIds) {
        fireJobsCrmEvent(
          'talent_job_interview_confirm',
          tid,
          {
            talent_name: names.get(tid) ?? '',
            job_title: title,
            window_start_time: round.window_start,
          },
          { bypass: true }, // time-critical
        ).catch((err) => console.error('[jobs-sweeper] confirm WA threw', err));
      }
    } catch (err) {
      console.error('[jobs-sweeper] T-10 fan-out failed for round', round.id, err);
    }
  }
}

async function sweepAutoComplete(now: number): Promise<void> {
  const { data: rounds, error } = await supabaseAdmin
    .from('interview_rounds')
    .select('id, window_end, status')
    .in('status', ['scheduled', 'in_progress'])
    .lte('window_end', new Date(now - AUTOCOMPLETE_GRACE_MS).toISOString());
  if (error) {
    console.error('[jobs-sweeper] auto-complete query failed', error.message);
    return;
  }

  for (const round of (rounds ?? []) as any[]) {
    try {
      const nowIso = new Date().toISOString();

      // Residual no-shows: confirmed (queued/waitlisted) but never started,
      // and accepted-but-never-confirmed.
      await supabaseAdmin
        .from('interview_invites')
        .update({ queue_status: 'no_show', no_show_at: nowIso })
        .eq('round_id', round.id)
        .in('queue_status', ['queued', 'waitlisted']);
      await supabaseAdmin
        .from('interview_invites')
        .update({ queue_status: 'no_show', no_show_at: nowIso })
        .eq('round_id', round.id)
        .eq('queue_status', 'none')
        .eq('rsvp', 'accepted');

      // Interviews still running past the grace window — flush to done.
      await supabaseAdmin
        .from('interview_invites')
        .update({ queue_status: 'done', completed_at: nowIso })
        .eq('round_id', round.id)
        .eq('queue_status', 'in_progress');

      await supabaseAdmin
        .from('interview_rounds')
        .update({ status: 'completed' })
        .eq('id', round.id)
        .in('status', ['scheduled', 'in_progress']);
    } catch (err) {
      console.error('[jobs-sweeper] auto-complete failed for round', round.id, err);
    }
  }
}

export function startInterviewSweeper(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const now = Date.now();
      await sweepDayBeforeReminders(now);
      await sweepConfirmWindows(now);
      await sweepAutoComplete(now);
      await expireOverdueOffers();
      await sweepMeetingReminders();
    } catch (err) {
      console.error('[jobs-sweeper] tick errored', err);
    }
  };

  // First tick shortly after boot, then every minute.
  const handle = setInterval(tick, SWEEP_INTERVAL_MS);
  setTimeout(tick, 20_000);
  return handle;
}
