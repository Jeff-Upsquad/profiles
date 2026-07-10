import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { emitJobsEvent } from './jobs-outbox.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyJobEvent } from './push.service.js';
import { fireJobsCrmEvent } from './talent-whatsapp.service.js';
import {
  assertBusinessOwnsCard,
  contentBusinessName,
  contentTitle,
  getCardRefs,
  getCandidate,
  getTalentNames,
  logCandidateEvent,
  notifyTalentsInApp,
  setCandidateStage,
  shouldEmitOutbox,
  type JobsActor,
} from './jobs.service.js';
import type {
  CreateInterviewRoundInput,
  UpdateInterviewRoundInput,
} from '../validators/jobs.validators.js';

/**
 * Interview rounds + FIFO queue (00104).
 *
 * Queue atomicity lives in the two SECURITY DEFINER functions
 * (confirm_interview_attendance / mark_absent_and_promote) called via rpc() —
 * all confirms/promotions for a round serialize on the round row lock.
 *
 * Reveal-on-start: the meeting link (and the physical-location details) are
 * NEVER serialized to a talent until the business clicks "Start Interview"
 * for THAT candidate (invite.started_at). Enforced in exactly one place —
 * serializeRoundForTalent below. Business/admin surfaces always see the link.
 */

const ROUND_FIELDS =
  'id, card_id, job_profile_id, round_no, title, mode, window_start, window_end, minutes_per_interview, capacity, queue_seq, meeting_provider, meeting_link, location_id, location_snapshot, status, day_before_notified_at, confirm_opened_at, created_by, created_at';

const INVITE_FIELDS =
  'id, round_id, candidate_id, talent_user_id, rsvp, rsvp_at, queue_status, confirm_seq, confirmed_at, promoted_at, showed_up_at, started_at, completed_at, outcome, outcome_at, no_show_at, created_at';

interface RoundRow {
  id: string;
  card_id: string;
  job_profile_id: string;
  round_no: number;
  title: string | null;
  mode: 'virtual' | 'physical';
  window_start: string;
  window_end: string;
  minutes_per_interview: number;
  capacity: number;
  queue_seq: number;
  meeting_provider: string | null;
  meeting_link: string | null;
  location_id: string | null;
  location_snapshot: Record<string, unknown> | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  day_before_notified_at: string | null;
  confirm_opened_at: string | null;
  created_by: string;
  created_at: string;
}

interface InviteRow {
  id: string;
  round_id: string;
  candidate_id: string;
  talent_user_id: string;
  rsvp: 'invited' | 'accepted' | 'declined';
  rsvp_at: string | null;
  queue_status: string;
  confirm_seq: number | null;
  confirmed_at: string | null;
  promoted_at: string | null;
  showed_up_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  outcome_at: string | null;
  no_show_at: string | null;
  created_at: string;
}

