import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as businessService from './business.service.js';
import * as conversations from './conversations.service.js';
import type { ConversationActor } from './conversations.service.js';
import type { IntroConversationDetail, IntroMessage } from '../../../shared/src/types/conversations.js';

/**
 * SquadHub Client View — Leads/admin users acting as the business on a card.
 *
 * Review / select reuse the same business-portal primitives so funnel state
 * stays identical to what the customer would do in SquadHire. Intro rooms are
 * opened as UpSquad staff (not as the business user) so messages show the
 * acting person's name.
 */

export interface ClientViewActorInput {
  email?: string | null;
  name?: string | null;
  id?: string | null;
}

interface CardRow {
  id: string;
  external_id: string | null;
  business_user_id: string | null;
  group_id: string | null;
}

async function loadCardByExternalId(externalId: string): Promise<CardRow> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id, external_id, business_user_id, group_id')
    .eq('external_id', externalId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Card not found');
  return data as CardRow;
}

async function resolveGroupCardIds(card: CardRow): Promise<string[]> {
  if (!card.group_id) return [card.id];
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select('id')
    .eq('group_id', card.group_id);
  if (error) throw new AppError(500, error.message);
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  return ids.length ? ids : [card.id];
}

async function findRecipient(card: CardRow, talentUserId: string) {
  const groupIds = await resolveGroupCardIds(card);
  const { data, error } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, cancelled_at, business_review_status, selected_at')
    .eq('talent_user_id', talentUserId)
    .in('card_id', groupIds)
    .is('cancelled_at', null)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Recipient not found');
  return data as {
    id: string;
    card_id: string;
    talent_user_id: string;
    status: string;
    cancelled_at: string | null;
    business_review_status: string | null;
    selected_at: string | null;
  };
}

function requireBusinessUserId(card: CardRow): string {
  if (!card.business_user_id) {
    throw new AppError(400, 'This card is not linked to a business yet.');
  }
  return card.business_user_id;
}

function normalizeEmail(email?: string | null): string | null {
  const v = (email ?? '').trim().toLowerCase();
  return v.includes('@') ? v : null;
}

async function resolveStaffByEmail(email: string | null): Promise<{ id: string; name: string; email: string } | null> {
  if (!email) return null;
  const { data, error } = await supabaseAdmin
    .from('staff_users')
    .select('id, name, email, is_active')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data || (data as { is_active?: boolean }).is_active === false) return null;
  return {
    id: (data as { id: string }).id,
    name: (data as { name: string }).name,
    email: (data as { email: string }).email,
  };
}

async function actorForClientView(input?: ClientViewActorInput): Promise<{
  actor: ConversationActor;
  displayName: string;
}> {
  const email = normalizeEmail(input?.email);
  const name = (input?.name || '').trim() || email || 'UpSquad';
  const staff = await resolveStaffByEmail(email);
  if (staff) {
    return {
      actor: {
        type: 'staff',
        id: staff.id,
        name: name || staff.name,
        email: staff.email,
        grants: { conversations: 'full' },
      },
      displayName: name || staff.name,
    };
  }
  // No staff row — still send as admin so the room can open. The display name
  // is stamped on each message so the talent sees this person, not the business.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return {
    actor: {
      type: 'admin',
      id: input?.id && uuidRe.test(input.id) ? input.id : '00000000-0000-0000-0000-000000000001',
      name,
      email: email ?? undefined,
    },
    displayName: name,
  };
}

export async function reviewRecipient(input: {
  external_id: string;
  talent_user_id: string;
  action: 'shortlist' | 'reject' | 'unshortlist';
}) {
  const card = await loadCardByExternalId(input.external_id);
  const recipient = await findRecipient(card, input.talent_user_id);
  const businessUserId = requireBusinessUserId(card);
  await businessService.reviewCardRecipient(
    businessUserId,
    recipient.card_id,
    recipient.id,
    input.action,
  );
  return {
    recipient_id: recipient.id,
    talent_user_id: recipient.talent_user_id,
    action: input.action,
  };
}

export async function selectRecipient(input: { external_id: string; talent_user_id: string }) {
  const card = await loadCardByExternalId(input.external_id);
  const recipient = await findRecipient(card, input.talent_user_id);
  const businessUserId = requireBusinessUserId(card);
  const result = await businessService.businessSelectRecipient(
    businessUserId,
    recipient.card_id,
    recipient.id,
  );
  return {
    recipient_id: recipient.id,
    talent_user_id: recipient.talent_user_id,
    ...result,
  };
}

export async function openConversation(input: {
  external_id: string;
  talent_user_id: string;
  actor?: ClientViewActorInput;
}): Promise<{ conversation: IntroConversationDetail; display_name: string }> {
  const card = await loadCardByExternalId(input.external_id);
  await findRecipient(card, input.talent_user_id);
  const { actor, displayName } = await actorForClientView(input.actor);
  const conversation = await conversations.createOrGetConversation(actor, {
    cardId: card.id,
    talentUserId: input.talent_user_id,
  });
  return { conversation, display_name: displayName };
}

export async function listConversationMessages(input: {
  conversation_id: string;
  after?: string;
  limit?: number;
  actor?: ClientViewActorInput;
}): Promise<{ conversation: IntroConversationDetail; messages: IntroMessage[]; display_name: string }> {
  const { actor, displayName } = await actorForClientView(input.actor);
  const conversation = await conversations.getConversation(actor, input.conversation_id);
  const messages = await conversations.listMessages(actor, input.conversation_id, {
    after: input.after,
    limit: input.limit ?? 50,
  });
  await conversations.markRead(actor, input.conversation_id);
  return { conversation, messages, display_name: displayName };
}

export async function sendConversationMessage(input: {
  conversation_id: string;
  body: string;
  actor?: ClientViewActorInput;
}): Promise<{ message: IntroMessage; display_name: string }> {
  const { actor, displayName } = await actorForClientView(input.actor);
  const message = await conversations.sendMessage(actor, input.conversation_id, input.body, {
    displayName,
  });
  return { message, display_name: displayName };
}
