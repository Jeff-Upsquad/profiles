import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import {
  contentBusinessName,
  getTalentNames,
  notifyTalentsInApp,
  shouldEmitOutbox,
  type JobsActor,
} from './jobs.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { emitCardEvent } from './card-events-outbox.service.js';
import { notifyAssignmentEvent } from './push.service.js';
import { fireJobsCrmEvent } from './talent-whatsapp.service.js';
import { deliverCallback } from './squadhub-callback.service.js';
import { writeAcceptedTalentToDashboard } from './subscription.service.js';

/**
 * Card offer / bid / counter-offer engine (00110 + generalization).
 *
 * Product rules (2026-08):
 *  - Talent's FIRST bid marks the recipient accepted and surfaces them under
 *    "New talents for review" with the bid price — NOT under Bidding yet.
 *  - Bidding section only after the business has sent an offer/counter.
 *  - Each side has MAX 3 priced moves (bid / counter / send) per card.
 *
 *   (talent bid / submit / counter) -> pending_business
 *   (business send / counter)       -> pending_talent
 *   (either side accept)            -> accepted  [terminal; Select is SEPARATE]
 */

/** Bid / offer amounts must land on this step (INR). */
export const OFFER_AMOUNT_STEP = 500;
/** Max priced moves per side on a given card (talent ↔ business). */
export const MAX_TALENT_BIDS = 3;
export const MAX_BUSINESS_OFFERS = 3;
const OFFERABLE_CARD_TYPES = new Set(['subscription', 'assignment']);

export type AssignmentOfferStatus =
  | 'pending_business'
  | 'pending_talent'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export interface AssignmentOfferRow {
  id: string;
  card_id: string;
  recipient_id: string;
  talent_user_id: string;
  business_user_id: string | null;
  pricing_mode: 'priced' | 'unpriced';
  current_amount: Record<string, unknown>;
  current_terms: Record<string, unknown> | null;
  status: AssignmentOfferStatus;
  opened_by: 'talent' | 'business' | 'admin';
  last_actor_side: 'talent' | 'business' | 'admin' | null;
  expires_on: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

const OFFER_FIELDS =
  'id, card_id, recipient_id, talent_user_id, business_user_id, pricing_mode, current_amount, current_terms, status, opened_by, last_actor_side, expires_on, responded_at, created_at, updated_at';

const OPEN_STATUSES: AssignmentOfferStatus[] = ['pending_business', 'pending_talent', 'accepted'];
const PENDING_STATUSES: AssignmentOfferStatus[] = ['pending_business', 'pending_talent'];

// ─── Small helpers ─────────────────────────────────────────────────────────

function cardOfferTitle(content: Record<string, unknown>, cardType: string): string {
  if (typeof content.title === 'string' && content.title.trim()) return content.title.trim();
  if (typeof content.brand_name === 'string' && content.brand_name.trim()) return content.brand_name.trim();
  return cardType === 'assignment' ? 'the assignment' : 'the subscription';
}

function actorSide(actor: JobsActor): 'talent' | 'business' | 'admin' {
  if (actor.type === 'talent') return 'talent';
  if (actor.type === 'admin') return 'admin';
  return 'business';
}

function talentDeepLink(cardType: string): string {
  return cardType === 'assignment' ? '/talent/assignments' : '/talent/subscriptions';
}

/** Count priced moves (submit/counter) for each side across all offers on this card+talent. */
async function countMovesForCardTalent(
  cardId: string,
  talentUserId: string,
): Promise<{ talentMoves: number; businessMoves: number }> {
  const { data: offers } = await supabaseAdmin
    .from('assignment_offers')
    .select('id')
    .eq('card_id', cardId)
    .eq('talent_user_id', talentUserId);
  const offerIds = (offers ?? []).map((o: any) => o.id as string);
  if (offerIds.length === 0) return { talentMoves: 0, businessMoves: 0 };

  const { data: events } = await supabaseAdmin
    .from('assignment_offer_events')
    .select('actor_type, action')
    .in('offer_id', offerIds)
    .in('action', ['submitted', 'countered']);

  let talentMoves = 0;
  let businessMoves = 0;
  for (const e of events ?? []) {
    const action = (e as any).action as string;
    if (action !== 'submitted' && action !== 'countered') continue;
    const t = (e as any).actor_type as string;
    if (t === 'talent') talentMoves++;
    else if (t === 'business' || t === 'admin') businessMoves++;
  }
  return { talentMoves, businessMoves };
}

/**
 * First talent bid = interest at that price → mark accepted so they appear in
 * "New talents for review" (with bid amount). Mirrors respond(accept) side effects.
 */
async function markRecipientAcceptedOnFirstBid(
  recipientId: string,
  talentUserId: string,
  cardId: string,
  externalId: string | null,
  businessUserId: string | null,
): Promise<void> {
  const respondedAt = new Date().toISOString();
  const { data: updated } = await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: 'accepted', responded_at: respondedAt })
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .eq('status', 'pending')
    .is('cancelled_at', null)
    .select('id')
    .maybeSingle();
  if (!updated) return; // already accepted/rejected

  if (externalId) {
    const { data: talent } = await supabaseAdmin
      .from('talent_users')
      .select('full_name')
      .eq('id', talentUserId)
      .maybeSingle();
    deliverCallback({
      external_id: externalId,
      recipient_id: recipientId,
      talent_user_id: talentUserId,
      talent_name: talent?.full_name ?? undefined,
      action: 'accept',
      responded_at: respondedAt,
    }).catch((err) => console.error('[assignment-offers] deliverCallback on first bid threw', err));
  }

  if (businessUserId) {
    try {
      const { data: card } = await supabaseAdmin
        .from('subscription_cards')
        .select('match_rules')
        .eq('id', cardId)
        .maybeSingle();
      await writeAcceptedTalentToDashboard(
        businessUserId,
        talentUserId,
        (card as any)?.match_rules,
      );
    } catch (err) {
      console.error('[assignment-offers] dashboard share on first bid threw', err);
    }
  }
}