export async function getRound(roundId: string): Promise<RoundRow> {
  const { data, error } = await supabaseAdmin
    .from('interview_rounds')
    .select(ROUND_FIELDS)
    .eq('id', roundId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Interview round not found');
  return data as unknown as RoundRow;
}

async function getInvite(inviteId: string, roundId?: string): Promise<InviteRow> {
  let q = supabaseAdmin.from('interview_invites').select(INVITE_FIELDS).eq('id', inviteId);
  if (roundId) q = q.eq('round_id', roundId);
  const { data, error } = await q.maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Interview invite not found');
  return data as unknown as InviteRow;
}

function computeCapacity(windowStart: string, windowEnd: string, minutes: number): number {
  const startMs = new Date(windowStart).getTime();
  const endMs = new Date(windowEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new AppError(400, 'window_end must be after window_start');
  }
  const capacity = Math.floor((endMs - startMs) / (minutes * 60_000));
  if (capacity < 1) {
    throw new AppError(400, 'Interview window is shorter than one interview slot');
  }
  return capacity;
}

/**
 * THE talent-facing serializer. Meeting link/provider and the physical
 * location details stay hidden until THIS invite has started_at — the queue
 * shows a locked-link indicator instead.
 */
export function serializeRoundForTalent(round: RoundRow, invite: InviteRow) {
  const revealed = Boolean(invite.started_at);
  return {
    invite: {
      id: invite.id,
      rsvp: invite.rsvp,
      rsvp_at: invite.rsvp_at,
      queue_status: invite.queue_status,
      confirm_seq: invite.confirm_seq,
      confirmed_at: invite.confirmed_at,
      promoted_at: invite.promoted_at,
      showed_up_at: invite.showed_up_at,
      started_at: invite.started_at,
      completed_at: invite.completed_at,
      outcome: invite.outcome,
    },
    round: {
      id: round.id,
      card_id: round.card_id,
      job_profile_id: round.job_profile_id,
      round_no: round.round_no,
      title: round.title,
      mode: round.mode,
      window_start: round.window_start,
      window_end: round.window_end,
      minutes_per_interview: round.minutes_per_interview,
      status: round.status,
      confirm_opened_at: round.confirm_opened_at,
      meeting_provider: revealed ? round.meeting_provider : null,
      meeting_link: revealed ? round.meeting_link : null,
      // Physical venue is shown as soon as the candidate is invited so they can
      // plan travel; only the virtual meeting link stays reveal-gated.
      location: round.location_snapshot ?? null,
      link_locked: !revealed,
    },
  };
}

// ─── Rounds CRUD (business/admin) ──────────────────────────────────────────

export async function createRound(
  cardId: string,
  input: CreateInterviewRoundInput,
  actor: JobsActor,
) {
  const refs = await getCardRefs(cardId);
  if (refs.closedAt) throw new AppError(409, 'This job card is closed');

  const capacity = computeCapacity(input.window_start, input.window_end, input.minutes_per_interview);

  // Physical rounds freeze the venue into location_snapshot at schedule time.
  let locationSnapshot: Record<string, unknown> | null = null;
  if (input.mode === 'physical') {
    if (input.location_snapshot) {
      // SquadHub admin flow: the venue is already frozen ({label,address,city,
      // region,google_maps_url}) since its business_locations aren't in this DB.
      locationSnapshot = input.location_snapshot as Record<string, unknown>;
    } else if (input.location_id) {
      // Business-portal flow: resolve a local location and freeze it.
      const { data: location, error: locErr } = await supabaseAdmin
        .from('business_locations')
        .select('id, business_user_id, label, address, maps_url')
        .eq('id', input.location_id)
        .maybeSingle();
      if (locErr) throw new AppError(500, locErr.message);
      if (!location) throw new AppError(404, 'Location not found');
      if (refs.businessUserId && (location as any).business_user_id !== refs.businessUserId) {
        throw new AppError(403, 'Location belongs to a different business');
      }
      locationSnapshot = {
        label: (location as any).label,
        address: (location as any).address,
        // Store under google_maps_url so the talent + admin views (which read
        // that key) render the map link consistently.
        google_maps_url: (location as any).maps_url ?? null,
      };
    } else {
      throw new AppError(400, 'A location is required for physical interviews');
    }
  }

  // Validate candidates: all must belong to this card.
  const { data: candidates, error: candErr } = await supabaseAdmin
    .from('job_candidates')
    .select('id, talent_user_id, funnel_stage')
    .eq('card_id', cardId)
    .in('id', input.candidate_ids);
  if (candErr) throw new AppError(500, candErr.message);
  const candidateRows = candidates ?? [];
  if (candidateRows.length !== input.candidate_ids.length) {
    throw new AppError(400, 'One or more candidates do not belong to this card');
  }

  let roundNo = input.round_no;
  if (!roundNo) {
    const { data: last } = await supabaseAdmin
      .from('interview_rounds')
      .select('round_no')
      .eq('card_id', cardId)
      .order('round_no', { ascending: false })
      .limit(1)
      .maybeSingle();
    roundNo = ((last as any)?.round_no ?? 0) + 1;
  }

  const { data: round, error: roundErr } = await supabaseAdmin
    .from('interview_rounds')
    .insert({
      card_id: cardId,
      job_profile_id: refs.jobProfileId,
      round_no: roundNo,
      title: input.title ?? null,
      mode: input.mode,
      window_start: input.window_start,
      window_end: input.window_end,
      minutes_per_interview: input.minutes_per_interview,
      capacity,
      meeting_provider: input.meeting_provider ?? null,
      meeting_link: input.meeting_link ?? null,
      // A snapshot-only round (SquadHub admin) carries no local location_id —
      // its id belongs to the other project and would break the FK.
      location_id: input.location_snapshot ? null : input.location_id ?? null,
      location_snapshot: locationSnapshot,
      created_by: actor.type === 'admin' ? 'admin' : 'business',
    })
    .select(ROUND_FIELDS)
    .single();
  if (roundErr || !round) throw new AppError(500, roundErr?.message ?? 'Failed to create round');

  const { error: invErr } = await supabaseAdmin.from('interview_invites').insert(
    candidateRows.map((c: any) => ({
      round_id: (round as any).id,
      candidate_id: c.id,
      talent_user_id: c.talent_user_id,
    })),
  );
  if (invErr) throw new AppError(500, `Failed to create invites: ${invErr.message}`);

  // Candidates move to 'interview_invited' (the talent "Call for Interview" tab).
  for (const c of candidateRows as any[]) {
    await setCandidateStage(c.id as string, 'interview_invited', actor, {
      payload: { round_id: (round as any).id },
    });
  }

  // Card stage: interviews are running.
  if (refs.hiringStage !== 'closed') {
    await supabaseAdmin
      .from('job_cards')
      .update({ hiring_stage: 'interviewing' })
      .eq('card_id', cardId)
      .is('closed_at', null);
  }

  // Notify invited talents — in-app + push + WhatsApp (interview lifecycle
  // bypasses the throttle: this is an appointment, not marketing).
  const title = contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  const talentIds = candidateRows.map((c: any) => c.talent_user_id as string);
  const windowStart = new Date(input.window_start);
  notifyTalentsInApp(
    talentIds,
    'job_interview_call',
    'Interview call',
    `${businessName} invited you to a ${input.mode} interview for ${title}. Please accept or decline.`,
    // One shared row fans to many talents — per-invite links can't work here.
    '/talent/job-openings',
  ).catch(() => {});
  notifyJobEvent(talentIds, {
    type: 'job_interview',
    title: 'Interview call',
    body: `${businessName} invited you to an interview for ${title}.`,
    cardId,
  }).catch((err) => console.error('[interviews] invite push threw', err));
  const names = await getTalentNames(talentIds);
  for (const tid of talentIds) {
    fireJobsCrmEvent(
      'talent_job_interview_call',
      tid,
      {
        talent_name: names.get(tid) ?? '',
        job_title: title,
        business_name: businessName,
        interview_date: windowStart.toISOString().slice(0, 10),
        window_start_time: input.window_start,
        mode: input.mode,
        location_label: locationSnapshot ? String(locationSnapshot.label ?? '') : '',
      },
      { bypass: true },
    ).catch((err) => console.error('[interviews] invite WA threw', err));
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_interview_round_created',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        actor,
        data: {
          round_id: (round as any).id,
          round_no: roundNo,
          mode: input.mode,
          window_start: input.window_start,
          window_end: input.window_end,
          minutes_per_interview: input.minutes_per_interview,
          capacity,
          candidate_ids: input.candidate_ids,
        },
      },
      `job_interview_round_created:${(round as any).id}`,
    );
  }

  return round;
}

