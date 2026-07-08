import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { emitJobsEvent } from './jobs-outbox.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyJobEvent } from './push.service.js';
import { fireJobsCrmEvent } from './talent-whatsapp.service.js';
import {
  contentBusinessName,
  contentTitle,
  getCardRefs,
  getCandidate,
  getTalentNames,
  logCandidateEvent,
  notifyTalentsInApp,
  setCandidateStage,
  shouldEmitOutbox,
  type JobCardRefs,
  type JobsActor,
} from './jobs.service.js';
import type { CreateOffersInput, UpdateOfferInput } from '../validators/jobs.validators.js';

/**
 * Offer engine (00105).
 *
 * State machine (service-enforced):
 *   draft → sent → (talent negotiate{figure}, only while !is_final_counter)
 *        → negotiating → business: accept-negotiation | decline-negotiation
 *                        | counter (FINAL → 'countered')
 *   from countered: the talent may only accept / decline / ask a question.
 *   Terminal: accepted | declined | withdrawn | expired.
 *
 * One LIVE offer per candidate — enforced by the partial unique index
 * job_offers_one_open_per_candidate (23505 → 409 here).
 *
 * Templates are canonical on SquadHub: the business-portal composer pulls the
 * letter skeleton via fetchOfferTemplate() (signed GET), edits sections +
 * package per offer, and the final render is FROZEN into job_offers.letter at
 * send.
 */

const OFFER_FIELDS =
  'id, candidate_id, card_id, job_profile_id, talent_user_id, squadhub_template_id, delivery_mode, position_title, effective_date, join_by_date, expires_on, compensation, letter, status, is_final_counter, sent_at, responded_at, withdrawn_at, created_at, updated_at';

export interface OfferRow {
  id: string;
  candidate_id: string;
  card_id: string;
  job_profile_id: string;
  talent_user_id: string;
  squadhub_template_id: string | null;
  delivery_mode: 'platform' | 'manual_email';
  position_title: string;
  effective_date: string | null;
  join_by_date: string | null;
  expires_on: string | null;
  compensation: Record<string, unknown>;
  letter: Record<string, unknown> | null;
  status:
    | 'draft'
    | 'sent'
    | 'negotiating'
    | 'countered'
    | 'accepted'
    | 'declined'
    | 'withdrawn'
    | 'expired';
  is_final_counter: boolean;
  sent_at: string | null;
  responded_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
}

