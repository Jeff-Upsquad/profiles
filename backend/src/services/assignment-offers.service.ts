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
import { adminSelectRecipient } from './subscription.service.js';

/**
 * Assignment offer / counter-offer engine (00110).
 *
 * Recipient-scoped negotiation on assignment cards (card_type='assignment'),
 * UNLIMITED-round — the offer bounces between the two turn states until someone
 * accepts / declines. Modeled on the jobs offers.service.ts state machine but
 * (a) keyed on subscription_card_recipients (not job_candidates), (b) talent-
 * opened, and (c) with no one-shot final-counter latch.
 *
 *   (talent submit / counter)   -> pending_business
 *   (business / admin counter)  -> pending_talent
 *   (either side accept)        -> accepted   [terminal -> recipient selected]
 *   (decline / withdraw / expire) -> declined | withdrawn | expired [terminal]
 *
 * PRICED cards: the standing card price is accepted/declined via the existing
 * subscription respond() — only a COUNTER opens a row here.
 * UNPRICED cards: the talent's SUBMIT opens the row.
 *
 * An accepted offer marks the recipient 'accepted' (feeding the existing
 * select -> admin-finalize spine); a BUSINESS accept additionally selects that
 * talent ("accept and select"). One live offer per recipient (unique index).
 * Profiles is canonical; SquadHub reads it live + drives business-side
 * transitions via signed proxy (actor.source='squadhub' suppresses the echo).
 */

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

function assignmentTitle(content: Record<string, unknown>): string {
  if (typeof content.title === 'string' && content.title.trim()) return content.title.trim();
  if (typeof content.brand_name === 'string' && content.brand_name.trim()) return content.brand_name.trim();
  return 'the assignment';
}

function actorSide(actor: JobsActor): 'talent' | 'business' | 'admin' {
  if (actor.type === 'talent') return 'talent';
  if (actor.type === 'admin') return 'admin';
  return 'business';
}

interface AssignmentCardRefs {
  cardId: string;
  externalId: string | null;
  businessUserId: string | null;
  content: Record<string, unknown>;
  pricingMode: 'priced' | 'unpriced';
}

async function getAssignmentCardRefs(cardId: string): Promise<AssignmentCardRefs> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, business_user_id, content, card_type')
    .eq('id', cardId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data || (data as any).card_type !== 'assignment') {
    throw new AppError(404, 'Assignment card not found');
  }
  // On Profiles the assignment details ride inside content JSONB (SquadHub sends
  // content.assignment_details) — there is NO assignment_details column here.
  const content = ((data as any).content ?? {}) as Record<string, unknown>;
  const ad = (content.assignment_details ?? {}) as Record<string, unknown>;
  return {
    cardId,
    externalId: ((data as any).external_id as string | null) ?? null,
    businessUserId: ((data as any).business_user_id as string | null) ?? null,
    content,
    pricingMode: ad.pricing_mode === 'unpriced' ? 'unpriced' : 'priced',
  };
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

/** Load + validate a recipient row owned by the talent on a LIVE assignment card. */
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
  if (!data) throw new AppError(404, 'Assignment not found');
  const card = (data as any).subscription_cards as { status?: string; card_type?: string } | undefined;
  if (card?.card_type !== 'assignment') throw new AppError(400, 'Not an assignment card');
  if (card?.status !== 'active') throw new AppError(409, 'This assignment is no longer available');
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
 * Terminal-accept handler. Flips the recipient to 'accepted' (feeding the
 * existing select spine) + notifies. A BUSINESS/ADMIN accept additionally
 * selects the talent (fills the card) — the "accept and select" flow.
 */