/**
 * Normalize + validate a negotiated figure. Amounts must be positive integers
 * in multiples of OFFER_AMOUNT_STEP (₹500).
 */
export function normalizeOfferAmount(
  amount: Record<string, unknown>,
  defaults?: { currency?: string; period?: string },
): Record<string, unknown> {
  const raw = amount?.amount;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(400, 'Offer amount must be a positive number');
  }
  const rounded = Math.round(n);
  if (rounded % OFFER_AMOUNT_STEP !== 0) {
    throw new AppError(400, `Offer amount must be in multiples of ₹${OFFER_AMOUNT_STEP}`);
  }
  return {
    ...amount,
    amount: rounded,
    currency: (typeof amount.currency === 'string' && amount.currency) || defaults?.currency || 'INR',
    period: (typeof amount.period === 'string' && amount.period) || defaults?.period || 'per_month',
  };
}

interface AssignmentCardRefs {
  cardId: string;
  externalId: string | null;
  businessUserId: string | null;
  content: Record<string, unknown>;
  pricingMode: 'priced' | 'unpriced';
  cardType: 'subscription' | 'assignment';
}

async function getAssignmentCardRefs(cardId: string): Promise<AssignmentCardRefs> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, business_user_id, content, card_type')
    .eq('id', cardId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  const cardType = (data as any)?.card_type as string | undefined;
  if (!data || !cardType || !OFFERABLE_CARD_TYPES.has(cardType)) {
    throw new AppError(404, 'Card not found');
  }
  // On Profiles the assignment details ride inside content JSONB (SquadHub sends
  // content.assignment_details) — there is NO assignment_details column here.
  const content = ((data as any).content ?? {}) as Record<string, unknown>;
  const ad = (content.assignment_details ?? {}) as Record<string, unknown>;
  // Subscriptions are always priced (list monthly price). Assignments may be unpriced.
  const pricingMode: 'priced' | 'unpriced' =
    cardType === 'assignment' && ad.pricing_mode === 'unpriced' ? 'unpriced' : 'priced';
  return {
    cardId,
    externalId: ((data as any).external_id as string | null) ?? null,
    businessUserId: ((data as any).business_user_id as string | null) ?? null,
    content,
    pricingMode,
    cardType: cardType as 'subscription' | 'assignment',
  };
}

/** Stamp business_review_status=shortlisted (idempotent). */
async function shortlistRecipient(recipientId: string): Promise<void> {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ business_review_status: 'shortlisted', business_reviewed_at: now })
    .eq('id', recipientId)
    .is('cancelled_at', null)
    .or('business_review_status.is.null,business_review_status.eq.rejected');
}

async function logEvent(input: {
  offerId: string;
  actor: JobsActor;
  action: string;
  amount?: unknown;
  note?: string | null;
}): Promise<void> {
  const { error } = await supabaseAdmin.from('assignment_offer_events').insert({
    offer_id: input.offerId,
    actor_type: input.actor.type,
    actor_id: input.actor.id ?? null,
    action: input.action,
    amount: input.amount ?? null,
    note: input.note ?? null,
  });
  if (error) {
    console.error('[assignment-offers] failed to log event', { action: input.action, error: error.message });
  }
}

export async function getOffer(offerId: string): Promise<AssignmentOfferRow> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('id', offerId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Offer not found');
  return data as unknown as AssignmentOfferRow;
}

async function getOpenOfferForRecipient(recipientId: string): Promise<AssignmentOfferRow | null> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('recipient_id', recipientId)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  return (data as unknown as AssignmentOfferRow) ?? null;
}

async function getLatestOfferForRecipient(recipientId: string): Promise<AssignmentOfferRow | null> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  return (data as unknown as AssignmentOfferRow) ?? null;
}