export async function updateRound(
  roundId: string,
  input: UpdateInterviewRoundInput,
  actor: JobsActor,
) {
  const round = await getRound(roundId);
  if (round.status !== 'scheduled') {
    throw new AppError(409, 'Only a scheduled round can be edited');
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.mode !== undefined) patch.mode = input.mode;
  if (input.meeting_provider !== undefined) patch.meeting_provider = input.meeting_provider;
  if (input.meeting_link !== undefined) patch.meeting_link = input.meeting_link;

  const windowStart = input.window_start ?? round.window_start;
  const windowEnd = input.window_end ?? round.window_end;
  const minutes = input.minutes_per_interview ?? round.minutes_per_interview;
  if (input.window_start || input.window_end || input.minutes_per_interview) {
    patch.window_start = windowStart;
    patch.window_end = windowEnd;
    patch.minutes_per_interview = minutes;
    patch.capacity = computeCapacity(windowStart, windowEnd, minutes);
  }

  if (input.location_id !== undefined) {
    const { data: location, error: locErr } = await supabaseAdmin
      .from('business_locations')
      .select('id, label, address, maps_url')
      .eq('id', input.location_id)
      .maybeSingle();
    if (locErr) throw new AppError(500, locErr.message);
    if (!location) throw new AppError(404, 'Location not found');
    patch.location_id = input.location_id;
    patch.location_snapshot = {
      label: (location as any).label,
      address: (location as any).address,
      maps_url: (location as any).maps_url ?? null,
    };
  }

  if (Object.keys(patch).length === 0) return round;

  const { data: updated, error } = await supabaseAdmin
    .from('interview_rounds')
    .update(patch)
    .eq('id', roundId)
    .select(ROUND_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to update round');

  if (shouldEmitOutbox(actor)) {
    const refs = await getCardRefs(round.card_id);
    await emitJobsEvent('job_interview_round_updated', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      actor,
      data: { round_id: roundId, patch },
    });
  }

  return updated;
}