async function onOfferAccepted(
  offer: AssignmentOfferRow,
  refs: AssignmentCardRefs,
  actor: JobsActor,
  selectNow: boolean,
): Promise<void> {
  // Mark the recipient accepted at the agreed figure (only if still pending —
  // never clobber an already-terminal recipient row).
  await supabaseAdmin
    .from('subscription_card_recipients')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', offer.recipient_id)
    .eq('status', 'pending')
    .is('cancelled_at', null);

  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_accepted',
    'Offer accepted',
    `Your offer for ${assignmentTitle(refs.content)} was accepted.`,
    '/talent/assignments',
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Offer accepted 🎉',
    body: `Your offer for ${assignmentTitle(refs.content)} was accepted.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] accept push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_accepted', offer.talent_user_id, {
    position_title: assignmentTitle(refs.content),
    business_name: contentBusinessName(refs.content),
  }).catch((err) => console.error('[assignment-offers] accept WA threw', err));

  // When the TALENT accepted the business's counter, ping the business.
  if (actor.type === 'talent' && refs.businessUserId) {
    const names = await getTalentNames([offer.talent_user_id]);
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: 'assignment_offer_accepted',
      title: `${names.get(offer.talent_user_id) ?? 'A talent'} accepted your counter-offer for ${assignmentTitle(refs.content)}`,
      body: null,
      ref: { card_id: offer.card_id, offer_id: offer.id, recipient_id: offer.recipient_id, route: 'assignments' },
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

  if (selectNow) {
    try {
      await adminSelectRecipient(offer.card_id, offer.recipient_id);
      await expireOtherOpenOffers(offer.card_id, offer.id);
    } catch (err) {
      // Card already filled / selection guard — leave the offer accepted; the
      // admin can finalize manually. The accept itself must never fail here.
      console.error('[assignment-offers] select-on-accept failed', err);
    }
  }
}

async function notifyBusinessOfTalentTerminal(
  offer: AssignmentOfferRow,
  refs: AssignmentCardRefs,
  kind: 'declined' | 'withdrawn',
): Promise<void> {
  if (refs.businessUserId) {
    const names = await getTalentNames([offer.talent_user_id]);
    const talentName = names.get(offer.talent_user_id) ?? 'A talent';
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: `assignment_offer_${kind}`,
      title:
        kind === 'declined'
          ? `${talentName} declined your counter-offer for ${assignmentTitle(refs.content)}`
          : `${talentName} withdrew their offer for ${assignmentTitle(refs.content)}`,
      body: null,
      ref: { card_id: offer.card_id, offer_id: offer.id, recipient_id: offer.recipient_id, route: 'assignments' },
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

  let offer: AssignmentOfferRow;
  let action: 'submitted' | 'countered';

  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('assignment_offers')
      .insert({
        card_id: ctx.cardId,
        recipient_id: recipientId,
        talent_user_id: talentUserId,
        business_user_id: refs.businessUserId,
        pricing_mode: refs.pricingMode,
        current_amount: input.amount,
        current_terms: input.terms ?? null,
        status: 'pending_business',
        opened_by: 'talent',
        last_actor_side: 'talent',
      })
      .select(OFFER_FIELDS)
      .maybeSingle();
    if (error) {
      if ((error as any).code === '23505') {
        throw new AppError(409, 'You already have an open offer on this assignment');
      }
      throw new AppError(500, error.message);
    }
    offer = data as unknown as AssignmentOfferRow;
    action = 'submitted';
  } else if (existing.status === 'accepted') {
    throw new AppError(409, 'This offer has already been accepted');
  } else {
    offer = await transition(existing, 'pending_business', actor, {
      amount: input.amount,
      terms: input.terms ?? existing.current_terms,
    });
    action = 'countered';
  }

  await logEvent({ offerId: offer.id, actor, action, amount: input.amount, note: input.note ?? null });

  if (refs.businessUserId) {
    const names = await getTalentNames([talentUserId]);
    const talentName = names.get(talentUserId) ?? 'A talent';
    await createBusinessNotification({
      businessUserId: refs.businessUserId,
      type: action === 'submitted' ? 'assignment_offer_submitted' : 'assignment_offer_countered',
      title:
        action === 'submitted'
          ? `${talentName} submitted an offer for ${assignmentTitle(refs.content)}`
          : `${talentName} sent a counter-offer for ${assignmentTitle(refs.content)}`,
      body: input.note ?? null,
      ref: { card_id: ctx.cardId, offer_id: offer.id, recipient_id: recipientId, route: 'assignments' },
    });
  }

  await emitCardEvent(action === 'submitted' ? 'assignment_offer_submitted' : 'assignment_offer_countered', {
    external_id: refs.externalId,
    recipient_id: recipientId,
    offer_id: offer.id,
    actor,
    data: { amount: input.amount, terms: input.terms ?? null, note: input.note ?? null },
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
  await loadTalentRecipient(talentUserId, recipientId);
  const offer = (await getOpenOfferForRecipient(recipientId)) ?? (await getLatestOfferForRecipient(recipientId));
  if (!offer) return { offer: null, events: [] as unknown[] };
  const events = await listOfferEvents(offer.id);
  return { offer, events };
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

  const updated = await transition(offer, 'pending_talent', actor, {
    amount: input.amount,
    terms: input.terms ?? offer.current_terms,
  });
  await logEvent({ offerId, actor, action: 'countered', amount: input.amount, note: input.note ?? null });

  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_countered',
    'Counter-offer received',
    `${contentBusinessName(refs.content)} sent a counter-offer for ${assignmentTitle(refs.content)}.`,
    '/talent/assignments',
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Counter-offer received',
    body: `${contentBusinessName(refs.content)} countered your offer for ${assignmentTitle(refs.content)}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] counter push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_countered', offer.talent_user_id, {
    position_title: assignmentTitle(refs.content),
    business_name: contentBusinessName(refs.content),
  }).catch((err) => console.error('[assignment-offers] counter WA threw', err));

  if (shouldEmitOutbox(actor)) {
    await emitCardEvent('assignment_offer_countered_by_business', {
      external_id: refs.externalId,
      recipient_id: offer.recipient_id,
      offer_id: offerId,
      actor,
      data: { amount: input.amount, terms: input.terms ?? null },
    });
  }

  return updated;
}