export async function listOfferEvents(offerId: string) {
  const { data, error } = await supabaseAdmin
    .from('assignment_offer_events')
    .select('id, actor_type, action, amount, note, created_at')
    .eq('offer_id', offerId)
    .order('created_at', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return data ?? [];
}

interface TalentRecipientCtx {
  recipientId: string;
  cardId: string;
  talentUserId: string;
  recipientStatus: string;
}

/** Load + validate a recipient row owned by the talent on a LIVE offerable card. */
async function loadTalentRecipient(
  talentUserId: string,
  recipientId: string,
): Promise<{ ctx: TalentRecipientCtx; refs: AssignmentCardRefs }> {
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, cancelled_at, subscription_cards!inner(status, card_type)')
    .eq('id', recipientId)
    .eq('talent_user_id', talentUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Offer not found');
  const card = (data as any).subscription_cards as { status?: string; card_type?: string } | undefined;
  if (!card?.card_type || !OFFERABLE_CARD_TYPES.has(card.card_type)) {
    throw new AppError(400, 'Offers are not available on this card type');
  }
  if (card?.status !== 'active') throw new AppError(409, 'This card is no longer available');
  if ((data as any).cancelled_at) throw new AppError(409, 'This offer has been cancelled');
  const refs = await getAssignmentCardRefs((data as any).card_id as string);
  return {
    ctx: {
      recipientId,
      cardId: (data as any).card_id as string,
      talentUserId,
      recipientStatus: (data as any).status as string,
    },
    refs,
  };
}

/** Optimistic status transition (compare-and-set on the previous status). */
async function transition(
  offer: AssignmentOfferRow,
  next: AssignmentOfferStatus,
  actor: JobsActor,
  opts: { responded?: boolean; amount?: Record<string, unknown>; terms?: Record<string, unknown> | null } = {},
): Promise<AssignmentOfferRow> {
  const patch: Record<string, unknown> = { status: next, last_actor_side: actorSide(actor) };
  if (opts.responded) patch.responded_at = new Date().toISOString();
  if (opts.amount !== undefined) patch.current_amount = opts.amount;
  if (opts.terms !== undefined) patch.current_terms = opts.terms;

  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .update(patch)
    .eq('id', offer.id)
    .eq('status', offer.status)
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(409, 'Offer status changed — refresh and retry');
  return data as unknown as AssignmentOfferRow;
}

/** Once one talent is selected the card is filled — expire the rest. */
async function expireOtherOpenOffers(cardId: string, keepOfferId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('assignment_offers')
    .select('id')
    .eq('card_id', cardId)
    .neq('id', keepOfferId)
    .in('status', PENDING_STATUSES);
  for (const row of data ?? []) {
    const id = (row as any).id as string;
    const { data: upd } = await supabaseAdmin
      .from('assignment_offers')
      .update({ status: 'expired' })
      .eq('id', id)
      .in('status', PENDING_STATUSES)
      .select('id')
      .maybeSingle();
    if (upd) {
      await logEvent({ offerId: id, actor: { type: 'system' }, action: 'expired', note: 'Assignment filled by another talent' });
    }
  }
}

/**
 * Terminal-accept handler. Flips the recipient to 'accepted' + shortlists
 * (feeding the existing Select spine). Does NOT select — business presses
 * Select separately. `selectNow` is ignored (kept for call-site compatibility).
 */
async function onOfferAccepted(
  offer: AssignmentOfferRow,
  refs: AssignmentCardRefs,
  actor: JobsActor,
  _selectNow?: boolean,
): Promise<void> {
  const title = cardOfferTitle(refs.content, refs.cardType);
  // Mark the recipient accepted at the agreed figure (only if still pending —
  // never clobber an already-terminal recipient row).
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', offer.recipient_id)
    .eq('status', 'pending')
    .is('cancelled_at', null);

  // Auto-shortlist so Select is available without an extra shortlist click.
  await shortlistRecipient(offer.recipient_id);

  const deepLink = talentDeepLink(refs.cardType);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_accepted',
    'Offer accepted',
    `Your offer for ${title} was accepted.`,
    deepLink,
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Offer accepted 🎉',
    body: `Your offer for ${title} was accepted.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] accept push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_accepted', offer.talent_user_id, {
    position_title: title,
    business_name: contentBusinessName(refs.content),
  }).catch((err) => console.error('[assignment-offers] accept WA threw', err));

  // When the TALENT accepted the business's offer/counter, ping the business.
  if (actor.type === 'talent' && refs.businessUserId) {
    const names = await getTalentNames([offer.talent_user_id]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'assignment_offer_accepted',
      title: `${names.get(offer.talent_user_id) ?? 'A talent'} accepted your offer for ${title}`,
      body: null,
      ref: {
        card_id: offer.card_id,
        offer_id: offer.id,
        recipient_id: offer.recipient_id,
        route: refs.cardType === 'assignment' ? 'assignments' : 'subscription',
      },
    });
  }

  if (shouldEmitOutbox(actor)) {
    await emitCardEvent(
      'assignment_offer_accepted',
      {
        external_id: refs.externalId,
        recipient_id: offer.recipient_id,
        offer_id: offer.id,
        actor,
        data: { amount: offer.current_amount, by: actorSide(actor) },
      },
      `assignment_offer_accepted:${offer.id}`,
    );
  }
}

async function notifyBusinessOfTalentTerminal(
  offer: AssignmentOfferRow,
  refs: AssignmentCardRefs,
  kind: 'declined' | 'withdrawn',
): Promise<void> {
  const title = cardOfferTitle(refs.content, refs.cardType);
  if (refs.businessUserId) {
    const names = await getTalentNames([offer.talent_user_id]);
    const talentName = names.get(offer.talent_user_id) ?? 'A talent';
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: `assignment_offer_${kind}`,
      title:
        kind === 'declined'
          ? `${talentName} declined your offer for ${title}`
          : `${talentName} withdrew their bid for ${title}`,
      body: null,
      ref: {
        card_id: offer.card_id,
        offer_id: offer.id,
        recipient_id: offer.recipient_id,
        route: refs.cardType === 'assignment' ? 'assignments' : 'subscription',
      },
    });
  }
  await emitCardEvent(
    `assignment_offer_${kind}`,
    {
      external_id: refs.externalId,
      recipient_id: offer.recipient_id,
      offer_id: offer.id,
      actor: { type: 'talent', id: offer.talent_user_id },
      data: {},
    },
    `assignment_offer_${kind}:${offer.id}`,
  );
}

// ─── Talent actions ────────────────────────────────────────────────────────

/**
 * Talent opens (unpriced submit / priced counter) or revises a figure. Whether
 * it was the talent's turn (pending_talent) or a revision of their own standing
 * ask (pending_business), the ball goes to the business.
 */
export async function talentSubmitOrCounter(
  talentUserId: string,
  recipientId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
): Promise<AssignmentOfferRow> {
  const { ctx, refs } = await loadTalentRecipient(talentUserId, recipientId);
  const actor: JobsActor = { type: 'talent', id: talentUserId };
  const existing = await getOpenOfferForRecipient(recipientId);
  const periodDefault = refs.cardType === 'assignment' ? 'project' : 'per_month';
  const amount = normalizeOfferAmount(input.amount, { period: periodDefault });
  const title = cardOfferTitle(refs.content, refs.cardType);

  const { talentMoves, businessMoves } = await countMovesForCardTalent(ctx.cardId, talentUserId);
  if (talentMoves >= MAX_TALENT_BIDS) {
    throw new AppError(
      409,
      `You have used all ${MAX_TALENT_BIDS} bids on this card. You can still accept or decline a business offer.`,
    );
  }

  // After business has engaged, talent may only move on their turn (pending_talent)
  // or revise their own pending bid (pending_business). First bid is always allowed.
  if (existing?.status === 'accepted') {
    throw new AppError(409, 'This offer has already been accepted');
  }
  if (existing && businessMoves > 0 && existing.status !== 'pending_talent' && existing.status !== 'pending_business') {
    throw new AppError(409, 'This negotiation is closed');
  }

  let offer: AssignmentOfferRow;
  let action: 'submitted' | 'countered';
  const isFirstBid = !existing;

  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('assignment_offers')
      .insert({
        card_id: ctx.cardId,
        recipient_id: recipientId,
        talent_user_id: talentUserId,
        business_user_id: refs.businessUserId,
        pricing_mode: refs.pricingMode,
        current_amount: amount,
        current_terms: input.terms ?? null,
        status: 'pending_business',
        opened_by: 'talent',
        last_actor_side: 'talent',
      })
      .select(OFFER_FIELDS)
      .maybeSingle();
    if (error) {
      if ((error as any).code === '23505') {
        throw new AppError(409, 'You already have an open bid on this card');
      }
      throw new AppError(500, error.message);
    }
    offer = data as unknown as AssignmentOfferRow;
    action = 'submitted';

    // First bid → accepted interest at bid price → shows under For Review, not Bidding.
    await markRecipientAcceptedOnFirstBid(
      recipientId,
      talentUserId,
      ctx.cardId,
      refs.externalId,
      refs.businessUserId,
    );
  } else {
    // Counters / revises only when negotiation allows it.
    if (businessMoves > 0 && existing.status === 'pending_business') {
      // Revising own bid while waiting for business — allowed if bids remain.
    } else if (businessMoves > 0 && existing.status !== 'pending_talent') {
      throw new AppError(409, 'It is not your turn to bid');
    }
    offer = await transition(existing, 'pending_business', actor, {
      amount,
      terms: input.terms ?? existing.current_terms,
    });
    action = isFirstBid ? 'submitted' : 'countered';
  }

  await logEvent({ offerId: offer.id, actor, action, amount, note: input.note ?? null });

  if (refs.businessUserId) {
    const names = await getTalentNames([talentUserId]);
    const talentName = names.get(talentUserId) ?? 'A talent';
    const remaining = MAX_TALENT_BIDS - (talentMoves + 1);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: action === 'submitted' ? 'assignment_offer_submitted' : 'assignment_offer_countered',
      title:
        action === 'submitted'
          ? `${talentName} bid ${typeof amount.amount === 'number' ? `₹${amount.amount.toLocaleString()}` : ''} on ${title}`
          : `${talentName} sent a counter-bid on ${title}`,
      body: input.note ?? (remaining >= 0 ? `${remaining} talent bid(s) remaining` : null),
      ref: {
        card_id: ctx.cardId,
        offer_id: offer.id,
        recipient_id: recipientId,
        route: refs.cardType === 'assignment' ? 'assignments' : 'subscription',
      },
    });
  }

  await emitCardEvent(action === 'submitted' ? 'assignment_offer_submitted' : 'assignment_offer_countered', {
    external_id: refs.externalId,
    recipient_id: recipientId,
    offer_id: offer.id,
    actor,
    data: { amount, terms: input.terms ?? null, note: input.note ?? null },
  });

  return offer;
}

/** Talent accepts / declines the business's counter, or withdraws their own submission. */
export async function talentRespondToOffer(
  talentUserId: string,
  recipientId: string,
  input: { action: 'accept' | 'decline' | 'withdraw'; note?: string },
): Promise<AssignmentOfferRow> {
  const { refs } = await loadTalentRecipient(talentUserId, recipientId);
  const actor: JobsActor = { type: 'talent', id: talentUserId };
  const offer = await getOpenOfferForRecipient(recipientId);
  if (!offer || offer.talent_user_id !== talentUserId) throw new AppError(404, 'No open offer to respond to');

  if (input.action === 'withdraw') {
    if (offer.status !== 'pending_business') {
      throw new AppError(409, 'You can only withdraw an offer that is awaiting the business');
    }
    const updated = await transition(offer, 'withdrawn', actor, { responded: true });
    await logEvent({ offerId: offer.id, actor, action: 'withdrawn', note: input.note ?? null });
    await notifyBusinessOfTalentTerminal(updated, refs, 'withdrawn');
    return updated;
  }

  if (offer.status !== 'pending_talent') {
    throw new AppError(409, 'There is no counter-offer awaiting your response');
  }

  if (input.action === 'accept') {
    const updated = await transition(offer, 'accepted', actor, { responded: true });
    await logEvent({ offerId: offer.id, actor, action: 'accepted', amount: offer.current_amount, note: input.note ?? null });
    await onOfferAccepted(updated, refs, actor, false);
    return updated;
  }

  const updated = await transition(offer, 'declined', actor, { responded: true });
  await logEvent({ offerId: offer.id, actor, action: 'declined', note: input.note ?? null });
  await notifyBusinessOfTalentTerminal(updated, refs, 'declined');
  return updated;
}

/** Talent's live offer + thread for one recipient (null when none yet). */
export async function getOfferForTalentRecipient(talentUserId: string, recipientId: string) {
  const { ctx } = await loadTalentRecipient(talentUserId, recipientId);
  const offer = (await getOpenOfferForRecipient(recipientId)) ?? (await getLatestOfferForRecipient(recipientId));
  const { talentMoves, businessMoves } = await countMovesForCardTalent(ctx.cardId, talentUserId);
  const limits = {
    max_talent_bids: MAX_TALENT_BIDS,
    max_business_offers: MAX_BUSINESS_OFFERS,
    talent_bids_used: talentMoves,
    business_offers_used: businessMoves,
    talent_bids_remaining: Math.max(0, MAX_TALENT_BIDS - talentMoves),
    business_offers_remaining: Math.max(0, MAX_BUSINESS_OFFERS - businessMoves),
    /** True once the business has made at least one priced move — Bidding section. */
    negotiation_started: businessMoves > 0,
  };
  if (!offer) return { offer: null, events: [] as unknown[], ...limits };
  const events = await listOfferEvents(offer.id);
  return { offer, events, ...limits };
}

// ─── Business / admin actions ──────────────────────────────────────────────

export async function businessCounter(
  offerId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
  actor: JobsActor,
): Promise<AssignmentOfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'pending_business') throw new AppError(409, 'It is not your turn to counter this offer');
  const refs = await getAssignmentCardRefs(offer.card_id);
  const periodDefault = refs.cardType === 'assignment' ? 'project' : 'per_month';
  const amount = normalizeOfferAmount(input.amount, { period: periodDefault });
  const title = cardOfferTitle(refs.content, refs.cardType);

  const { businessMoves } = await countMovesForCardTalent(offer.card_id, offer.talent_user_id);
  if (businessMoves >= MAX_BUSINESS_OFFERS) {
    throw new AppError(
      409,
      `You have used all ${MAX_BUSINESS_OFFERS} offers on this card. You can still accept or decline the talent's bid.`,
    );
  }

  const updated = await transition(offer, 'pending_talent', actor, {
    amount,
    terms: input.terms ?? offer.current_terms,
  });
  await logEvent({ offerId, actor, action: 'countered', amount, note: input.note ?? null });

  const remaining = MAX_BUSINESS_OFFERS - (businessMoves + 1);
  const deepLink = talentDeepLink(refs.cardType);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_countered',
    'Counter-offer received',
    `${contentBusinessName(refs.content)} sent a counter-offer for ${title}. ${remaining} offer(s) left from them.`,
    deepLink,
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Counter-offer received',
    body: `${contentBusinessName(refs.content)} countered your bid for ${title}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] counter push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_countered', offer.talent_user_id, {
    position_title: title,
    business_name: contentBusinessName(refs.content),
  }).catch((err) => console.error('[assignment-offers] counter WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitCardEvent('assignment_offer_countered_by_business', {
      external_id: refs.externalId,
      recipient_id: offer.recipient_id,
      offer_id: offerId,
      actor,
      data: { amount, terms: input.terms ?? null },
    });
  }

  return updated;
}

/**
 * Business (or admin on their behalf) opens a new offer TO a talent, or counters
 * an existing talent bid. Auto-shortlists the recipient on send.
 */
export async function businessSendOffer(
  cardId: string,
  recipientId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
  actor: JobsActor,
): Promise<AssignmentOfferRow> {
  const refs = await getAssignmentCardRefs(cardId);
  const periodDefault = refs.cardType === 'assignment' ? 'project' : 'per_month';
  const amount = normalizeOfferAmount(input.amount, { period: periodDefault });
  const title = cardOfferTitle(refs.content, refs.cardType);

  const { data: recipient, error: recErr } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, cancelled_at')
    .eq('id', recipientId)
    .eq('card_id', cardId)
    .maybeSingle();
  if (recErr) throw new AppError(500, recErr.message);
  if (!recipient) throw new AppError(404, 'Recipient not found');
  if ((recipient as any).cancelled_at) throw new AppError(409, 'Recipient has been cancelled');
  if ((recipient as any).status === 'rejected') {
    throw new AppError(409, 'This talent declined the card');
  }

  const talentUserId = (recipient as any).talent_user_id as string;
  const existing = await getOpenOfferForRecipient(recipientId);

  const { businessMoves } = await countMovesForCardTalent(cardId, talentUserId);
  if (businessMoves >= MAX_BUSINESS_OFFERS) {
    throw new AppError(
      409,
      `You have used all ${MAX_BUSINESS_OFFERS} offers on this card. You can still accept or decline the talent's bid.`,
    );
  }

  // If talent already has a live bid awaiting business, treat this as a counter.
  if (existing && existing.status === 'pending_business') {
    return businessCounter(existing.id, { amount, terms: input.terms, note: input.note }, actor);
  }
  if (existing && existing.status === 'pending_talent') {
    // Revise our standing offer (still talent's turn after) — still counts as a move.
    const updated = await transition(existing, 'pending_talent', actor, {
      amount,
      terms: input.terms ?? existing.current_terms,
    });
    await logEvent({ offerId: existing.id, actor, action: 'countered', amount, note: input.note ?? null });
    await shortlistRecipient(recipientId);
    await notifyTalentOfBusinessOffer(updated, refs, title, amount, input.note);
    return updated;
  }
  if (existing && existing.status === 'accepted') {
    throw new AppError(409, 'An accepted offer already exists for this talent');
  }

  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .insert({
      card_id: cardId,
      recipient_id: recipientId,
      talent_user_id: talentUserId,
      business_user_id: refs.businessUserId,
      pricing_mode: refs.pricingMode,
      current_amount: amount,
      current_terms: input.terms ?? null,
      status: 'pending_talent',
      opened_by: actor.type === 'admin' ? 'admin' : 'business',
      last_actor_side: actorSide(actor),
    })
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) {
    if ((error as any).code === '23505') {
      throw new AppError(409, 'An open offer already exists for this talent');
    }
    throw new AppError(500, error.message);
  }
  const offer = data as unknown as AssignmentOfferRow;
  await logEvent({ offerId: offer.id, actor, action: 'submitted', amount, note: input.note ?? null });

  // Auto-shortlist when the business opens negotiation.
  await shortlistRecipient(recipientId);

  await notifyTalentOfBusinessOffer(offer, refs, title, amount, input.note);

  if (shouldEmitOutbox(actor)) {
    await emitCardEvent('assignment_offer_sent_by_business', {
      external_id: refs.externalId,
      recipient_id: recipientId,
      offer_id: offer.id,
      actor,
      data: { amount, terms: input.terms ?? null, note: input.note ?? null },
    });
  }

  return offer;
}

