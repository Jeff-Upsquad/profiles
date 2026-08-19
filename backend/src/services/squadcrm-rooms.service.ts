import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as conversations from './conversations.service.js';
import type { ConversationActor } from './conversations.service.js';
import type {
  IntroConversationDetail,
  IntroConversationSummary,
  IntroMessage,
} from '../../../shared/src/types/conversations.js';

/**
 * Squad CRM chat rooms — the salesperson's view of SquadHire intro rooms.
 *
 * A room belongs to a requirement card, and every card carries the CRM people
 * who own it (subscription_cards.assignee_id / collaborator_ids, over in the
 * Hub). CRM is the side that knows that ownership, so it does the scoping and
 * sends the card ids it may see; this service never widens beyond them.
 *
 * Rooms are not copied into CRM — same rule the Requirement Cards module
 * follows. SquadHire stays canonical for the thread; CRM reads and writes it
 * over this channel, and a message it sends is an ordinary intro message that
 * the business and the talent see in their own apps.
 */

export interface SquadcrmActorInput {
  /** Hub user id — the read-tracking key when this person has no staff row. */
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

/** One card CRM is asking about, with the CRM owner it wants on the room. */
export interface SquadcrmCardInput {
  external_id: string;
  salesperson_email?: string | null;
  salesperson_name?: string | null;
}

interface CardRow {
  id: string;
  external_id: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEmail(email?: string | null): string | null {
  const v = (email ?? '').trim().toLowerCase();
  return v.includes('@') ? v : null;
}

async function resolveActiveStaffByEmail(
  email: string | null,
): Promise<{ id: string; name: string; email: string } | null> {
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

/**
 * A CRM user, as an intro-room actor.
 *
 * Always 'staff' with full grants: CRM has already decided this person owns
 * the card, and typing 'staff' is what gives them a read cursor
 * (intro_conversation_members has no FK, so the id may be a Hub user id for
 * someone who has never had a SquadHire staff account). When they DO have a
 * staff row we prefer it, so the room shows their real SquadHire identity and
 * they can be adopted as its salesperson.
 */
async function actorFor(input?: SquadcrmActorInput): Promise<{
  actor: ConversationActor;
  displayName: string;
  staffId: string | null;
}> {
  const email = normalizeEmail(input?.email);
  const name = (input?.name || '').trim() || email || 'UpSquad';
  const staff = await resolveActiveStaffByEmail(email);
  const id = staff?.id
    ?? (input?.id && UUID_RE.test(input.id) ? input.id : '00000000-0000-0000-0000-000000000001');
  return {
    actor: {
      type: 'staff',
      id,
      name,
      email: email ?? undefined,
      grants: { conversations: 'full' },
    },
    displayName: name,
    staffId: staff?.id ?? null,
  };
}

/** Profiles card ids for the external (Hub) ids CRM says it owns. */
async function resolveCards(externalIds: string[]): Promise<CardRow[]> {
  const unique = [...new Set(externalIds.filter(Boolean))];
  if (!unique.length) return [];
  const out: CardRow[] = [];
  // Chunked: a workspace admin can own hundreds of cards, and `in()` goes
  // into the query string.
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from('subscription_cards')
      .select('id, external_id')
      .in('external_id', unique.slice(i, i + 200));
    if (error) throw new AppError(500, error.message);
    out.push(...((data ?? []) as CardRow[]));
  }
  return out;
}

/**
 * Put the card's CRM salesperson on the room.
 *
 * Only fills a vacancy — a room SquadHire already assigned keeps its own
 * salesperson. Needs a matching active staff_users row (salesperson_id is a
 * real FK); when there is none the room simply stays unassigned, and CRM still
 * shows it to the card's owner because CRM scopes by the card, not by this.
 */
async function adoptSalesperson(
  actor: ConversationActor,
  conversationId: string,
  currentSalespersonId: string | null,
  salespersonEmail: string | null | undefined,
): Promise<boolean> {
  if (currentSalespersonId) return false;
  const staff = await resolveActiveStaffByEmail(normalizeEmail(salespersonEmail));
  if (!staff) return false;
  try {
    await conversations.assignSalesperson(actor, conversationId, staff.id);
    return true;
  } catch (err) {
    // Never fail a listing over this — the room is still readable.
    console.error('[squadcrm-rooms] salesperson adoption failed', conversationId, err);
    return false;
  }
}

export interface SquadcrmRoomSummary extends IntroConversationSummary {
  /** The Hub card id CRM knows this room by. */
  card_external_id: string | null;
}

export async function listRooms(input: {
  cards: SquadcrmCardInput[];
  actor?: SquadcrmActorInput;
}): Promise<{ rooms: SquadcrmRoomSummary[]; display_name: string }> {
  const { actor, displayName } = await actorFor(input.actor);
  const cards = await resolveCards(input.cards.map((c) => c.external_id));
  if (!cards.length) return { rooms: [], display_name: displayName };

  const externalById = new Map(cards.map((c) => [c.id, c.external_id]));
  const salespersonByExternal = new Map(
    input.cards.map((c) => [c.external_id, c.salesperson_email ?? null]),
  );

  let rooms = await conversations.listConversations(actor, {
    card_ids: cards.map((c) => c.id),
  });

  // Fill in missing salespeople, then re-read so the response carries the
  // room's new state (and its "joined the room" system message).
  const adopted = await Promise.all(
    rooms.map((room) =>
      adoptSalesperson(
        actor,
        room.id,
        room.salesperson?.id ?? null,
        salespersonByExternal.get(externalById.get(room.card_id) ?? '') ?? null,
      ),
    ),
  );
  if (adopted.some(Boolean)) {
    rooms = await conversations.listConversations(actor, { card_ids: cards.map((c) => c.id) });
  }

  return {
    rooms: rooms.map((room) => ({
      ...room,
      card_external_id: externalById.get(room.card_id) ?? null,
    })),
    display_name: displayName,
  };
}

/** Guard every single-room call: the room's card must be one CRM sent. */
async function assertRoomInScope(
  conversationId: string,
  externalIds: string[],
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('intro_conversations')
    .select('card_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Conversation not found');

  const cards = await resolveCards(externalIds);
  const match = cards.find((c) => c.id === (data as { card_id: string }).card_id);
  if (!match) throw new AppError(404, 'Conversation not found');
  return match.external_id;
}

export async function getRoom(input: {
  conversation_id: string;
  external_ids: string[];
  after?: string;
  limit?: number;
  actor?: SquadcrmActorInput;
}): Promise<{
  conversation: IntroConversationDetail & { card_external_id: string | null };
  messages: IntroMessage[];
  display_name: string;
}> {
  const externalId = await assertRoomInScope(input.conversation_id, input.external_ids);
  const { actor, displayName } = await actorFor(input.actor);
  const conversation = await conversations.getConversation(actor, input.conversation_id);
  const messages = await conversations.listMessages(actor, input.conversation_id, {
    after: input.after,
    limit: input.limit ?? 100,
  });
  await conversations.markRead(actor, input.conversation_id);
  return {
    conversation: { ...conversation, card_external_id: externalId },
    messages,
    display_name: displayName,
  };
}

export async function sendRoomMessage(input: {
  conversation_id: string;
  body: string;
  external_ids: string[];
  actor?: SquadcrmActorInput;
}): Promise<{ message: IntroMessage; display_name: string }> {
  await assertRoomInScope(input.conversation_id, input.external_ids);
  const { actor, displayName } = await actorFor(input.actor);
  const message = await conversations.sendMessage(actor, input.conversation_id, input.body, {
    displayName,
  });
  return { message, display_name: displayName };
}