/** Business/admin accepts the talent's current figure — accept + select. */
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
  await onOfferAccepted(updated, refs, actor, true);
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

  notifyTalentsInApp(
    [offer.talent_user_id],
    'assignment_offer_declined',
    'Offer declined',
    `${contentBusinessName(refs.content)} declined your offer for ${assignmentTitle(refs.content)}.`,
    '/talent/assignments',
  ).catch(() => {});
  notifyAssignmentEvent([offer.talent_user_id], {
    title: 'Offer declined',
    body: `${contentBusinessName(refs.content)} declined your offer for ${assignmentTitle(refs.content)}.`,
    cardId: offer.card_id,
  }).catch((err) => console.error('[assignment-offers] decline push threw', err));
  fireJobsCrmEvent('talent_assignment_offer_declined', offer.talent_user_id, {
    position_title: assignmentTitle(refs.content),
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
}

/** All offers on a card + their threads (business console / admin live view). */
export async function listOffersForCard(cardId: string): Promise<AssignmentOfferWithThread[]> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select(OFFER_FIELDS)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  const offers = (data ?? []) as unknown as AssignmentOfferRow[];
  if (offers.length === 0) return [];

  const names = await getTalentNames(offers.map((o) => o.talent_user_id));
  const withThreads: AssignmentOfferWithThread[] = [];
  for (const o of offers) {
    const events = await listOfferEvents(o.id);
    withThreads.push({ ...o, talent_name: names.get(o.talent_user_id) ?? 'Unknown talent', events });
  }
  return withThreads;
}

export async function getOfferWithThread(offerId: string): Promise<AssignmentOfferWithThread> {
  const offer = await getOffer(offerId);
  const names = await getTalentNames([offer.talent_user_id]);
  const events = await listOfferEvents(offerId);
  return { ...offer, talent_name: names.get(offer.talent_user_id) ?? 'Unknown talent', events };
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
  if (!card || (card as any).card_type !== 'assignment') throw new AppError(404, 'Assignment card not found');
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
  throw new AppError(404, 'Assignment card not found');
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
  if (!card || (card as any).card_type !== 'assignment') {
    throw new AppError(404, 'Assignment card not found');
  }
  const offers = await listOffersForCard((card as any).id as string);
  return { external_id: externalId, card_id: (card as any).id as string, offers };
}

export async function adminOfferAction(input: {
  op: 'counter' | 'accept' | 'decline';
  offer_id: string;
  amount?: Record<string, unknown>;
  terms?: Record<string, unknown>;
  note?: string;
  actor?: { id?: string | null } | null;
}): Promise<AssignmentOfferRow> {
  const actor: JobsActor = { type: 'admin', id: input.actor?.id ?? null, source: 'squadhub' };
  if (input.op === 'counter') {
    if (!input.amount) throw new AppError(400, 'A figure is required to counter');
    return businessCounter(input.offer_id, { amount: input.amount, terms: input.terms, note: input.note }, actor);
  }
  if (input.op === 'accept') return businessAccept(input.offer_id, { note: input.note }, actor);
  if (input.op === 'decline') return businessDecline(input.offer_id, { note: input.note }, actor);
  throw new AppError(400, `Unknown op: ${input.op}`);
}