async function notifyTalentOfBusinessOffer(
  offer: AssignmentOfferRow,
  refs: AssignmentCardRefs,
  title: string,
  amount: Record<string, unknown>,
  note?: string,
): Promise<void> {
  const deepLink = talentDeepLink(refs.cardType);
  const biz = contentBusinessName(refs.content);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_received',
    'Offer received',
    `${biz} sent you an offer for ${title}.`,
    deepLink,
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Offer received',
    body: `${biz} sent you an offer for ${title}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] send push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_received', offer.talent_user_id, {
    position_title: title,
    business_name: biz,
    amount,
    note: note ?? null,
  }).catch((err) => console.error('[assignment-offers] send WA threw', err));
}

/** Business/admin accepts the talent's current figure — shortlists; Select is separate. */
export async function businessAccept(
  offerId: string,
  input: { note?: string },
  actor: JobsActor,
): Promise<AssignmentOfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'pending_business') throw new AppError(409, 'There is no offer awaiting your response');
  const refs = await getAssignmentCardRefs(offer.card_id);

  const updated = await transition(offer, 'accepted', actor, { responded: true });
  await logEvent({ offerId, actor, action: 'accepted', amount: offer.current_amount, note: input.note ?? null });
  await onOfferAccepted(updated, refs, actor, false);
  return updated;
}

export async function businessDecline(
  offerId: string,
  input: { note?: string },
  actor: JobsActor,
): Promise<AssignmentOfferRow> {
  const offer = await getOffer(offerId);
  if (offer.status !== 'pending_business') throw new AppError(409, 'There is no offer awaiting your response');
  const refs = await getAssignmentCardRefs(offer.card_id);

  const updated = await transition(offer, 'declined', actor, { responded: true });
  await logEvent({ offerId, actor, action: 'declined', note: input.note ?? null });

  const title = cardOfferTitle(refs.content, refs.cardType);
  const deepLink = talentDeepLink(refs.cardType);
  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_declined',
    'Offer declined',
    `${contentBusinessName(refs.content)} declined your bid for ${title}.`,
    deepLink,
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Offer declined',
    body: `${contentBusinessName(refs.content)} declined your bid for ${title}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] decline push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_declined', offer.talent_user_id, {
    position_title: title,
    business_name: contentBusinessName(refs.content),
  }).catch((err) => console.error('[assignment-offers] decline WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitCardEvent('assignment_offer_declined_by_business', {
      external_id: refs.externalId,
      recipient_id: offer.recipient_id,
      offer_id: offerId,
      actor,
      data: {},
    });
  }

  return updated;
}

