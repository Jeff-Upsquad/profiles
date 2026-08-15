import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { getAdminSetting } from './admin.service.js';
import { createBusinessNotification } from './business-notifications.service.js';
import { notifyTalentsInApp } from './jobs.service.js';
import { notifyJobEvent } from './push.service.js';
import { meetsLevel } from '../../../shared/src/types/access.js';
import type { ModuleGrants } from '../../../shared/src/types/access.js';
import type {
  IntroCardType,
  IntroConversationDetail,
  IntroConversationNote,
  IntroConversationStatus,
  IntroConversationSummary,
  IntroFrozenReason,
  IntroMeeting,
  IntroMeetingProvider,
  IntroMessage,
  IntroMessageKind,
  IntroPerson,
  IntroSenderType,
} from '../../../shared/src/types/conversations.js';

const JOB_OPEN_STAGES = new Set([
  'shortlisted',
  'interview_invited',
  'interview',
  'on_hold',
  'selected',
  'offer',
  'hired',
]);

const CARD_SELECT =
  'id, business_user_id, business_email, group_id, card_type, status, content, cancelled_at, archived_at, recalled_at, subscription_activated_at';

export interface ConversationActor {
  type: 'business' | 'talent' | 'staff' | 'admin';
  id: string;
  name?: string;
  email?: string;
  grants?: ModuleGrants;
}

interface CardRow {
  id: string;
  business_user_id: string | null;
  business_email: string | null;
  group_id: string | null;
  card_type: IntroCardType | string | null;
  status: string;
  content: Record<string, unknown> | null;
  cancelled_at: string | null;
  archived_at: string | null;
  recalled_at: string | null;
  subscription_activated_at: string | null;
}

interface RecipientRow {
  id: string;
  card_id: string;
  talent_user_id: string;
  status: string;
  cancelled_at: string | null;
  business_review_status: string | null;
  selected_at: string | null;
}

interface JobCandidateRow {
  id: string;
  card_id: string;
  talent_user_id: string;
  funnel_stage: string;
}

interface JobCardRow {
  card_id: string;
  hiring_stage: string;
  closed_at: string | null;
}