export async function cancelRound(roundId: string, actor: JobsActor) {
  const round = await getRound(roundId);
  if (round.status === 'cancelled') return round;
  if (round.status === 'completed') {
    throw new AppError(409, 'A completed round cannot be cancelled');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('interview_rounds')
    .update({ status: 'cancelled' })
    .eq('id', roundId)
    .select(ROUND_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to cancel round');

  // Tell talents who had accepted (or were still invited) that it's off.
  const { data: invites } = await supabaseAdmin
    .from('interview_invites')
    .select('talent_user_id, rsvp')
    .eq('round_id', roundId)
    .in('rsvp', ['invited', 'accepted']);
  const talentIds = (invites ?? []).map((i: any) => i.talent_user_id as string);
  if (talentIds.length > 0) {
    const refs = await getCardRefs(round.card_id);
    const title = contentTitle(refs.content);
    const businessName = contentBusinessName(refs.content);
    notifyTalentsInApp(
      talentIds,
      'job_interview_cancelled',
      'Interview cancelled',
      `The interview round for ${title} at ${businessName} was cancelled. You'll be notified if it's rescheduled.`,
      // One shared row fans to many talents — per-invite links can't work here.
      '/talent/job-openings',
    ).catch(() => {});
    notifyJobEvent(talentIds, {
      type: 'job_interview',
      title: 'Interview cancelled',
      body: `The interview round for ${title} was cancelled.`,
      cardId: round.card_id,
    }).catch((err) => console.error('[interviews] cancel push threw', err));
  }

  if (shouldEmitOutbox(actor)) {
    const refs = await getCardRefs(round.card_id);
    await emitJobsEvent(
      'job_interview_round_cancelled',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        actor,
        data: { round_id: roundId },
      },
      `job_interview_round_cancelled:${roundId}`,
    );
  }

  return updated;
}

export async function listRoundsForCard(cardId: string) {
  const { data: rounds, error } = await supabaseAdmin
    .from('interview_rounds')
    .select(ROUND_FIELDS)
    .eq('card_id', cardId)
    .order('window_start', { ascending: true });
  if (error) throw new AppError(500, error.message);

  const list = (rounds ?? []) as unknown as RoundRow[];
  if (list.length === 0) return [];

  const { data: invites } = await supabaseAdmin
    .from('interview_invites')
    .select('round_id, rsvp, queue_status')
    .in('round_id', list.map((r) => r.id));

  const countsByRound = new Map<string, Record<string, number>>();
  for (const i of invites ?? []) {
    const bucket = countsByRound.get((i as any).round_id) ?? {};
    bucket[`rsvp_${(i as any).rsvp}`] = (bucket[`rsvp_${(i as any).rsvp}`] ?? 0) + 1;
    bucket[(i as any).queue_status] = (bucket[(i as any).queue_status] ?? 0) + 1;
    countsByRound.set((i as any).round_id, bucket);
  }

  return list.map((r) => ({ ...r, invite_counts: countsByRound.get(r.id) ?? {} }));
}

// ─── Talent-facing invites ─────────────────────────────────────────────────

export async function listInvitesForTalent(talentUserId: string) {
  const { data: invites, error } = await supabaseAdmin
    .from('interview_invites')
    .select(`${INVITE_FIELDS}, interview_rounds!inner(${ROUND_FIELDS})`)
    .eq('talent_user_id', talentUserId)
    .neq('interview_rounds.status', 'cancelled')
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  const rows = (invites ?? []) as any[];
  if (rows.length === 0) return [];

  // Card titles for context.
  const cardIds = [...new Set(rows.map((r) => r.interview_rounds.card_id as string))];
  const { data: cards } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, content')
    .in('id', cardIds);
  const contentByCard = new Map<string, Record<string, unknown>>();
  for (const c of cards ?? []) {
    contentByCard.set((c as any).id as string, ((c as any).content ?? {}) as Record<string, unknown>);
  }

  return rows.map((r) => {
    const round = r.interview_rounds as RoundRow;
    const content = contentByCard.get(round.card_id) ?? {};
    return {
      ...serializeRoundForTalent(round, r as InviteRow),
      job: { title: contentTitle(content), business_name: contentBusinessName(content) },
    };
  });
}

export async function respondToInvite(
  talentUserId: string,
  inviteId: string,
  action: 'accept' | 'decline',
) {
  const invite = await getInvite(inviteId);
  if (invite.talent_user_id !== talentUserId) throw new AppError(404, 'Interview invite not found');
  if (invite.rsvp !== 'invited') throw new AppError(409, 'Already responded to this interview call');

  const round = await getRound(invite.round_id);
  if (round.status === 'cancelled' || round.status === 'completed') {
    throw new AppError(409, 'This interview round is no longer open');
  }

  const rsvp = action === 'accept' ? 'accepted' : 'declined';
  const { data: updated, error } = await supabaseAdmin
    .from('interview_invites')
    .update({ rsvp, rsvp_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('rsvp', 'invited')
    .select(INVITE_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Already responded to this interview call');

  const actor: JobsActor = { type: 'talent', id: talentUserId };

  // Accept → the candidate is in the Interview phase; decline → back to the
  // shortlist so the business can re-invite them to another round.
  await setCandidateStage(invite.candidate_id, action === 'accept' ? 'interview' : 'shortlisted', actor, {
    payload: { round_id: round.id, rsvp },
  });
  await logCandidateEvent({
    candidateId: invite.candidate_id,
    cardId: round.card_id,
    actor,
    eventType: action === 'accept' ? 'interview_accepted' : 'interview_declined',
    payload: { round_id: round.id },
  });

  const refs = await getCardRefs(round.card_id);
  if (refs.businessUserId) {
    const names = await getTalentNames([talentUserId]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'job_interview_rsvp',
      title: `${names.get(talentUserId) ?? 'A candidate'} ${rsvp} the interview for ${contentTitle(refs.content)}`,
      ref: { card_id: round.card_id, round_id: round.id, candidate_id: invite.candidate_id, route: 'jobs' },
    });
  }

  await emitJobsEvent('job_interview_rsvp', {
    external_id: refs.externalId,
    job_profile_external_id: refs.jobProfileExternalId,
    recipient_id: null,
    candidate_id: invite.candidate_id,
    actor,
    data: { round_id: round.id, invite_id: inviteId, rsvp },
  });

  return serializeRoundForTalent(round, updated as unknown as InviteRow);
}

/**
 * T-10 "I'm available" tap. Atomic via the confirm_interview_attendance RPC —
 * the round row lock serializes concurrent confirms, the FIFO ticket is
 * assigned once, and replays return the existing ticket.
 */
export async function confirmAttendance(talentUserId: string, inviteId: string) {
  const invite = await getInvite(inviteId);
  if (invite.talent_user_id !== talentUserId) throw new AppError(404, 'Interview invite not found');
  if (invite.rsvp !== 'accepted') {
    throw new AppError(409, 'Accept the interview call before confirming attendance');
  }

  const round = await getRound(invite.round_id);
  // The cron opens the window at T-10; the time check is a fallback for cron
  // lag so an on-time talent is never locked out.
  const windowOpen =
    round.confirm_opened_at != null ||
    Date.now() >= new Date(round.window_start).getTime() - 10 * 60_000;
  if (!windowOpen) {
    throw new AppError(409, 'Confirmation opens 10 minutes before the interview window');
  }

  const { data, error } = await supabaseAdmin.rpc('confirm_interview_attendance', {
    p_invite_id: inviteId,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('round_closed')) throw new AppError(409, 'This interview round is closed');
    if (msg.includes('rsvp_not_accepted')) throw new AppError(409, 'Accept the interview call first');
    if (msg.includes('invite_not_found')) throw new AppError(404, 'Interview invite not found');
    throw new AppError(500, msg);
  }

  const result = Array.isArray(data) ? data[0] : data;
  const wasFirstConfirm = invite.confirmed_at == null;

  const actor: JobsActor = { type: 'talent', id: talentUserId };
  if (wasFirstConfirm) {
    await logCandidateEvent({
      candidateId: invite.candidate_id,
      cardId: round.card_id,
      actor,
      eventType: 'interview_confirmed',
      payload: { round_id: round.id, seq: result?.out_seq ?? null, queue_status: result?.out_queue_status ?? null },
    });

    const refs = await getCardRefs(round.card_id);
    if (refs.businessUserId) {
      const names = await getTalentNames([talentUserId]);
      await createBusinessNotification({
        businessUserId: refs.businessUserId,
        type: 'job_interview_confirmed',
        title: `${names.get(talentUserId) ?? 'A candidate'} confirmed availability for ${contentTitle(refs.content)}`,
        ref: { card_id: round.card_id, round_id: round.id, candidate_id: invite.candidate_id, route: 'jobs' },
      });
    }

    await emitJobsEvent(
      'job_interview_confirmed',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        candidate_id: invite.candidate_id,
        actor,
        data: {
          round_id: round.id,
          invite_id: inviteId,
          seq: result?.out_seq ?? null,
          queue_status: result?.out_queue_status ?? null,
        },
      },
      `job_interview_confirmed:${inviteId}`,
    );
  }

  return getQueueForTalent(talentUserId, inviteId);
}

/**
 * Live queue snapshot for one talent, computed per request (clients poll):
 * approx time = window_start + (rank among queued/in-progress − 1) × minutes.
 */
export async function getQueueForTalent(talentUserId: string, inviteId: string) {
  const invite = await getInvite(inviteId);
  if (invite.talent_user_id !== talentUserId) throw new AppError(404, 'Interview invite not found');
  const round = await getRound(invite.round_id);

  const { data: queueRows, error } = await supabaseAdmin
    .from('interview_invites')
    .select('id, queue_status, confirm_seq')
    .eq('round_id', round.id)
    .in('queue_status', ['queued', 'in_progress', 'waitlisted'])
    .order('confirm_seq', { ascending: true });
  if (error) throw new AppError(500, error.message);

  const rows = (queueRows ?? []) as Array<{ id: string; queue_status: string; confirm_seq: number | null }>;
  const active = rows.filter((r) => r.queue_status === 'queued' || r.queue_status === 'in_progress');
  const waitlist = rows.filter((r) => r.queue_status === 'waitlisted');

  let position: number | null = null;
  let approxTime: string | null = null;
  let waitlistPosition: number | null = null;

  const activeIdx = active.findIndex((r) => r.id === inviteId);
  if (activeIdx >= 0) {
    position = activeIdx + 1;
    approxTime = new Date(
      new Date(round.window_start).getTime() + activeIdx * round.minutes_per_interview * 60_000,
    ).toISOString();
  } else {
    const waitIdx = waitlist.findIndex((r) => r.id === inviteId);
    if (waitIdx >= 0) waitlistPosition = waitIdx + 1;
  }

  return {
    ...serializeRoundForTalent(round, invite),
    queue: {
      position,
      approx_time: approxTime,
      waitlist_position: waitlistPosition,
      capacity: round.capacity,
      queued_count: active.length,
      waitlist_count: waitlist.length,
    },
  };
}

// ─── Business day console + actions ────────────────────────────────────────

export async function getDayConsole(roundId: string) {
  const round = await getRound(roundId);

  const { data: invites, error } = await supabaseAdmin
    .from('interview_invites')
    .select(INVITE_FIELDS)
    .eq('round_id', roundId)
    .order('confirm_seq', { ascending: true, nullsFirst: false });
  if (error) throw new AppError(500, error.message);

  const rows = (invites ?? []) as unknown as InviteRow[];
  const names = await getTalentNames(rows.map((r) => r.talent_user_id));

  const startMs = new Date(round.window_start).getTime();
  const queued = rows
    .filter((r) => r.queue_status === 'queued' || r.queue_status === 'in_progress')
    .sort((a, b) => (a.confirm_seq ?? 0) - (b.confirm_seq ?? 0));
  const approxById = new Map<string, string>();
  queued.forEach((r, idx) => {
    approxById.set(r.id, new Date(startMs + idx * round.minutes_per_interview * 60_000).toISOString());
  });

  const decorate = (r: InviteRow) => ({
    ...r,
    talent_name: names.get(r.talent_user_id) ?? null,
    approx_time: approxById.get(r.id) ?? null,
  });

  return {
    // Business console sees the full round incl. meeting link/location.
    round,
    buckets: {
      invited: rows.filter((r) => r.rsvp === 'invited').map(decorate),
      declined: rows.filter((r) => r.rsvp === 'declined').map(decorate),
      accepted_unconfirmed: rows
        .filter((r) => r.rsvp === 'accepted' && r.queue_status === 'none')
        .map(decorate),
      queue: rows.filter((r) => r.queue_status === 'queued').map(decorate),
      waitlist: rows.filter((r) => r.queue_status === 'waitlisted').map(decorate),
      in_progress: rows.filter((r) => r.queue_status === 'in_progress').map(decorate),
      done: rows.filter((r) => r.queue_status === 'done').map(decorate),
      absent: rows
        .filter((r) => r.queue_status === 'no_show' || r.queue_status === 'not_joined')
        .map(decorate),
    },
  };
}

export async function markShowedUp(roundId: string, inviteId: string, actor: JobsActor) {
  const invite = await getInvite(inviteId, roundId);
  if (invite.showed_up_at) return invite;

  const { data: updated, error } = await supabaseAdmin
    .from('interview_invites')
    .update({ showed_up_at: new Date().toISOString() })
    .eq('id', inviteId)
    .select(INVITE_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to mark showed up');

  const round = await getRound(roundId);
  await logCandidateEvent({
    candidateId: invite.candidate_id,
    cardId: round.card_id,
    actor,
    eventType: 'interview_showed_up',
    payload: { round_id: roundId },
  });

  if (shouldEmitOutbox(actor)) {
    const refs = await getCardRefs(round.card_id);
    await emitJobsEvent('job_interview_showed_up', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: invite.candidate_id,
      actor,
      data: { round_id: roundId, invite_id: inviteId },
    });
  }

  return updated;
}

/**
 * "Start Interview" — reveals the meeting link to THIS candidate only (their
 * invite gets started_at; the talent serializer keys on it) and pings them on
 * every channel.
 */
export async function startInterview(roundId: string, inviteId: string, actor: JobsActor) {
  const invite = await getInvite(inviteId, roundId);
  if (invite.started_at) return invite;
  if (!['queued', 'waitlisted'].includes(invite.queue_status)) {
    throw new AppError(409, 'Candidate is not in the queue');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('interview_invites')
    .update({
      started_at: now,
      queue_status: 'in_progress',
      showed_up_at: invite.showed_up_at ?? now,
    })
    .eq('id', inviteId)
    .select(INVITE_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to start interview');

  const round = await getRound(roundId);
  if (round.status === 'scheduled') {
    await supabaseAdmin
      .from('interview_rounds')
      .update({ status: 'in_progress' })
      .eq('id', roundId)
      .eq('status', 'scheduled');
  }

  await logCandidateEvent({
    candidateId: invite.candidate_id,
    cardId: round.card_id,
    actor,
    eventType: 'interview_started',
    payload: { round_id: roundId },
  });

  const refs = await getCardRefs(round.card_id);
  const title = contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  const linkOrLocation =
    round.mode === 'virtual'
      ? round.meeting_link ?? ''
      : String((round.location_snapshot as any)?.address ?? (round.location_snapshot as any)?.label ?? '');

  notifyTalentsInApp(
    [invite.talent_user_id],
    'job_interview_start',
    'Your interview is starting now',
    round.mode === 'virtual'
      ? `Join your interview for ${title} at ${businessName} now: ${round.meeting_link ?? 'link available in the app'}`
      : `Your interview for ${title} at ${businessName} is starting — please head in.`,
    `/talent/job-openings/interviews/${inviteId}`,
  ).catch(() => {});
  notifyJobEvent([invite.talent_user_id], {
    type: 'job_interview_start',
    title: 'Your interview is starting now',
    body: `Open the app to join your interview for ${title}.`,
    cardId: round.card_id,
  }).catch((err) => console.error('[interviews] start push threw', err));
  const names = await getTalentNames([invite.talent_user_id]);
  fireJobsCrmEvent(
    'talent_job_interview_start',
    invite.talent_user_id,
    {
      talent_name: names.get(invite.talent_user_id) ?? '',
      job_title: title,
      meeting_link_or_location: linkOrLocation,
    },
    { bypass: true },
  ).catch((err) => console.error('[interviews] start WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_interview_started', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: invite.candidate_id,
      actor,
      data: { round_id: roundId, invite_id: inviteId, started_at: now },
    });
  }

  return updated;
}

/**
 * No-show / showed-up-but-didn't-join. Atomic via mark_absent_and_promote —
 * the RPC also promotes the lowest-seq waitlisted invite and returns it so we
 * can notify the promoted talent.
 */
export async function markAbsent(
  roundId: string,
  inviteId: string,
  kind: 'no_show' | 'not_joined',
  actor: JobsActor,
) {
  const invite = await getInvite(inviteId, roundId);
  const round = await getRound(roundId);

  const { data: promotedId, error } = await supabaseAdmin.rpc('mark_absent_and_promote', {
    p_invite_id: inviteId,
    p_kind: kind,
  });
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('invite_not_found')) throw new AppError(404, 'Interview invite not found');
    if (msg.includes('invalid_kind')) throw new AppError(400, 'Invalid kind');
    throw new AppError(500, msg);
  }

  await logCandidateEvent({
    candidateId: invite.candidate_id,
    cardId: round.card_id,
    actor,
    eventType: `interview_${kind}`,
    payload: { round_id: roundId },
  });

  const refs = await getCardRefs(round.card_id);

  // Notify the promoted talent — they moved off the waiting list.
  let promotedInviteId: string | null = (promotedId as string | null) ?? null;
  if (promotedInviteId) {
    const promoted = await getInvite(promotedInviteId);
    const snapshot = await getQueueForTalent(promoted.talent_user_id, promotedInviteId);
    const title = contentTitle(refs.content);
    const businessName = contentBusinessName(refs.content);
    notifyTalentsInApp(
      [promoted.talent_user_id],
      'job_waitlist_promoted',
      "You're in the queue!",
      `A slot opened up — you're now in the interview queue for ${title} at ${businessName}.`,
      `/talent/job-openings/interviews/${promotedInviteId}`,
    ).catch(() => {});
    notifyJobEvent([promoted.talent_user_id], {
      type: 'job_interview',
      title: "You're in the queue!",
      body: `A slot opened up for your ${title} interview.`,
      cardId: round.card_id,
    }).catch((err) => console.error('[interviews] promote push threw', err));
    const names = await getTalentNames([promoted.talent_user_id]);
    fireJobsCrmEvent(
      'talent_job_waitlist_promoted',
      promoted.talent_user_id,
      {
        talent_name: names.get(promoted.talent_user_id) ?? '',
        job_title: title,
        approx_time: snapshot.queue.approx_time ?? '',
      },
      { bypass: true },
    ).catch((err) => console.error('[interviews] promote WA threw', err));
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_interview_absent', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: invite.candidate_id,
      actor,
      data: { round_id: roundId, invite_id: inviteId, kind, promoted_invite_id: promotedInviteId },
    });
  }

  return { invite_id: inviteId, kind, promoted_invite_id: promotedInviteId };
}