export interface AssignmentOfferWithThread extends AssignmentOfferRow {
  talent_name: string;
  events: unknown[];
  /** Profile link targets for the business portal (null when no approved profile). */
  profile_id: string | null;
  category_id: string | null;
  profile_photo_url: string | null;
  /** Standing list price on the card when the offer was listed (for "vs original"). */
  list_price: number | null;
  list_currency: string | null;
  talent_bids_used: number;
  business_offers_used: number;
  talent_bids_remaining: number;
  business_offers_remaining: number;
  /**
   * True once the business has made ≥1 priced move. First talent-only bids
   * stay under For Review until this is true; then they appear under Bidding.
   */
  negotiation_started: boolean;
}

/** All offers on a card + their threads (business console / admin live view). */
export async function listOffersForCard(cardId: string): Promise<AssignmentOfferWithThread[]> {
  const refs = await getAssignmentCardRefs(cardId).catch(() => null);
  const listPrice =
    typeof refs?.content?.customer_monthly_price === 'number'
      ? (refs.content.customer_monthly_price as number)
      : typeof refs?.content?.monthly_price === 'number'
        ? (refs.content.monthly_price as number)
        : typeof refs?.content?.proposed_price === 'number'
          ? (refs.content.proposed_price as number)
          : null;
  const listCurrency =
    typeof refs?.content?.currency === 'string' ? (refs.content.currency as string) : 'INR';

  // Categories on the card — used to pick a matching approved profile for the
  // "open profile" link from the Bidding section.
  const matchRules = await (async () => {
    const { data } = await supabaseAdmin
      .from('subscription_cards')
      .select('match_rules')
      .eq('id', cardId)
      .maybeSingle();
    return (data as any)?.match_rules ?? null;
  })();
  const categoryIds: string[] = (() => {
    if (!matchRules || typeof matchRules !== 'object') return [];
    const raw = (matchRules as Record<string, unknown>).category_ids;
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
  })();

  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  const offers = (data ?? []) as unknown as AssignmentOfferRow[];
  if (offers.length === 0) return [];

  const talentIds = offers.map((o) => o.talent_user_id);
  const names = await getTalentNames(talentIds);

  const photoByTalent = new Map<string, string | null>();
  const { data: talentRows } = await supabaseAdmin
    .from('talent_users')
    .select('id, profile_photo_url')
    .in('id', talentIds);
  for (const t of talentRows ?? []) {
    photoByTalent.set((t as any).id, ((t as any).profile_photo_url as string | null) ?? null);
  }

  // Best matching approved profile per talent (for profile deep-link).
  const profileByTalent = new Map<string, { profile_id: string; category_id: string }>();
  if (talentIds.length > 0) {
    let q = supabaseAdmin
      .from('talent_profiles')
      .select('id, talent_user_id, category_id')
      .in('talent_user_id', talentIds)
      .eq('status', 'approved')
      .eq('is_active', true)
      .is('deleted_at', null);
    if (categoryIds.length > 0) q = q.in('category_id', categoryIds);
    const { data: profiles } = await q;
    for (const p of profiles ?? []) {
      const tid = (p as any).talent_user_id as string;
      if (!profileByTalent.has(tid)) {
        profileByTalent.set(tid, {
          profile_id: (p as any).id as string,
          category_id: (p as any).category_id as string,
        });
      }
    }
  }

  const withThreads: AssignmentOfferWithThread[] = [];
  for (const o of offers) {
    const events = await listOfferEvents(o.id);
    const prof = profileByTalent.get(o.talent_user_id);
    const { talentMoves, businessMoves } = await countMovesForCardTalent(cardId, o.talent_user_id);
    withThreads.push({
      ...o,
      talent_name: names.get(o.talent_user_id) ?? 'Unknown talent',
      events,
      profile_id: prof?.profile_id ?? null,
      category_id: prof?.category_id ?? null,
      profile_photo_url: photoByTalent.get(o.talent_user_id) ?? null,
      list_price: listPrice,
      list_currency: listCurrency,
      talent_bids_used: talentMoves,
      business_offers_used: businessMoves,
      talent_bids_remaining: Math.max(0, MAX_TALENT_BIDS - talentMoves),
      business_offers_remaining: Math.max(0, MAX_BUSINESS_OFFERS - businessMoves),
      negotiation_started: businessMoves > 0 || o.opened_by === 'business' || o.opened_by === 'admin',
    });
  }
  return withThreads;
}

