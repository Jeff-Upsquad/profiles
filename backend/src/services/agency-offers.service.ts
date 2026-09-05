import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { offerMetadataForCard } from '../lib/assignment-pricing.js';

/**
 * Agency bidding on requirement cards — mirror of assignment-offers.service
 * but keyed to agency_card_recipients + agency_users. Status machine mirrors
 * talent: pending_business (agency bid awaiting business) ⇄ pending_talent
 * (business counter awaiting agency); accepted/declined/withdrawn/expired are
 * terminal.
 */

const MAX_AGENCY_BIDS = 3;

interface Amount {
  amount?: number;
  currency?: string;
  period?: string;
  [key: string]: unknown;
}

export interface AgencyOfferRow {
  id: string;
  card_id: string;
  recipient_id: string;
  agency_user_id: string;
  pricing_mode: string;
  current_amount: Record<string, unknown> | null;
  current_terms: Record<string, unknown> | null;
  status: string;
  opened_by: string;
  last_actor_side: string | null;
  created_at: string;
  updated_at: string;
}

const OFFER_FIELDS =
  'id, card_id, recipient_id, agency_user_id, pricing_mode, current_amount, current_terms, status, opened_by, last_actor_side, created_at, updated_at';

async function loadAgencyRecipient(agencyUserId: string, recipientId: string) {
  const { data, error } = await supabaseAdmin
    .from('agency_card_recipients')
    .select(
      'id, agency_user_id, subscription_cards!inner(id, external_id, content, card_type)',
    )
    .eq('id', recipientId)
    .eq('agency_user_id', agencyUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Card not found');

  const card = (data as any).subscription_cards as {
    id: string;
    external_id: string | null;
    content: Record<string, unknown> | null;
    card_type: string | null;
  } | null;
  const content = (card?.content ?? {}) as Record<string, unknown>;
  const cardType = (card?.card_type ?? 'subscription') as string;
  const ad = (content.assignment_details ?? {}) as Record<string, unknown>;
  const pricingMode =
    cardType === 'assignment' && ad.pricing_mode === 'unpriced' ? 'unpriced' : 'priced';
  return {
    cardId: card?.id as string,
    externalId: card?.external_id ?? null,
    content,
    cardType,
    pricingMode,
  };
}

async function getOpenOfferForRecipient(recipientId: string) {
  const { data } = await supabaseAdmin
    .from('agency_card_offers')
    .select(OFFER_FIELDS)
    .eq('recipient_id', recipientId)
    .in('status', ['pending_business', 'pending_talent', 'accepted'])
    .maybeSingle();
  return (data as AgencyOfferRow | null) ?? null;
}

async function getLatestOfferForRecipient(recipientId: string) {
  const { data } = await supabaseAdmin
    .from('agency_card_offers')
    .select(OFFER_FIELDS)
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AgencyOfferRow | null) ?? null;
}

async function countAgencyMoves(cardId: string, agencyUserId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('agency_card_offer_events')
    .select('id', { count: 'exact', head: true })
    .eq('actor_type', 'agency')
    .eq('actor_id', agencyUserId)
    .in('action', ['submitted', 'countered']);
  return count ?? 0;
}

async function logEvent(input: {
  offerId: string;
  actorType: string;
  actorId?: string | null;
  action: string;
  amount?: Record<string, unknown> | null;
  note?: string | null;
}) {
  await supabaseAdmin.from('agency_card_offer_events').insert({
    offer_id: input.offerId,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    amount: input.amount ?? null,
    note: input.note ?? null,
  });
}

export async function agencySubmitOrCounter(
  agencyUserId: string,
  recipientId: string,
  input: { amount: Record<string, unknown>; terms?: Record<string, unknown>; note?: string },
): Promise<AgencyOfferRow> {
  const { cardId, content, cardType, pricingMode } = await loadAgencyRecipient(
    agencyUserId,
    recipientId,
  );
  const metadata = offerMetadataForCard(content, cardType);
  const amount: Amount = {
    ...(input.amount ?? {}),
    ...metadata,
  };

  const moves = await countAgencyMoves(cardId, agencyUserId);
  if (moves >= MAX_AGENCY_BIDS) {
    throw new AppError(
      409,
      `You have used all ${MAX_AGENCY_BIDS} bids on this card. You can still accept or decline a business offer.`,
    );
  }

  const existing = await getOpenOfferForRecipient(recipientId);
  if (existing?.status === 'accepted') throw new AppError(409, 'This offer has already been accepted');

  let offer: AgencyOfferRow;
  let action: 'submitted' | 'countered';
  const isFirstBid = !existing;

  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from('agency_card_offers')
      .insert({
        card_id: cardId,
        recipient_id: recipientId,
        agency_user_id: agencyUserId,
        pricing_mode: pricingMode,
        current_amount: amount,
        current_terms: input.terms ?? null,
        status: 'pending_business',
        opened_by: 'agency',
        last_actor_side: 'agency',
      })
      .select(OFFER_FIELDS)
      .maybeSingle();
    if (error) {
      if ((error as any).code === '23505') throw new AppError(409, 'You already have an open bid on this card');
      throw new AppError(500, error.message);
    }
    offer = data as AgencyOfferRow;
    action = 'submitted';
  } else {
    // Revise own pending bid, or counter a business offer when it's our turn.
    if (existing.status === 'pending_business') {
      // revise own bid
    } else if (existing.status === 'pending_talent') {
      // counter the business offer
    } else {
      throw new AppError(409, 'It is not your turn to bid');
    }
    const { data, error } = await supabaseAdmin
      .from('agency_card_offers')
      .update({
        current_amount: amount,
        current_terms: input.terms ?? existing.current_terms,
        status: 'pending_business',
        last_actor_side: 'agency',
      })
      .eq('id', existing.id)
      .select(OFFER_FIELDS)
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    offer = data as AgencyOfferRow;
    action = isFirstBid ? 'submitted' : 'countered';
  }

  await logEvent({
    offerId: offer.id,
    actorType: 'agency',
    actorId: agencyUserId,
    action,
    amount,
    note: input.note ?? null,
  });

  return offer;
}