export async function getOffer(offerId: string): Promise<OfferRow> {
  const { data, error } = await supabaseAdmin
    .from('job_offers')
    .select(OFFER_FIELDS)
    .eq('id', offerId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Offer not found');
  return data as unknown as OfferRow;
}

async function logOfferEvent(input: {
  offerId: string;
  actor: JobsActor;
  action: string;
  amount?: unknown;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('offer_events').insert({
    offer_id: input.offerId,
    actor_type: input.actor.type,
    actor_id: input.actor.id ?? null,
    action: input.action,
    amount: input.amount ?? null,
    note: input.note ?? null,
  });
  if (error) {
    console.error('[offers] failed to log offer event', { action: input.action, error: error.message });
  }
}

export async function listOfferEvents(offerId: string) {
  const { data, error } = await supabaseAdmin
    .from('offer_events')
    .select('id, actor_type, action, amount, note, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}

// ─── Template pull (canonical on SquadHub) ─────────────────────────────────

function offerTemplateUrl(): string | null {
  if (env.SQUADHUB_OFFER_TEMPLATE_URL) return env.SQUADHUB_OFFER_TEMPLATE_URL;
  // Fallback derivation, same idiom as the SSO service: explicit API base
  // first, then the callback URL's origin.
  const base = env.SQUADHUB_API_URL
    ? env.SQUADHUB_API_URL.replace(/\/$/, '')
    : env.SQUADHUB_CALLBACK_URL
      ? new URL(env.SQUADHUB_CALLBACK_URL).origin
      : '';
  if (!base) return null;
  return `${base}/integrations/squadhire/jobs/offer-template`;
}

/**
 * Pull the offer-letter template for a card from SquadHub (signed GET).
 * Passes the card's external id so SquadHub can resolve the job-profile
 * template (or its global default).
 */
export async function fetchOfferTemplate(cardExternalId: string): Promise<Record<string, unknown>> {
  const base = offerTemplateUrl();
  if (!base || !env.SQUADHUB_CALLBACK_SECRET) {
    throw new AppError(503, 'Offer templates are not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${base}?card_id=${encodeURIComponent(cardExternalId)}`, {
      method: 'GET',
      headers: { 'X-SquadHub-Signature': env.SQUADHUB_CALLBACK_SECRET },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new AppError(502, `Failed to fetch offer template (http_${res.status})`);
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new AppError(502, `Failed to fetch offer template: ${msg.slice(0, 200)}`);
  } finally {
    clearTimeout(timer);
  }
}

// ─── Compose / send (business + admin) ─────────────────────────────────────

export interface CreateOffersResult {
  created: OfferRow[];
  skipped: Array<{ candidate_id: string; reason: string }>;
}

export async function createOffers(
  cardId: string,
  input: CreateOffersInput,
  actor: JobsActor,
): Promise<CreateOffersResult> {
  const refs = await getCardRefs(cardId);
  if (refs.closedAt) throw new AppError(409, 'This job card is closed');

  let candidateIds: string[];
  if (input.all_selected) {
    const { data, error } = await supabaseAdmin
      .from('job_candidates')
      .select('id')
      .eq('card_id', cardId)
      .eq('funnel_stage', 'selected');
    if (error) throw new AppError(500, error.message);
    candidateIds = (data ?? []).map((c: any) => c.id as string);
    if (candidateIds.length === 0) {
      throw new AppError(400, 'No selected candidates to offer');
    }
  } else {
    candidateIds = input.candidate_ids ?? [];
    const { data, error } = await supabaseAdmin
      .from('job_candidates')
      .select('id')
      .eq('card_id', cardId)
      .in('id', candidateIds);
    if (error) throw new AppError(500, error.message);
    if ((data ?? []).length !== candidateIds.length) {
      throw new AppError(400, 'One or more candidates do not belong to this card');
    }
  }

  const positionTitle = input.position_title || contentTitle(refs.content);
  const created: OfferRow[] = [];
  const skipped: CreateOffersResult['skipped'] = [];

  for (const candidateId of candidateIds) {
    const candidate = await getCandidate(candidateId, cardId);
    const { data: offer, error } = await supabaseAdmin
      .from('job_offers')
      .insert({
        candidate_id: candidateId,
        card_id: cardId,
        job_profile_id: refs.jobProfileId,
        talent_user_id: candidate.talent_user_id,
        squadhub_template_id: input.squadhub_template_id ?? null,
        delivery_mode: input.delivery_mode ?? 'platform',
        position_title: positionTitle,
        effective_date: input.effective_date ?? null,
        join_by_date: input.join_by_date ?? null,
        expires_on: input.expires_on ?? null,
        compensation: input.compensation ?? {},
      })
      .select(OFFER_FIELDS)
      .single();
    if (error) {
      // 23505 = the one-live-offer partial unique index — a live offer already
      // exists for this candidate.
      if (error.code === '23505') {
        skipped.push({ candidate_id: candidateId, reason: 'live_offer_exists' });
        continue;
      }
      throw new AppError(500, error.message);
    }

    const row = offer as unknown as OfferRow;
    created.push(row);
    await logOfferEvent({ offerId: row.id, actor, action: 'created', amount: input.compensation ?? null });
  }

  if (created.length === 0 && skipped.length > 0 && candidateIds.length === 1) {
    throw new AppError(409, 'Candidate already has a live offer');
  }

  if (shouldEmitOutbox(actor) && created.length > 0) {
    // Singular prefix — SquadHub's dispatcher routes on startsWith('job_offer_').
    // Informational (drafts): the mirror hydrates from job_offer_sent.
    await emitJobsEvent('job_offer_created', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      actor,
      data: {
        offer_ids: created.map((o) => o.id),
        candidate_ids: created.map((o) => o.candidate_id),
        position_title: positionTitle,
      },
    });
  }

  return { created, skipped };
}

export async function updateOfferPackage(
  offerId: string,
  input: UpdateOfferInput,
  actor: JobsActor,
): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'draft') {
    throw new AppError(409, 'Only a draft offer can be edited — counter instead');
  }

  const patch: Record<string, unknown> = {};
  if (input.position_title !== undefined) patch.position_title = input.position_title;
  if (input.effective_date !== undefined) patch.effective_date = input.effective_date;
  if (input.join_by_date !== undefined) patch.join_by_date = input.join_by_date;
  if (input.expires_on !== undefined) patch.expires_on = input.expires_on;
  if (input.compensation !== undefined) patch.compensation = input.compensation;
  if (input.squadhub_template_id !== undefined) patch.squadhub_template_id = input.squadhub_template_id;
  if (input.delivery_mode !== undefined) patch.delivery_mode = input.delivery_mode;
  if (Object.keys(patch).length === 0) return offer;

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update(patch)
    .eq('id', offerId)
    .select(OFFER_FIELDS)
    .single();
  if (error || !updated) throw new AppError(500, error?.message ?? 'Failed to update offer');

  await logOfferEvent({ offerId, actor, action: 'package_updated', amount: input.compensation ?? null });

  if (shouldEmitOutbox(actor)) {
    const refs = await getCardRefs(offer.card_id);
    await emitJobsEvent('job_offer_updated', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: offer.candidate_id,
      actor,
      data: { offer_id: offerId, patch },
    });
  }

  return updated as unknown as OfferRow;
}

async function moveCandidateToOfferStage(offer: OfferRow, refs: JobCardRefs, actor: JobsActor) {
  await setCandidateStage(offer.candidate_id, 'offer', actor, {
    payload: { offer_id: offer.id },
  });
  // Card stage: offers are out.
  if (!refs.closedAt) {
    await supabaseAdmin
      .from('job_cards')
      .update({ hiring_stage: 'offering' })
      .eq('card_id', offer.card_id)
      .is('closed_at', null);
  }
}

export async function sendOffer(
  offerId: string,
  letter: Record<string, unknown> | undefined,
  actor: JobsActor,
): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'draft') throw new AppError(409, 'Offer has already been sent');

  const refs = await getCardRefs(offer.card_id);

  // Freeze the letter at send. The composer normally passes the fully merged
  // render; if it didn't, freeze the merge values so the record is complete.
  const frozenLetter: Record<string, unknown> = letter ?? {
    merge_values: {
      position_title: offer.position_title,
      effective_date: offer.effective_date,
      join_by_date: offer.join_by_date,
      expires_on: offer.expires_on,
      compensation: offer.compensation,
    },
  };

  const sentAt = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({ status: 'sent', sent_at: sentAt, letter: frozenLetter })
    .eq('id', offerId)
    .eq('status', 'draft')
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer has already been sent');

  await logOfferEvent({ offerId, actor, action: 'sent' });
  await moveCandidateToOfferStage(offer, refs, actor);
  await logCandidateEvent({
    candidateId: offer.candidate_id,
    cardId: offer.card_id,
    actor,
    eventType: 'offer_sent',
    payload: { offer_id: offerId },
  });

  const businessName = contentBusinessName(refs.content);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'job_offer_received',
    'You have an offer!',
    `${businessName} sent you an offer for ${offer.position_title}. Review and respond in the app.`,
    `/talent/job-openings/offers/${offerId}`,
  ).catch(() => {});
  notifyJobEvent([offer.talent_user_id], {
    type: 'job_offer',
    title: 'You have an offer!',
    body: `${businessName} sent you an offer for ${offer.position_title}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[offers] send push threw', err));
  const names = await getTalentNames([offer.talent_user_id]);
  fireJobsCrmEvent('talent_job_offer_received', offer.talent_user_id, {
    talent_name: names.get(offer.talent_user_id) ?? '',
    position_title: offer.position_title,
    business_name: businessName,
    join_by_date: offer.join_by_date ?? '',
  }).catch((err) => console.error('[offers] send WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_offer_sent',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        candidate_id: offer.candidate_id,
        actor,
        data: {
          offer_id: offerId,
          position_title: offer.position_title,
          compensation: offer.compensation,
          letter: frozenLetter,
          sent_at: sentAt,
        },
      },
      `job_offer_sent:${offerId}`,
    );
  }

  return updated as unknown as OfferRow;
}

/** Path (1): the business sent the offer via their own email — just record it. */
export async function markSentManually(offerId: string, actor: JobsActor): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'draft') throw new AppError(409, 'Offer has already been sent');

  const refs = await getCardRefs(offer.card_id);
  const sentAt = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({ status: 'sent', sent_at: sentAt, delivery_mode: 'manual_email' })
    .eq('id', offerId)
    .eq('status', 'draft')
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer has already been sent');

  await logOfferEvent({ offerId, actor, action: 'marked_sent_manually' });
  await moveCandidateToOfferStage(offer, refs, actor);

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_offer_marked_sent_manually',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        candidate_id: offer.candidate_id,
        actor,
        data: { offer_id: offerId, sent_at: sentAt },
      },
      `job_offer_marked_sent_manually:${offerId}`,
    );
  }

  return updated as unknown as OfferRow;
}

export async function listOffersForCard(cardId: string) {
  const { data, error } = await supabaseAdmin
    .from('job_offers')
    .select(OFFER_FIELDS)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  const rows = data ?? [];
  const names = await getTalentNames(rows.map((r: any) => r.talent_user_id as string));
  return rows.map((r: any) => ({ ...r, talent_name: names.get(r.talent_user_id) ?? null }));
}

// ─── Talent side ───────────────────────────────────────────────────────────

export async function listOffersForTalent(talentUserId: string) {
  // Drafts are invisible to the talent.
  const { data, error } = await supabaseAdmin
    .from('job_offers')
    .select(`${OFFER_FIELDS}, subscription_cards!inner(id, content, archived_at)`)
    .eq('talent_user_id', talentUserId)
    .neq('status', 'draft')
    .is('subscription_cards.archived_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);

  return (data ?? []).map((r: any) => ({
    ...r,
    subscription_cards: undefined,
    business_name: contentBusinessName((r.subscription_cards?.content ?? {}) as Record<string, unknown>),
    job_title: contentTitle((r.subscription_cards?.content ?? {}) as Record<string, unknown>),
  }));
}

export async function getOfferForTalent(talentUserId: string, offerId: string) {
  const offer = await getOffer(offerId);
  if (offer.talent_user_id !== talentUserId || offer.status === 'draft') {
    throw new AppError(404, 'Offer not found');
  }

  // First open of a sent offer → 'viewed' marker on the thread.
  if (offer.status === 'sent') {
    const events = await listOfferEvents(offerId);
    if (!events.some((e: any) => e.action === 'viewed')) {
      await logOfferEvent({
        offerId,
        actor: { type: 'talent', id: talentUserId },
        action: 'viewed',
      });
    }
  }

  const events = await listOfferEvents(offerId);
  return { offer, events };
}

export async function respondToOffer(
  talentUserId: string,
  offerId: string,
  input: { action: 'accept' | 'decline' | 'negotiate'; amount?: unknown; note?: string },
) {
  const offer = await getOffer(offerId);
  if (offer.talent_user_id !== talentUserId || offer.status === 'draft') {
    throw new AppError(404, 'Offer not found');
  }

  const actor: JobsActor = { type: 'talent', id: talentUserId };
  const refs = await getCardRefs(offer.card_id);
  const now = new Date().toISOString();

  let nextStatus: OfferRow['status'];
  let eventAction: string;
  let eventName: string;

  if (input.action === 'accept') {
    if (!['sent', 'negotiating', 'countered'].includes(offer.status)) {
      throw new AppError(409, `Offer can no longer be accepted (status: ${offer.status})`);
    }
    nextStatus = 'accepted';
    eventAction = 'accepted';
    eventName = 'job_offer_accepted';
  } else if (input.action === 'decline') {
    if (!['sent', 'negotiating', 'countered'].includes(offer.status)) {
      throw new AppError(409, `Offer can no longer be declined (status: ${offer.status})`);
    }
    nextStatus = 'declined';
    eventAction = 'declined';
    eventName = 'job_offer_declined';
  } else {
    // negotiate — locked out after the business's FINAL counter.
    if (offer.is_final_counter || offer.status === 'countered') {
      throw new AppError(403, 'This is a final offer — you can accept, decline, or ask a question');
    }
    if (offer.status !== 'sent') {
      throw new AppError(409, `Offer is not open for negotiation (status: ${offer.status})`);
    }
    if (input.amount === undefined) {
      throw new AppError(400, 'A figure is required to negotiate');
    }
    nextStatus = 'negotiating';
    eventAction = 'negotiation_requested';
    eventName = 'job_offer_negotiation_requested';
  }

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({
      status: nextStatus,
      ...(input.action !== 'negotiate' ? { responded_at: now } : {}),
    })
    .eq('id', offerId)
    .eq('status', offer.status)
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer status changed — refresh and retry');

  await logOfferEvent({ offerId, actor, action: eventAction, amount: input.amount ?? null, note: input.note ?? null });
  await logCandidateEvent({
    candidateId: offer.candidate_id,
    cardId: offer.card_id,
    actor,
    eventType: `offer_${eventAction}`,
    payload: { offer_id: offerId, amount: input.amount ?? null },
  });

  if (refs.businessUserId) {
    const names = await getTalentNames([talentUserId]);
    const talentName = names.get(talentUserId) ?? 'A candidate';
    const titleByAction = {
      accept: `${talentName} accepted your offer for ${offer.position_title}`,
      decline: `${talentName} declined your offer for ${offer.position_title}`,
      negotiate: `${talentName} wants to negotiate the offer for ${offer.position_title}`,
    } as const;
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'job_offer_response',
      title: titleByAction[input.action],
      body: input.note ?? null,
      ref: { card_id: offer.card_id, offer_id: offerId, candidate_id: offer.candidate_id, route: 'jobs' },
    });
  }

  await emitJobsEvent(eventName, {
    external_id: refs.externalId,
    job_profile_external_id: refs.jobProfileExternalId,
    candidate_id: offer.candidate_id,
    actor,
    data: { offer_id: offerId, amount: input.amount ?? null, note: input.note ?? null },
  });

  return updated as unknown as OfferRow;
}

export async function askOfferQuestion(
  talentUserId: string,
  offerId: string,
  question: string,
) {
  const offer = await getOffer(offerId);
  if (offer.talent_user_id !== talentUserId || offer.status === 'draft') {
    throw new AppError(404, 'Offer not found');
  }

  const actor: JobsActor = { type: 'talent', id: talentUserId };
  await logOfferEvent({ offerId, actor, action: 'question_asked', note: question });

  const refs = await getCardRefs(offer.card_id);
  if (refs.businessUserId) {
    const names = await getTalentNames([talentUserId]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'job_offer_question',
      title: `${names.get(talentUserId) ?? 'A candidate'} asked a question on the ${offer.position_title} offer`,
      body: question,
      ref: { card_id: offer.card_id, offer_id: offerId, candidate_id: offer.candidate_id, route: 'jobs' },
    });
  }

  await emitJobsEvent('job_offer_question_asked', {
    external_id: refs.externalId,
    job_profile_external_id: refs.jobProfileExternalId,
    candidate_id: offer.candidate_id,
    actor,
    data: { offer_id: offerId, question },
  });

  return { asked: true };
}

// ─── Business negotiation controls ─────────────────────────────────────────

/** Business agrees to the candidate's asked figure — the offer is a deal. */
export async function acceptNegotiation(
  offerId: string,
  input: { compensation?: Record<string, unknown>; note?: string },
  actor: JobsActor,
): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'negotiating') {
    throw new AppError(409, 'No open negotiation on this offer');
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: 'accepted', responded_at: now };
  if (input.compensation) patch.compensation = input.compensation;

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update(patch)
    .eq('id', offerId)
    .eq('status', 'negotiating')
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer status changed — refresh and retry');

  await logOfferEvent({
    offerId,
    actor,
    action: 'negotiation_accepted',
    amount: input.compensation ?? null,
    note: input.note ?? null,
  });

  const refs = await getCardRefs(offer.card_id);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'job_offer_negotiation_accepted',
    'Negotiation accepted!',
    `${contentBusinessName(refs.content)} agreed to your requested figure for ${offer.position_title}. The offer is now accepted.`,
    `/talent/job-openings/offers/${offerId}`,
  ).catch(() => {});
  notifyJobEvent([offer.talent_user_id], {
    type: 'job_offer',
    title: 'Negotiation accepted!',
    body: `Your requested figure for ${offer.position_title} was accepted.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[offers] negotiation-accept push threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_offer_negotiation_accepted', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: offer.candidate_id,
      actor,
      data: { offer_id: offerId, compensation: input.compensation ?? null },
    });
  }

  return updated as unknown as OfferRow;
}