export async function getOfferWithThread(offerId: string): Promise<AssignmentOfferWithThread> {
  const offer = await getOffer(offerId);
  const list = await listOffersForCard(offer.card_id);
  const found = list.find((o) => o.id === offerId);
  if (found) return found;
  const names = await getTalentNames([offer.talent_user_id]);
  const events = await listOfferEvents(offerId);
  const { talentMoves, businessMoves } = await countMovesForCardTalent(offer.card_id, offer.talent_user_id);
  return {
    ...offer,
    talent_name: names.get(offer.talent_user_id) ?? 'Unknown talent',
    events,
    profile_id: null,
    category_id: null,
    profile_photo_url: null,
    list_price: null,
    list_currency: null,
    talent_bids_used: talentMoves,
    business_offers_used: businessMoves,
    talent_bids_remaining: Math.max(0, MAX_TALENT_BIDS - talentMoves),
    business_offers_remaining: Math.max(0, MAX_BUSINESS_OFFERS - businessMoves),
    negotiation_started: businessMoves > 0 || offer.opened_by === 'business' || offer.opened_by === 'admin',
  };
}

// ─── Business-portal auth wrappers (ownership-checked) ─────────────────────
// The core business* actions above are ownership-agnostic so the SquadHub
// admin proxy (actor.source='squadhub') can drive them for ANY card. The
// business PORTAL must only touch its own cards, so these wrappers assert
// ownership first — mirroring listMySubscriptionCards' business_user_id (with
// an email fallback for cards whose id wasn't backfilled at ingest).