interface ConversationRow {
  id: string;
  business_user_id: string;
  talent_user_id: string;
  card_id: string;
  recipient_id: string | null;
  job_candidate_id: string | null;
  salesperson_id: string | null;
  status: IntroConversationStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Identity helpers ───────────────────────────────────────────────────────

async function businessOwnsCard(businessUserId: string, card: CardRow): Promise<boolean> {
  if (card.business_user_id === businessUserId) return true;
  const cardEmail = (card.business_email || '').trim().toLowerCase();
  if (!cardEmail) return false;
  const { data: businessUser } = await supabaseAdmin
    .from('business_users')
    .select('contact_email')
    .eq('id', businessUserId)
    .maybeSingle();
  const contactEmail = ((businessUser as any)?.contact_email as string | null | undefined)
    ?.trim()
    .toLowerCase();
  return !!(contactEmail && contactEmail === cardEmail);
}

async function loadCard(cardId: string): Promise<CardRow> {
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select(CARD_SELECT)
    .eq('id', cardId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Card not found');
  return data as CardRow;
}

async function resolveGroupCards(card: CardRow): Promise<CardRow[]> {
  if (!card.group_id) return [card];
  const { data, error } = await supabaseAdmin
    .from('subscription_cards')
    .select(CARD_SELECT)
    .eq('group_id', card.group_id);
  if (error) throw new AppError(500, error.message);
  return (data as CardRow[] | null)?.length ? (data as CardRow[]) : [card];
}

function cardTitle(card: CardRow): string | null {
  const content = card.content ?? {};
  const name =
    (typeof content.subscription_name === 'string' && content.subscription_name) ||
    (typeof content.brand_name === 'string' && content.brand_name) ||
    (typeof content.job_title === 'string' && content.job_title) ||
    (typeof content.title === 'string' && content.title) ||
    null;
  return name;
}

function cardTypeOf(card: CardRow): IntroCardType | null {
  const t = card.card_type;
  if (t === 'subscription' || t === 'assignment' || t === 'hiring') return t;
  return null;
}

async function loadJobContext(cardId: string, talentUserId: string): Promise<{
  candidate: JobCandidateRow | null;
  jobCard: JobCardRow | null;
}> {
  const [{ data: candidate }, { data: jobCard }] = await Promise.all([
    supabaseAdmin
      .from('job_candidates')
      .select('id, card_id, talent_user_id, funnel_stage')
      .eq('card_id', cardId)
      .eq('talent_user_id', talentUserId)
      .maybeSingle(),
    supabaseAdmin
      .from('job_cards')
      .select('card_id, hiring_stage, closed_at')
      .eq('card_id', cardId)
      .maybeSingle(),
  ]);
  return {
    candidate: (candidate as JobCandidateRow | null) ?? null,
    jobCard: (jobCard as JobCardRow | null) ?? null,
  };
}

function computeFrozenReason(
  card: CardRow,
  jobCandidate: JobCandidateRow | null,
  jobCard: JobCardRow | null,
  conversationStatus?: IntroConversationStatus,
): IntroFrozenReason | null {
  if (conversationStatus === 'closed') return 'admin_closed';
  if (card.cancelled_at) return 'cancelled';
  if (card.recalled_at) return 'cancelled';
  if (card.archived_at || card.status === 'archived') return 'archived';
  if (cardTypeOf(card) === 'hiring') {
    if (jobCard?.hiring_stage === 'closed' || jobCard?.closed_at) return 'closed';
    if (jobCandidate?.funnel_stage === 'placed') return 'placed';
    return null;
  }
  if (card.subscription_activated_at) return 'assigned';
  return null;
}

async function recipientHasOpenOffer(recipientId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('assignment_offers')
    .select('id')
    .eq('recipient_id', recipientId)
    .in('status', ['pending_business', 'pending_talent', 'accepted'])
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  return !!data;
}

async function assertEligibleToOpen(
  card: CardRow,
  recipient: RecipientRow | null,
  jobCandidate: JobCandidateRow | null,
): Promise<void> {
  if (cardTypeOf(card) === 'hiring') {
    if (!jobCandidate) {
      throw new AppError(400, 'This talent is not on this job yet.');
    }
    if (jobCandidate.funnel_stage === 'placed') {
      throw new AppError(400, 'This hire is already placed. Chat has moved to SquadHub.');
    }
    if (!JOB_OPEN_STAGES.has(jobCandidate.funnel_stage)) {
      throw new AppError(400, 'You can open a room after you shortlist or select this talent.');
    }
    return;
  }
  if (!recipient) {
    throw new AppError(400, 'This talent is not on this card.');
  }
  if (recipient.cancelled_at) {
    throw new AppError(400, 'This card offer is no longer active.');
  }
  const shortlisted = recipient.business_review_status === 'shortlisted';
  const selected = !!recipient.selected_at;
  if (shortlisted || selected) return;
  if (await recipientHasOpenOffer(recipient.id)) return;
  throw new AppError(400, 'You can open a room after you shortlist, select, or start bidding with this talent.');
}

async function resolveSalespersonId(businessUserId: string): Promise<string | null> {
  const { data: business, error } = await supabaseAdmin
    .from('business_users')
    .select('default_salesperson_id')
    .eq('id', businessUserId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  const assigned = (business as any)?.default_salesperson_id as string | null;
  if (assigned && (await staffIsActive(assigned))) return assigned;

  const fallback = await getAdminSetting<string | null>('fallback_salesperson_id');
  const fallbackId = typeof fallback === 'string' && fallback.length > 0 ? fallback : null;
  if (fallbackId && (await staffIsActive(fallbackId))) return fallbackId;
  return null;
}

async function staffIsActive(staffUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('staff_users')
    .select('id, is_active')
    .eq('id', staffUserId)
    .maybeSingle();
  return !!(data && (data as any).is_active);
}

function canViewAll(actor: ConversationActor): boolean {
  if (actor.type === 'admin') return true;
  if (actor.type === 'staff') return meetsLevel(actor.grants?.conversations, 'full');
  return false;
}

function canManage(actor: ConversationActor): boolean {
  if (actor.type === 'admin') return true;
  if (actor.type === 'staff') return meetsLevel(actor.grants?.conversations, 'edit');
  return false;
}

function senderTypeFor(actor: ConversationActor, salespersonId: string | null): IntroSenderType {
  if (actor.type === 'business') return 'business';
  if (actor.type === 'talent') return 'talent';
  if (actor.type === 'admin') return 'admin';
  if (salespersonId && actor.id === salespersonId) return 'salesperson';
  return 'staff';
}

// ─── Access ─────────────────────────────────────────────────────────────────

async function loadConversation(id: string): Promise<ConversationRow> {
  const { data, error } = await supabaseAdmin
    .from('intro_conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Conversation not found');
  return data as ConversationRow;
}

async function assertCanAccess(actor: ConversationActor, convo: ConversationRow): Promise<void> {
  if (actor.type === 'business') {
    if (convo.business_user_id !== actor.id) throw new AppError(404, 'Conversation not found');
    return;
  }
  if (actor.type === 'talent') {
    if (convo.talent_user_id !== actor.id) throw new AppError(404, 'Conversation not found');
    return;
  }
  if (canViewAll(actor)) return;
  if (actor.type === 'staff' && convo.salesperson_id === actor.id) return;
  throw new AppError(404, 'Conversation not found');
}

async function assertCanSend(actor: ConversationActor, convo: ConversationRow, card: CardRow): Promise<{
  frozenReason: IntroFrozenReason | null;
}> {
  await assertCanAccess(actor, convo);
  const { candidate, jobCard } = await loadJobContext(convo.card_id, convo.talent_user_id);
  const frozenReason = computeFrozenReason(card, candidate, jobCard, convo.status);
  if (frozenReason) {
    throw new AppError(409, freezeMessage(frozenReason));
  }
  return { frozenReason };
}

function freezeMessage(reason: IntroFrozenReason): string {
  switch (reason) {
    case 'assigned':
      return 'This card is assigned. Chat has moved to SquadHub.';
    case 'placed':
      return 'This hire is placed. Chat has moved to SquadHub.';
    case 'cancelled':
      return 'This card was cancelled. The conversation is read-only.';
    case 'closed':
      return 'This job is closed. The conversation is read-only.';
    case 'archived':
      return 'This card was archived. The conversation is read-only.';
    case 'admin_closed':
      return 'This conversation was closed by UpSquad.';
  }
}

// ─── People lookups ─────────────────────────────────────────────────────────

async function loadBusinessPerson(id: string): Promise<IntroPerson> {
  const { data } = await supabaseAdmin
    .from('business_users')
    .select('id, company_name, contact_person_name, contact_email')
    .eq('id', id)
    .maybeSingle();
  return {
    id,
    name:
      ((data as any)?.company_name as string) ||
      ((data as any)?.contact_person_name as string) ||
      'Business',
    email: ((data as any)?.contact_email as string) ?? null,
  };
}

async function loadTalentPerson(id: string): Promise<IntroPerson> {
  const { data } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, profile_photo_url')
    .eq('id', id)
    .maybeSingle();
  return {
    id,
    name: ((data as any)?.full_name as string) || 'Talent',
    photo_url: ((data as any)?.profile_photo_url as string) ?? null,
  };
}

async function loadStaffPerson(id: string | null): Promise<IntroPerson | null> {
  if (!id) return null;
  const { data } = await supabaseAdmin
    .from('staff_users')
    .select('id, name, email')
    .eq('id', id)
    .maybeSingle();
  if (!data) return { id, name: 'UpSquad' };
  return {
    id,
    name: ((data as any).name as string) || 'UpSquad',
    email: ((data as any).email as string) ?? null,
  };
}

async function actorDisplayName(actor: ConversationActor): Promise<string> {
  if (actor.name) return actor.name;
  if (actor.type === 'business') return (await loadBusinessPerson(actor.id)).name;
  if (actor.type === 'talent') return (await loadTalentPerson(actor.id)).name;
  if (actor.type === 'staff') {
    const p = await loadStaffPerson(actor.id);
    return p?.name ?? 'UpSquad';
  }
  return actor.email || 'UpSquad admin';
}

// ─── Serialization ──────────────────────────────────────────────────────────

async function unreadCountFor(convo: ConversationRow, actor: ConversationActor): Promise<number> {
  let participantType: 'business' | 'talent' | 'salesperson' | 'staff' | null = null;
  if (actor.type === 'business') participantType = 'business';
  else if (actor.type === 'talent') participantType = 'talent';
  else if (actor.type === 'staff' && convo.salesperson_id === actor.id) participantType = 'salesperson';
  else if (actor.type === 'staff') participantType = 'staff';
  else return 0;

  const { data: member } = await supabaseAdmin
    .from('intro_conversation_members')
    .select('last_read_at')
    .eq('conversation_id', convo.id)
    .eq('participant_type', participantType)
    .eq('participant_id', actor.id)
    .maybeSingle();

  const lastRead = (member as any)?.last_read_at as string | null | undefined;
  let q = supabaseAdmin
    .from('intro_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', convo.id)
    .is('deleted_at', null)
    .neq('sender_type', 'system');
  if (lastRead) q = q.gt('created_at', lastRead);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

async function lastMessagePreview(convoId: string): Promise<IntroConversationSummary['last_message']> {
  const { data } = await supabaseAdmin
    .from('intro_messages')
    .select('kind, body, sender_type, created_at, deleted_at')
    .eq('conversation_id', convoId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    kind: data.kind as IntroMessageKind,
    body: (data.body as string | null) ?? null,
    sender_type: data.sender_type as IntroSenderType,
    created_at: data.created_at as string,
  };
}

async function toSummary(
  convo: ConversationRow,
  actor: ConversationActor,
  card?: CardRow,
): Promise<IntroConversationSummary> {
  const loadedCard = card ?? (await loadCard(convo.card_id));
  const { candidate, jobCard } = await loadJobContext(convo.card_id, convo.talent_user_id);
  const frozenReason = computeFrozenReason(loadedCard, candidate, jobCard, convo.status);
  const [business, talent, salesperson, last_message, unread_count] = await Promise.all([
    loadBusinessPerson(convo.business_user_id),
    loadTalentPerson(convo.talent_user_id),
    loadStaffPerson(convo.salesperson_id),
    lastMessagePreview(convo.id),
    unreadCountFor(convo, actor),
  ]);
  return {
    id: convo.id,
    status: convo.status,
    frozen: !!frozenReason,
    frozen_reason: frozenReason,
    can_send: !frozenReason,
    card_id: convo.card_id,
    card_type: cardTypeOf(loadedCard),
    card_title: cardTitle(loadedCard),
    business,
    talent,
    salesperson,
    last_message,
    unread_count,
    last_message_at: convo.last_message_at,
    created_at: convo.created_at,
  };
}

async function toDetail(
  convo: ConversationRow,
  actor: ConversationActor,
  card?: CardRow,
): Promise<IntroConversationDetail> {
  const summary = await toSummary(convo, actor, card);
  const { data: members } = await supabaseAdmin
    .from('intro_conversation_members')
    .select('participant_type, participant_id, role, last_read_at')
    .eq('conversation_id', convo.id);

  const named = await Promise.all(
    (members ?? []).map(async (m: any) => {
      let name = 'Member';
      if (m.participant_type === 'business') name = summary.business.name;
      else if (m.participant_type === 'talent') name = summary.talent.name;
      else {
        const p = await loadStaffPerson(m.participant_id);
        name = p?.name ?? 'UpSquad';
      }
      return {
        participant_type: m.participant_type,
        participant_id: m.participant_id,
        role: m.role,
        name,
        last_read_at: m.last_read_at,
      };
    }),
  );

  return {
    ...summary,
    recipient_id: convo.recipient_id,
    job_candidate_id: convo.job_candidate_id,
    members: named,
  };
}

function serializeMeeting(row: any): IntroMeeting {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    proposed_by_type: row.proposed_by_type,
    proposed_by_id: row.proposed_by_id,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    timezone: row.timezone,
    provider: row.provider,
    meeting_link: row.meeting_link,
    status: row.status,
    created_at: row.created_at,
  };
}

async function serializeMessage(row: any): Promise<IntroMessage> {
  let senderName: string | null = null;
  if (row.sender_type === 'system') senderName = 'System';
  else if (row.sender_id) {
    if (row.sender_type === 'business') senderName = (await loadBusinessPerson(row.sender_id)).name;
    else if (row.sender_type === 'talent') senderName = (await loadTalentPerson(row.sender_id)).name;
    else {
      const p = await loadStaffPerson(row.sender_id);
      senderName = p?.name ?? 'UpSquad';
    }
  }
  let meeting: IntroMeeting | null = null;
  if (row.meeting_id) {
    const { data } = await supabaseAdmin
      .from('intro_meetings')
      .select('*')
      .eq('id', row.meeting_id)
      .maybeSingle();
    if (data) meeting = serializeMeeting(data);
  }
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_type: row.sender_type,
    sender_id: row.sender_id,
    sender_name: senderName,
    kind: row.kind,
    body: row.deleted_at ? null : row.body,
    meeting,
    created_at: row.created_at,
    deleted_at: row.deleted_at,
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

async function insertMember(
  conversationId: string,
  participantType: 'business' | 'talent' | 'salesperson' | 'staff',
  participantId: string,
  role: 'member' | 'salesperson' | 'observer',
) {
  const { error } = await supabaseAdmin.from('intro_conversation_members').upsert(
    {
      conversation_id: conversationId,
      participant_type: participantType,
      participant_id: participantId,
      role,
    },
    { onConflict: 'conversation_id,participant_type,participant_id' },
  );
  if (error) throw new AppError(500, error.message);
}

async function insertSystemMessage(conversationId: string, body: string) {
  const { error } = await supabaseAdmin.from('intro_messages').insert({
    conversation_id: conversationId,
    sender_type: 'system',
    sender_id: null,
    kind: 'system',
    body,
  });
  if (error) throw new AppError(500, error.message);
  await supabaseAdmin
    .from('intro_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

async function notifyNewActivity(opts: {
  convo: ConversationRow;
  except: ConversationActor;
  title: string;
  body: string;
  type: 'intro_message' | 'intro_meeting';
}) {
  const route = `/talent/messages/${opts.convo.id}`;
  const businessRoute = `/business/messages/${opts.convo.id}`;
  if (opts.except.type !== 'talent') {
    notifyTalentsInApp([opts.convo.talent_user_id], opts.type, opts.title, opts.body, route);
    notifyJobEvent([opts.convo.talent_user_id], {
      type: opts.type === 'intro_meeting' ? 'job_interview' : 'job_stage',
      title: opts.title,
      body: opts.body,
      cardId: opts.convo.card_id,
      route,
    }).catch((err) => console.error('[intro] push failed', err));
  }
  if (opts.except.type !== 'business') {
    createBusinessNotification({
      businessUserId: opts.convo.business_user_id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      ref: { card_id: opts.convo.card_id, conversation_id: opts.convo.id, route: businessRoute },
    });
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function createOrGetConversation(
  actor: ConversationActor,
  input: { cardId: string; talentUserId: string },
): Promise<IntroConversationDetail> {
  if (actor.type !== 'business' && actor.type !== 'admin' && actor.type !== 'staff') {
    throw new AppError(403, 'Only a business or UpSquad can open a room.');
  }
  if (actor.type !== 'business' && !canManage(actor)) {
    throw new AppError(403, 'Insufficient permissions');
  }

  const seedCard = await loadCard(input.cardId);
  const group = await resolveGroupCards(seedCard);
  const groupIds = group.map((c) => c.id);

  if (actor.type === 'business') {
    const owns = await Promise.all(group.map((c) => businessOwnsCard(actor.id, c)));
    if (!owns.some(Boolean)) throw new AppError(404, 'Card not found');
  }

  const { data: recipient } = await supabaseAdmin
    .from('subscription_card_recipients')
    .select('id, card_id, talent_user_id, status, cancelled_at, business_review_status, selected_at')
    .eq('talent_user_id', input.talentUserId)
    .in('card_id', groupIds)
    .maybeSingle();

  const recipientRow = (recipient as RecipientRow | null) ?? null;
  const targetCard = recipientRow
    ? group.find((c) => c.id === recipientRow.card_id) ?? seedCard
    : seedCard;

  const { candidate, jobCard } = await loadJobContext(targetCard.id, input.talentUserId);
  const frozenReason = computeFrozenReason(targetCard, candidate, jobCard);
  if (frozenReason) throw new AppError(409, freezeMessage(frozenReason));

  await assertEligibleToOpen(targetCard, recipientRow, candidate);

  const businessUserId =
    actor.type === 'business'
      ? actor.id
      : targetCard.business_user_id ||
        (() => {
          throw new AppError(400, 'This card is not linked to a business yet.');
        })();

  const { data: existing } = await supabaseAdmin
    .from('intro_conversations')
    .select('*')
    .eq('business_user_id', businessUserId)
    .eq('talent_user_id', input.talentUserId)
    .eq('card_id', targetCard.id)
    .maybeSingle();

  if (existing) {
    return toDetail(existing as ConversationRow, actor, targetCard);
  }

  const salespersonId = await resolveSalespersonId(businessUserId);
  const status: IntroConversationStatus = salespersonId ? 'open' : 'awaiting_salesperson';

  const { data: created, error } = await supabaseAdmin
    .from('intro_conversations')
    .insert({
      business_user_id: businessUserId,
      talent_user_id: input.talentUserId,
      card_id: targetCard.id,
      recipient_id: recipientRow?.id ?? null,
      job_candidate_id: candidate?.id ?? null,
      salesperson_id: salespersonId,
      status,
      last_message_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await supabaseAdmin
        .from('intro_conversations')
        .select('*')
        .eq('business_user_id', businessUserId)
        .eq('talent_user_id', input.talentUserId)
        .eq('card_id', targetCard.id)
        .maybeSingle();
      if (raced) return toDetail(raced as ConversationRow, actor, targetCard);
    }
    throw new AppError(500, error.message);
  }

  const convo = created as ConversationRow;
  await insertMember(convo.id, 'business', businessUserId, 'member');
  await insertMember(convo.id, 'talent', input.talentUserId, 'member');
  if (salespersonId) {
    await insertMember(convo.id, 'salesperson', salespersonId, 'salesperson');
  }

  const business = await loadBusinessPerson(businessUserId);
  const talent = await loadTalentPerson(input.talentUserId);
  if (salespersonId) {
    const sales = await loadStaffPerson(salespersonId);
    await insertSystemMessage(
      convo.id,
      `Room opened with ${business.name}, ${talent.name}, and ${sales?.name ?? 'UpSquad'}.`,
    );
  } else {
    await insertSystemMessage(
      convo.id,
      `Room opened with ${business.name} and ${talent.name}. UpSquad will join shortly.`,
    );
  }

  notifyNewActivity({
    convo,
    except: actor,
    title: `${business.name} wants to chat`,
    body: `Open your intro room to talk with ${business.name} and UpSquad.`,
    type: 'intro_message',
  });

  return toDetail(convo, actor, targetCard);
}

export async function listConversations(
  actor: ConversationActor,
  filters: {
    status?: IntroConversationStatus;
    business_user_id?: string;
    talent_user_id?: string;
    salesperson_id?: string;
    card_id?: string;
  } = {},
): Promise<IntroConversationSummary[]> {
  let q = supabaseAdmin
    .from('intro_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (actor.type === 'business') q = q.eq('business_user_id', actor.id);
  else if (actor.type === 'talent') q = q.eq('talent_user_id', actor.id);
  else if (!canViewAll(actor)) q = q.eq('salesperson_id', actor.id);

  if (filters.status) q = q.eq('status', filters.status);
  if (filters.business_user_id && (actor.type === 'admin' || actor.type === 'staff')) {
    q = q.eq('business_user_id', filters.business_user_id);
  }
  if (filters.talent_user_id && (actor.type === 'admin' || actor.type === 'staff')) {
    q = q.eq('talent_user_id', filters.talent_user_id);
  }
  if (filters.salesperson_id && (actor.type === 'admin' || actor.type === 'staff')) {
    q = q.eq('salesperson_id', filters.salesperson_id);
  }
  if (filters.card_id) q = q.eq('card_id', filters.card_id);

  const { data, error } = await q.limit(200);
  if (error) throw new AppError(500, error.message);
  const rows = (data ?? []) as ConversationRow[];
  return Promise.all(rows.map((row) => toSummary(row, actor)));
}

export async function getUnreadTotal(actor: ConversationActor): Promise<number> {
  const list = await listConversations(actor);
  return list.reduce((sum, c) => sum + c.unread_count, 0);
}

export async function getConversation(
  actor: ConversationActor,
  id: string,
): Promise<IntroConversationDetail> {
  const convo = await loadConversation(id);
  await assertCanAccess(actor, convo);
  return toDetail(convo, actor);
}

export async function listMessages(
  actor: ConversationActor,
  id: string,
  opts: { after?: string; limit: number },
): Promise<IntroMessage[]> {
  const convo = await loadConversation(id);
  await assertCanAccess(actor, convo);

  let q = supabaseAdmin
    .from('intro_messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })
    .limit(opts.limit);
  if (opts.after) {
    const { data: afterRow } = await supabaseAdmin
      .from('intro_messages')
      .select('created_at')
      .eq('id', opts.after)
      .maybeSingle();
    if (afterRow?.created_at) q = q.gt('created_at', afterRow.created_at as string);
  }
  const { data, error } = await q;
  if (error) throw new AppError(500, error.message);
  return Promise.all((data ?? []).map(serializeMessage));
}

export async function markRead(actor: ConversationActor, id: string): Promise<void> {
  const convo = await loadConversation(id);
  await assertCanAccess(actor, convo);
  let participantType: 'business' | 'talent' | 'salesperson' | 'staff' | null = null;
  if (actor.type === 'business') participantType = 'business';
  else if (actor.type === 'talent') participantType = 'talent';
  else if (actor.type === 'staff' && convo.salesperson_id === actor.id) participantType = 'salesperson';
  else if (actor.type === 'staff') participantType = 'staff';
  if (!participantType) return;

  await supabaseAdmin.from('intro_conversation_members').upsert(
    {
      conversation_id: id,
      participant_type: participantType,
      participant_id: actor.id,
      role: participantType === 'salesperson' ? 'salesperson' : participantType === 'staff' ? 'observer' : 'member',
      last_read_at: new Date().toISOString(),
    },
    { onConflict: 'conversation_id,participant_type,participant_id' },
  );
}

export async function sendMessage(
  actor: ConversationActor,
  id: string,
  body: string,
): Promise<IntroMessage> {
  const convo = await loadConversation(id);
  const card = await loadCard(convo.card_id);
  await assertCanSend(actor, convo, card);

  const senderType = senderTypeFor(actor, convo.salesperson_id);
  const { data, error } = await supabaseAdmin
    .from('intro_messages')
    .insert({
      conversation_id: id,
      sender_type: senderType,
      sender_id: actor.id,
      kind: 'text',
      body,
    })
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);

  await supabaseAdmin
    .from('intro_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id);

  const senderName = await actorDisplayName(actor);
  notifyNewActivity({
    convo,
    except: actor,
    title: `New message from ${senderName}`,
    body,
    type: 'intro_message',
  });

  return serializeMessage(data);
}

export async function assignSalesperson(
  actor: ConversationActor,
  id: string,
  staffUserId: string,
): Promise<IntroConversationDetail> {
  if (!canManage(actor)) throw new AppError(403, 'Insufficient permissions');
  const convo = await loadConversation(id);
  if (!canViewAll(actor) && convo.salesperson_id && convo.salesperson_id !== actor.id) {
    throw new AppError(403, 'You can only claim unassigned rooms or rooms you already own.');
  }
  if (!(await staffIsActive(staffUserId))) {
    throw new AppError(400, 'That staff user is not active.');
  }

  const previous = convo.salesperson_id;
  if (previous && previous !== staffUserId) {
    await supabaseAdmin
      .from('intro_conversation_members')
      .delete()
      .eq('conversation_id', id)
      .eq('participant_type', 'salesperson')
      .eq('participant_id', previous);
  }

  const { data, error } = await supabaseAdmin
    .from('intro_conversations')
    .update({ salesperson_id: staffUserId, status: 'open' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);

  await insertMember(id, 'salesperson', staffUserId, 'salesperson');
  const sales = await loadStaffPerson(staffUserId);
  await insertSystemMessage(
    id,
    previous && previous !== staffUserId
      ? `${sales?.name ?? 'UpSquad'} is now the salesperson on this room.`
      : `${sales?.name ?? 'UpSquad'} joined the room.`,
  );
  return toDetail(data as ConversationRow, actor);
}

export async function closeConversation(
  actor: ConversationActor,
  id: string,
): Promise<IntroConversationDetail> {
  if (!canManage(actor)) throw new AppError(403, 'Insufficient permissions');
  const convo = await loadConversation(id);
  await assertCanAccess(actor, convo);
  const { data, error } = await supabaseAdmin
    .from('intro_conversations')
    .update({ status: 'closed' })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  await insertSystemMessage(id, 'This conversation was closed by UpSquad.');
  return toDetail(data as ConversationRow, actor);
}

export async function reopenConversation(
  actor: ConversationActor,
  id: string,
): Promise<IntroConversationDetail> {
  if (!canManage(actor)) throw new AppError(403, 'Insufficient permissions');
  const convo = await loadConversation(id);
  await assertCanAccess(actor, convo);
  const card = await loadCard(convo.card_id);
  const { candidate, jobCard } = await loadJobContext(convo.card_id, convo.talent_user_id);
  const lifecycle = computeFrozenReason(card, candidate, jobCard);
  if (lifecycle && lifecycle !== 'admin_closed') {
    throw new AppError(409, freezeMessage(lifecycle));
  }
  const next: IntroConversationStatus = convo.salesperson_id ? 'open' : 'awaiting_salesperson';
  const { data, error } = await supabaseAdmin
    .from('intro_conversations')
    .update({ status: next })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  await insertSystemMessage(id, 'This conversation was reopened.');
  return toDetail(data as ConversationRow, actor);
}

export async function softDeleteMessage(
  actor: ConversationActor,
  conversationId: string,
  messageId: string,
): Promise<void> {
  if (!canManage(actor)) throw new AppError(403, 'Insufficient permissions');
  const convo = await loadConversation(conversationId);
  await assertCanAccess(actor, convo);
  const { data, error } = await supabaseAdmin
    .from('intro_messages')
    .update({ deleted_at: new Date().toISOString(), body: null })
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .select('id')
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data) throw new AppError(404, 'Message not found');
}

export async function proposeMeeting(
  actor: ConversationActor,
  id: string,
  input: {
    starts_at: string;
    ends_at?: string;
    timezone?: string;
    provider: IntroMeetingProvider;
    meeting_link: string;
  },
): Promise<IntroMessage> {
  const convo = await loadConversation(id);
  const card = await loadCard(convo.card_id);
  await assertCanSend(actor, convo, card);

  const { data: meeting, error: meetErr } = await supabaseAdmin
    .from('intro_meetings')
    .insert({
      conversation_id: id,
      proposed_by_type: senderTypeFor(actor, convo.salesperson_id),
      proposed_by_id: actor.id,
      starts_at: input.starts_at,
      ends_at: input.ends_at ?? null,
      timezone: input.timezone ?? null,
      provider: input.provider,
      meeting_link: input.meeting_link,
      status: 'proposed',
    })
    .select('*')
    .single();
  if (meetErr) throw new AppError(500, meetErr.message);

  const when = new Date(input.starts_at).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('intro_messages')
    .insert({
      conversation_id: id,
      sender_type: senderTypeFor(actor, convo.salesperson_id),
      sender_id: actor.id,
      kind: 'meeting',
      body: `Proposed a meeting for ${when}`,
      meeting_id: meeting.id,
    })
    .select('*')
    .single();
  if (msgErr) throw new AppError(500, msgErr.message);

  await supabaseAdmin
    .from('intro_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', id);

  const senderName = await actorDisplayName(actor);
  notifyNewActivity({
    convo,
    except: actor,
    title: `${senderName} proposed a meeting`,
    body: `Meeting proposed for ${when}`,
    type: 'intro_meeting',
  });

  return serializeMessage(msg);
}

export async function respondToMeeting(
  actor: ConversationActor,
  conversationId: string,
  meetingId: string,
  action: 'accept' | 'decline',
): Promise<IntroMeeting> {
  const convo = await loadConversation(conversationId);
  const card = await loadCard(convo.card_id);
  await assertCanSend(actor, convo, card);

  const { data: meeting, error } = await supabaseAdmin
    .from('intro_meetings')
    .select('*')
    .eq('id', meetingId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!meeting) throw new AppError(404, 'Meeting not found');
  if (meeting.status !== 'proposed') {
    throw new AppError(409, 'This meeting is no longer awaiting a response.');
  }

  const next = action === 'accept' ? 'accepted' : 'declined';
  const { data: updated, error: updErr } = await supabaseAdmin
    .from('intro_meetings')
    .update({ status: next })
    .eq('id', meetingId)
    .select('*')
    .single();
  if (updErr) throw new AppError(500, updErr.message);

  const who = await actorDisplayName(actor);
  await insertSystemMessage(
    conversationId,
    action === 'accept' ? `${who} accepted the meeting.` : `${who} declined the meeting.`,
  );
  return serializeMeeting(updated);
}

export async function cancelMeeting(
  actor: ConversationActor,
  conversationId: string,
  meetingId: string,
): Promise<IntroMeeting> {
  const convo = await loadConversation(conversationId);
  const card = await loadCard(convo.card_id);
  await assertCanSend(actor, convo, card);

  const { data: meeting } = await supabaseAdmin
    .from('intro_meetings')
    .select('*')
    .eq('id', meetingId)
    .eq('conversation_id', conversationId)
    .maybeSingle();
  if (!meeting) throw new AppError(404, 'Meeting not found');
  if (!['proposed', 'accepted'].includes(meeting.status as string)) {
    throw new AppError(409, 'This meeting cannot be cancelled.');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('intro_meetings')
    .update({ status: 'cancelled' })
    .eq('id', meetingId)
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);

  const who = await actorDisplayName(actor);
  await insertSystemMessage(conversationId, `${who} cancelled the meeting.`);
  return serializeMeeting(updated);
}

export async function listNotes(
  actor: ConversationActor,
  conversationId: string,
): Promise<IntroConversationNote[]> {
  if (actor.type !== 'admin' && actor.type !== 'staff') {
    throw new AppError(403, 'Notes are internal to UpSquad.');
  }
  const convo = await loadConversation(conversationId);
  await assertCanAccess(actor, convo);
  const { data, error } = await supabaseAdmin
    .from('intro_conversation_notes')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });
  if (error) throw new AppError(500, error.message);
  return (data ?? []) as IntroConversationNote[];
}

export async function addNote(
  actor: ConversationActor,
  conversationId: string,
  body: string,
): Promise<IntroConversationNote> {
  if (!canManage(actor)) throw new AppError(403, 'Insufficient permissions');
  const convo = await loadConversation(conversationId);
  await assertCanAccess(actor, convo);
  const name = await actorDisplayName(actor);
  const { data, error } = await supabaseAdmin
    .from('intro_conversation_notes')
    .insert({
      conversation_id: conversationId,
      author_staff_id: actor.type === 'staff' ? actor.id : null,
      author_name: name,
      author_email: actor.email ?? null,
      body,
    })
    .select('*')
    .single();
  if (error) throw new AppError(500, error.message);
  return data as IntroConversationNote;
}

export async function listActiveStaff(): Promise<Array<{ id: string; name: string; email: string }>> {
  const { data, error } = await supabaseAdmin
    .from('staff_users')
    .select('id, name, email')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new AppError(500, error.message);
  return (data ?? []) as Array<{ id: string; name: string; email: string }>;
}

export async function setBusinessDefaultSalesperson(
  businessUserId: string,
  staffUserId: string | null,
): Promise<void> {
  if (staffUserId && !(await staffIsActive(staffUserId))) {
    throw new AppError(400, 'That staff user is not active.');
  }
  const { error } = await supabaseAdmin
    .from('business_users')
    .update({ default_salesperson_id: staffUserId })
    .eq('id', businessUserId);
  if (error) throw new AppError(500, error.message);
}

export async function sweepMeetingReminders(): Promise<void> {
  const now = Date.now();
  const horizon = new Date(now + 60 * 60 * 1000).toISOString();
  const floor = new Date(now).toISOString();
  const { data, error } = await supabaseAdmin
    .from('intro_meetings')
    .select('id, conversation_id, starts_at')
    .in('status', ['proposed', 'accepted'])
    .is('reminder_sent_at', null)
    .gte('starts_at', floor)
    .lte('starts_at', horizon);
  if (error) {
    console.error('[intro] reminder sweep failed', error.message);
    return;
  }
  for (const row of data ?? []) {
    const { data: convo } = await supabaseAdmin
      .from('intro_conversations')
      .select('*')
      .eq('id', row.conversation_id)
      .maybeSingle();
    if (!convo) continue;
    const when = new Date(row.starts_at as string).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    notifyNewActivity({
      convo: convo as ConversationRow,
      except: { type: 'admin', id: 'system' },
      title: 'Meeting starting within the hour',
      body: `Your intro meeting is at ${when}.`,
      type: 'intro_meeting',
    });
    await supabaseAdmin
      .from('intro_meetings')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', row.id);
  }
}