export async function agencyRespondToOffer(
  agencyUserId: string,
  recipientId: string,
  input: { action: 'accept' | 'decline' | 'withdraw'; note?: string },
): Promise<AgencyOfferRow> {
  await loadAgencyRecipient(agencyUserId, recipientId);
  const offer = await getOpenOfferForRecipient(recipientId);
  if (!offer || offer.agency_user_id !== agencyUserId) {
    throw new AppError(404, 'No open offer to respond to');
  }

  if (input.action === 'withdraw') {
    if (offer.status !== 'pending_business') {
      throw new AppError(409, 'You can only withdraw an offer that is awaiting the business');
    }
    const { data, error } = await supabaseAdmin
      .from('agency_card_offers')
      .update({ status: 'withdrawn', responded_at: new Date().toISOString() })
      .eq('id', offer.id)
      .select(OFFER_FIELDS)
      .maybeSingle();
    if (error) throw new AppError(500, error.message);
    await logEvent({ offerId: offer.id, actorType: 'agency', actorId: agencyUserId, action: 'withdrawn', note: input.note ?? null });
    return data as AgencyOfferRow;
  }

  if (offer.status !== 'pending_talent') {
    throw new AppError(409, 'There is no counter-offer awaiting your response');
  }

  const terminal = input.action === 'accept' ? 'accepted' : 'declined';
  const { data, error } = await supabaseAdmin
    .from('agency_card_offers')
    .update({ status: terminal, responded_at: new Date().toISOString() })
    .eq('id', offer.id)
    .select(OFFER_FIELDS)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  await logEvent({
    offerId: offer.id,
    actorType: 'agency',
    actorId: agencyUserId,
    action: terminal,
    amount: offer.current_amount,
    note: input.note ?? null,
  });
  return data as AgencyOfferRow;
}

export async function listAllAgencyOffers(agencyUserId: string): Promise<Array<AgencyOfferRow & { card_content: Record<string, unknown> | null; card_type: string | null; card_external_id: string | null; card_published_at: string | null; card_expires_at: string | null; card_status: string | null; events: Array<{ id: string; actor_type: string; action: string; amount: Record<string, unknown> | null; note: string | null; created_at: string }> }>> {
  const { data: offers, error } = await supabaseAdmin
    .from('agency_card_offers')
    .select('*, subscription_cards!inner(id, external_id, content, card_type, status, published_at, expires_at)')
    .eq('agency_user_id', agencyUserId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  if (!offers || offers.length === 0) return [];

  const offerIds = (offers as any[]).map((o: any) => o.id);
  const { data: allEvents } = await supabaseAdmin
    .from('agency_card_offer_events')
    .select('id, offer_id, actor_type, action, amount, note, created_at')
    .in('offer_id', offerIds)
    .order('created_at', { ascending: true });
  const eventsByOffer = new Map<string, any[]>();
  for (const e of (allEvents ?? []) as any[]) {
    const arr = eventsByOffer.get(e.offer_id) ?? [];
    arr.push(e);
    eventsByOffer.set(e.offer_id, arr);
  }

  return (offers as any[]).map((o: any) => {
    const card = o.subscription_cards as any;
    return {
      id: o.id,
      card_id: o.card_id,
      recipient_id: o.recipient_id,
      agency_user_id: o.agency_user_id,
      pricing_mode: o.pricing_mode,
      current_amount: o.current_amount,
      current_terms: o.current_terms,
      status: o.status,
      opened_by: o.opened_by,
      last_actor_side: o.last_actor_side,
      created_at: o.created_at,
      updated_at: o.updated_at,
      card_content: card?.content ?? null,
      card_type: card?.card_type ?? null,
      card_external_id: card?.external_id ?? null,
      card_published_at: card?.published_at ?? null,
      card_expires_at: card?.expires_at ?? null,
      card_status: card?.status ?? null,
      events: eventsByOffer.get(o.id) ?? [],
    };
  });
}

export async function getOfferForAgencyRecipient(agencyUserId: string, recipientId: string) {
  await loadAgencyRecipient(agencyUserId, recipientId);
  const offer = (await getOpenOfferForRecipient(recipientId)) ?? (await getLatestOfferForRecipient(recipientId));
  if (!offer) {
    return { offer: null, events: [], max_agency_bids: MAX_AGENCY_BIDS, agency_bids_remaining: MAX_AGENCY_BIDS };
  }
  const { data: events } = await supabaseAdmin
    .from('agency_card_offer_events')
    .select('id, actor_type, action, amount, note, created_at')
    .eq('offer_id', offer.id)
    .order('created_at', { ascending: true });
  const { cardId } = await loadAgencyRecipient(agencyUserId, recipientId);
  const moves = await countAgencyMoves(cardId, agencyUserId);
  return {
    offer,
    events: events ?? [],
    max_agency_bids: MAX_AGENCY_BIDS,
    agency_bids_used: moves,
    agency_bids_remaining: Math.max(0, MAX_AGENCY_BIDS - moves),
  };
}