async function assertBusinessOwnsCard(businessUserId: string, cardId: string): Promise<void> {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('business_user_id, business_email, card_type')
    .eq('id', cardId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  const cardType = (card as any)?.card_type as string | undefined;
  if (!card || !cardType || !OFFERABLE_CARD_TYPES.has(cardType)) throw new AppError(404, 'Card not found');
  const ownerId = (card as any).business_user_id as string | null;
  if (ownerId === businessUserId) return;
  if (ownerId == null) {
    const { data: bu } = await supabaseAdmin
      .from('business_users')
      .select('contact_email')
      .eq('id', businessUserId)
      .maybeSingle();
    const email = (bu?.contact_email as string | null) ?? null;
    const cardEmail = (card as any).business_email as string | null;
    if (email && cardEmail && email.toLowerCase() === cardEmail.toLowerCase()) return;
  }
  throw new AppError(404, 'Card not found');
}

async function assertBusinessOwnsOffer(businessUserId: string, cardId: string, offerId: string): Promise<void> {
  const offer = await getOffer(offerId);
  if (offer.card_id !== cardId) throw new AppError(404, 'Offer not found');
  await assertBusinessOwnsCard(businessUserId, cardId);
}

export async function listOffersForBusinessCard(businessUserId: string, cardId: string) {
  await assertBusinessOwnsCard(businessUserId, cardId);
  return listOffersForCard(cardId);
}

export async function businessCounterOffer(
  businessUserId: string,
  cardId: string,
  offerId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
) {
  await assertBusinessOwnsOffer(businessUserId, cardId, offerId);
  return businessCounter(offerId, input, { type: 'business', id: businessUserId });
}

export async function businessAcceptOffer(
  businessUserId: string,
  cardId: string,
  offerId: string,
  input: { note?: string },
) {
  await assertBusinessOwnsOffer(businessUserId, cardId, offerId);
  return businessAccept(offerId, input, { type: 'business', id: businessUserId });
}

export async function businessDeclineOffer(
  businessUserId: string,
  cardId: string,
  offerId: string,
  input: { note?: string },
) {
  await assertBusinessOwnsOffer(businessUserId, cardId, offerId);
  return businessDecline(offerId, input, { type: 'business', id: businessUserId });
}

export async function businessSendOfferForCard(
  businessUserId: string,
  cardId: string,
  recipientId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
) {
  await assertBusinessOwnsCard(businessUserId, cardId);
  return businessSendOffer(cardId, recipientId, input, { type: 'business', id: businessUserId });
}

// ─── Talent inbox: all bids / offers across cards ──────────────────────────

export interface TalentOfferListItem extends AssignmentOfferRow {
  card_type: string | null;
  brand_name: string | null;
  card_title: string | null;
  events: unknown[];
}

/** Talent Bidding tab — open + recent terminal offers for this talent. */
export async function listOffersForTalent(talentUserId: string): Promise<TalentOfferListItem[]> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('talent_user_id', talentUserId)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw new AppError(500, error.message);
  const offers = (data ?? []) as unknown as AssignmentOfferRow[];
  if (offers.length === 0) return [];

  const cardIds = [...new Set(offers.map((o) => o.card_id))];
  const { data: cards } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, card_type, content')
    .in('id', cardIds);
  const cardById = new Map<string, any>();
  for (const c of cards ?? []) cardById.set((c as any).id, c);

  const out: TalentOfferListItem[] = [];
  for (const o of offers) {
    const card = cardById.get(o.card_id);
    const content = (card?.content ?? {}) as Record<string, unknown>;
    const events = await listOfferEvents(o.id);
    out.push({
      ...o,
      card_type: (card?.card_type as string) ?? null,
      brand_name: (typeof content.brand_name === 'string' ? content.brand_name : null),
      card_title: cardOfferTitle(content, (card?.card_type as string) || 'subscription'),
      events,
    });
  }
  return out;
}