/** Business declines the asked figure — the ORIGINAL offer stands (back to 'sent'). */
export async function declineNegotiation(
  offerId: string,
  input: { note?: string },
  actor: JobsActor,
): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'negotiating') {
    throw new AppError(409, 'No open negotiation on this offer');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({ status: 'sent' })
    .eq('id', offerId)
    .eq('status', 'negotiating')
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer status changed — refresh and retry');

  await logOfferEvent({ offerId, actor, action: 'negotiation_declined', note: input.note ?? null });

  const refs = await getCardRefs(offer.card_id);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'job_offer_negotiation_declined',
    'Negotiation declined',
    `${contentBusinessName(refs.content)} declined the requested figure for ${offer.position_title}. The original offer still stands.`,
    `/talent/job-openings/offers/${offerId}`,
  ).catch(() => {});
  notifyJobEvent([offer.talent_user_id], {
    type: 'job_offer',
    title: 'Negotiation declined',
    body: `The original offer for ${offer.position_title} still stands.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[offers] negotiation-decline push threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_offer_negotiation_declined', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: offer.candidate_id,
      actor,
      data: { offer_id: offerId },
    });
  }

  return updated as unknown as OfferRow;
}

/**
 * Counteroffer — ALWAYS final. Sets is_final_counter, after which the talent
 * can only accept / decline / ask a question.
 */
export async function counterOffer(
  offerId: string,
  input: { compensation: Record<string, unknown>; note?: string },
  actor: JobsActor,
): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'negotiating') {
    throw new AppError(409, 'A counteroffer is only possible during negotiation');
  }
  if (offer.is_final_counter) {
    throw new AppError(409, 'A final counteroffer was already made');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({
      status: 'countered',
      is_final_counter: true,
      compensation: input.compensation,
    })
    .eq('id', offerId)
    .eq('status', 'negotiating')
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer status changed — refresh and retry');

  await logOfferEvent({
    offerId,
    actor,
    action: 'counter_offered',
    amount: input.compensation,
    note: input.note ?? null,
  });

  const refs = await getCardRefs(offer.card_id);
  const businessName = contentBusinessName(refs.content);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'job_offer_countered',
    'Final counteroffer received',
    `${businessName} made a final counteroffer for ${offer.position_title}. You can accept, decline, or ask a question.`,
    `/talent/job-openings/offers/${offerId}`,
  ).catch(() => {});
  notifyJobEvent([offer.talent_user_id], {
    type: 'job_offer',
    title: 'Final counteroffer received',
    body: `${businessName} made a final counteroffer for ${offer.position_title}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[offers] counter push threw', err));
  const names = await getTalentNames([offer.talent_user_id]);
  fireJobsCrmEvent('talent_job_offer_countered', offer.talent_user_id, {
    talent_name: names.get(offer.talent_user_id) ?? '',
    position_title: offer.position_title,
    business_name: businessName,
  }).catch((err) => console.error('[offers] counter WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_offer_countered', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: offer.candidate_id,
      actor,
      data: { offer_id: offerId, compensation: input.compensation },
    });
  }

  return updated as unknown as OfferRow;
}