const OUTCOME_STAGE = {
  selected: 'selected',
  rejected: 'rejected',
  on_hold: 'on_hold',
} as const;

export async function setInterviewOutcome(
  roundId: string,
  inviteId: string,
  outcome: 'selected' | 'rejected' | 'on_hold',
  actor: JobsActor,
) {
  const invite = await getInvite(inviteId, roundId);
  if (!['in_progress', 'done'].includes(invite.queue_status)) {
    throw new AppError(409, 'Interview has not been started for this candidate');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('interview_invites')
    .update({
      queue_status: 'done',
      completed_at: invite.completed_at ?? now,
      outcome,
      outcome_at: now,
    })
    .eq('id', inviteId)
    .select(INVITE_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to record outcome');

  const round = await getRound(roundId);
  await setCandidateStage(invite.candidate_id, OUTCOME_STAGE[outcome], actor, {
    payload: { round_id: roundId, outcome },
  });

  const refs = await getCardRefs(round.card_id);
  const title = contentTitle(refs.content);
  const businessName = contentBusinessName(refs.content);
  const copy = {
    selected: {
      title: 'Interview result: selected!',
      body: `Great news — you were selected after your interview for ${title} at ${businessName}.`,
    },
    rejected: {
      title: 'Interview result',
      body: `Your interview for ${title} at ${businessName} was not taken forward.`,
    },
    on_hold: {
      title: 'Interview result: on hold',
      body: `Your interview result for ${title} at ${businessName} is on hold — we'll keep you posted.`,
    },
  }[outcome];
  notifyTalentsInApp(
    [invite.talent_user_id],
    `job_interview_${outcome}`,
    copy.title,
    copy.body,
    `/talent/job-openings/interviews/${inviteId}`,
  ).catch(() => {});
  notifyJobEvent([invite.talent_user_id], {
    type: 'job_stage',
    title: copy.title,
    body: copy.body,
    cardId: round.card_id,
  }).catch((err) => console.error('[interviews] outcome push threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_interview_outcome', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: invite.candidate_id,
      actor,
      data: { round_id: roundId, invite_id: inviteId, outcome },
    });
  }

  return updated;
}

/** Ownership helper for business routes that address a round directly. */
export async function assertRoundBelongsToBusinessCard(
  roundId: string,
  businessUserId: string,
): Promise<RoundRow> {
  const round = await getRound(roundId);
  await assertBusinessOwnsCard(businessUserId, round.card_id);
  return round;
}

/** Used by the invite-validation path of admin webhooks. */
export async function getCandidateForInvite(inviteId: string) {
  const invite = await getInvite(inviteId);
  return getCandidate(invite.candidate_id);
}