// ─── SquadHub admin: live-read snapshot + signed-proxy actions ──────────────
// The SquadHub admin reads offers LIVE (never a mirror) and drives the same
// business-side transitions via a signed proxy, with actor.source='squadhub'
// (suppresses the dormant outbox echo). The talent-facing notifications still
// fire, so the admin acting on the business's behalf reaches the talent.

export async function getCardOffersSnapshotByExternalId(externalId: string) {
  const { data: card, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, card_type')
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  const cardType = (card as any)?.card_type as string | undefined;
  if (!card || !cardType || !OFFERABLE_CARD_TYPES.has(cardType)) {
    throw new AppError(404, 'Card not found');
  }
  const offers = await listOffersForCard((card as any).id as string);
  return { external_id: externalId, card_id: (card as any).id as string, offers };
}

export async function adminOfferAction(input: {
  op: 'counter' | 'accept' | 'decline' | 'send';
  offer_id?: string;
  recipient_id?: string;
  external_id?: string;
  amount?: Record<string, unknown>;
  terms?: Record<string, unknown>;
  note?: string;
  actor?: { id?: string | null } | null;
}): Promise<AssignmentOfferRow> {
  const actor: JobsActor = { type: 'admin', id: input.actor?.id ?? null, source: 'squadhub' };
  if (input.op === 'send') {
    if (!input.recipient_id) throw new AppError(400, 'recipient_id is required to send an offer');
    if (!input.amount) throw new AppError(400, 'A figure is required to send an offer');
    // Resolve card from external_id (SquadHub card id) when provided.
    let cardId: string | null = null;
    if (input.external_id) {
      const snap = await getCardOffersSnapshotByExternalId(input.external_id).catch(() => null);
      // Prefer lookup by external_id → internal id
      const { data: card } = await supabaseAdmin
        .from('subscription_cards')
        .select('id')
        .eq('external_id', input.external_id)
        .maybeSingle();
      cardId = (card as any)?.id ?? snap?.card_id ?? null;
    }
    if (!cardId) {
      // Fall back: recipient row carries card_id
      const { data: rec } = await supabaseAdmin
        .from('subscription_card_recipients')
        .select('card_id')
        .eq('id', input.recipient_id)
        .maybeSingle();
      cardId = (rec as any)?.card_id ?? null;
    }
    if (!cardId) throw new AppError(404, 'Card not found for send');
    return businessSendOffer(cardId, input.recipient_id, {
      amount: input.amount,
      terms: input.terms,
      note: input.note,
    }, actor);
  }
  if (!input.offer_id) throw new AppError(400, 'offer_id is required');
  if (input.op === 'counter') {
    if (!input.amount) throw new AppError(400, 'A figure is required to counter');
    return businessCounter(input.offer_id, { amount: input.amount, terms: input.terms, note: input.note }, actor);
  }
  if (input.op === 'accept') return businessAccept(input.offer_id, { note: input.note }, actor);
  if (input.op === 'decline') return businessDecline(input.offer_id, { note: input.note }, actor);
  throw new AppError(400, `Unknown op: ${input.op}`);
}