export async function withdrawOffer(offerId: string, actor: JobsActor): Promise<OfferRow> {
  const offer = await getOffer(offerId);
  if (!['draft', 'sent', 'negotiating', 'countered'].includes(offer.status)) {
    throw new AppError(409, `Offer can no longer be withdrawn (status: ${offer.status})`);
  }

  const { data: updated, error } = await supabaseAdmin
    .from('job_offers')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', offerId)
    .eq('status', offer.status)
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!updated) throw new AppError(409, 'Offer status changed — refresh and retry');

  await logOfferEvent({ offerId, actor, action: 'withdrawn' });

  const refs = await getCardRefs(offer.card_id);
  // A never-sent draft was invisible to the talent — no notification for it.
  if (offer.status !== 'draft') {
    notifyTalentsInApp(
      [offer.talent_user_id],
      'job_offer_withdrawn',
      'Offer withdrawn',
      `The offer for ${offer.position_title} at ${contentBusinessName(refs.content)} was withdrawn.`,
      `/talent/job-openings/offers/${offerId}`,
    ).catch(() => {});
    notifyJobEvent([offer.talent_user_id], {
      type: 'job_offer',
      title: 'Offer withdrawn',
      body: `The offer for ${offer.position_title} was withdrawn.`,
      cardId: offer.card_id,
    }).catch((err) => console.error('[offers] withdraw push threw', err));
  }

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent(
      'job_offer_withdrawn',
      {
        external_id: refs.externalId,
        job_profile_external_id: refs.jobProfileExternalId,
        candidate_id: offer.candidate_id,
        actor,
        data: { offer_id: offerId },
      },
      `job_offer_withdrawn:${offerId}`,
    );
  }

  return updated as unknown as OfferRow;
}

/** Business/admin answers a question the talent asked on the offer thread. */
export async function answerOfferQuestion(
  offerId: string,
  answer: string,
  actor: JobsActor,
): Promise<{ answered: true }> {
  const offer = await getOffer(offerId);

  await logOfferEvent({ offerId, actor, action: 'question_answered', note: answer });

  const refs = await getCardRefs(offer.card_id);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'job_offer_question_answered',
    'Your question was answered',
    `Reply from ${contentBusinessName(refs.content)} on your ${offer.position_title} offer: ${answer}`,
    `/talent/job-openings/offers/${offerId}`,
  ).catch(() => {});
  notifyJobEvent([offer.talent_user_id], {
    type: 'job_offer',
    title: 'Your question was answered',
    body: `There's a reply on your ${offer.position_title} offer.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[offers] answer push threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitJobsEvent('job_offer_question_answered', {
      external_id: refs.externalId,
      job_profile_external_id: refs.jobProfileExternalId,
      candidate_id: offer.candidate_id,
      actor,
      data: { offer_id: offerId, answer },
    });
  }

  return { answered: true };
}

// ─── Expiry (interview sweeper tick) ───────────────────────────────────────

export async function expireOverdueOffers(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await supabaseAdmin
    .from('job_offers')
    .select('id, card_id, talent_user_id, candidate_id, position_title')
    .in('status', ['sent', 'negotiating', 'countered'])
    .lt('expires_on', today);
  if (error) {
    console.error('[offers] expiry query failed', error.message);
    return 0;
  }

  const offers = rows ?? [];
  for (const o of offers as any[]) {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from('job_offers')
      .update({ status: 'expired' })
      .eq('id', o.id)
      .in('status', ['sent', 'negotiating', 'countered'])
      .select('id')
      .maybeSingle();
    if (updErr || !updated) continue;

    const actor: JobsActor = { type: 'system' };
    await logOfferEvent({ offerId: o.id as string, actor, action: 'expired' });

    // Card refs feed both the notification copy and the outbox emit — a refs
    // failure must not silence the talent notification.
    let refs: Awaited<ReturnType<typeof getCardRefs>> | null = null;
    try {
      refs = await getCardRefs(o.card_id as string);
    } catch (err) {
      console.error('[offers] expiry card refs failed', err);
    }
    const businessName = refs ? contentBusinessName(refs.content) : null;

    notifyTalentsInApp(
      [o.talent_user_id as string],
      'job_offer_expired',
      'Offer expired',
      `The offer for ${o.position_title}${businessName ? ` at ${businessName}` : ''} expired.`,
      `/talent/job-openings/offers/${o.id}`,
    ).catch(() => {});
    notifyJobEvent([o.talent_user_id as string], {
      type: 'job_offer',
      title: 'Offer expired',
      body: `The offer for ${o.position_title} expired.`,
      cardId: o.card_id as string,
    }).catch((err) => console.error('[offers] expiry push threw', err));

    if (refs) {
      try {
        await emitJobsEvent(
          'job_offer_expired',
          {
            external_id: refs.externalId,
            job_profile_external_id: refs.jobProfileExternalId,
            candidate_id: o.candidate_id as string,
            actor,
            data: { offer_id: o.id },
          },
          `job_offer_expired:${o.id}`,
        );
      } catch (err) {
        console.error('[offers] expiry outbox emit failed', err);
      }
    }
  }

  return offers.length;
}
