import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { getBusinessUser, getCardRecipientsForReview } from './business.service.js';
import { notifyGroupMeet } from './push.service.js';
import { notifyTalentsInApp } from './jobs.service.js';
import { closeSquadUpRoom, mintSquadUpToken } from './livekit.service.js';
import { randomUUID } from 'node:crypto';
import type { GroupMeet, GroupMeetJoinCredentials } from '../../../shared/src/types/group-meet.js';
import { formatGroupMeetNoticeWhen } from '../../../shared/src/groupMeetWhen.js';

export interface GroupMeetActor {
  type: 'business' | 'salesperson' | 'staff' | 'admin';
  id: string;
  name: string;
}

interface ScheduleInput {
  title?: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
}

function roomName(meetingId: string) {
  return `group-meet-${meetingId.replace(/-/g, '')}-${randomUUID().slice(0, 8)}`;
}

function fanOutGroupMeetNotice(
  talentUserIds: string[],
  input: {
    kind: 'invite' | 'rescheduled' | 'cancelled';
    title: string;
    body: string;
    cardId: string;
    meetingId: string;
  },
) {
  const type = input.kind === 'invite'
    ? 'group_meet_invite'
    : input.kind === 'rescheduled'
      ? 'group_meet_rescheduled'
      : 'group_meet_cancelled';
  void notifyGroupMeet(talentUserIds, input).catch((err) =>
    console.error(`[group-meet] ${input.kind} push failed`, err),
  );
  void notifyTalentsInApp(
    talentUserIds,
    type,
    input.title,
    input.body,
    `/group-meet/${input.meetingId}`,
  ).catch((err) => console.error(`[group-meet] ${input.kind} in-app notify failed`, err));
}

async function serialize(meeting: any): Promise<GroupMeet> {
  const [{ data: members, error: memberError }, { data: messages, error: messageError }] = await Promise.all([
    supabaseAdmin.from('group_meet_members').select('*').eq('group_meet_id', meeting.id),
    supabaseAdmin.from('group_meet_messages').select('*').eq('group_meet_id', meeting.id).order('created_at'),
  ]);
  if (memberError) throw new AppError(500, memberError.message);
  if (messageError) throw new AppError(500, messageError.message);
  const ordered = [...(members ?? [])].sort((a: any, b: any) => {
    const rank: Record<string, number> = { host: 0, team: 1, guest: 2 };
    return (rank[a.role] ?? 9) - (rank[b.role] ?? 9) || a.display_name.localeCompare(b.display_name);
  });
  const talentMembers = ordered.filter((m: any) => m.participant_type === 'talent');
  return {
    ...meeting,
    members: ordered,
    messages: messages ?? [],
    invited_count: talentMembers.length,
    accepted_count: talentMembers.filter((m: any) => m.rsvp === 'accepted').length,
    declined_count: talentMembers.filter((m: any) => m.rsvp === 'declined').length,
  } as GroupMeet;
}

async function activeForCard(cardId: string) {
  const { data, error } = await supabaseAdmin
    .from('group_meets')
    .select('*')
    .eq('card_id', cardId)
    .in('status', ['scheduled', 'rescheduled'])
    .maybeSingle();
  if (error) throw new AppError(500, error.message);
  return data;
}

export async function getForBusiness(businessUserId: string, cardId: string): Promise<GroupMeet | null> {
  // This also enforces direct/grouped card ownership.
  await getCardRecipientsForReview(businessUserId, cardId);
  const meeting = await activeForCard(cardId);
  if (!meeting) return null;
  if (meeting.business_user_id !== businessUserId) throw new AppError(404, 'Group Meet not found');
  return serialize(meeting);
}

export async function schedule(
  businessUserId: string,
  cardId: string,
  input: ScheduleInput,
  actor: GroupMeetActor,
): Promise<GroupMeet> {
  if (await activeForCard(cardId)) throw new AppError(409, 'A Group Meet is already scheduled for this card.');
  const [recipients, business] = await Promise.all([
    getCardRecipientsForReview(businessUserId, cardId),
    getBusinessUser(businessUserId),
  ]);
  const eligible = recipients.filter((r: any) =>
    r.business_review_status === 'shortlisted' ||
    ['pending_business', 'pending_talent', 'accepted'].includes(r.offer_status ?? ''),
  );
  const unique = new Map<string, any>();
  for (const recipient of eligible) if (!unique.has(recipient.talent_user_id)) unique.set(recipient.talent_user_id, recipient);
  if (unique.size === 0) throw new AppError(400, 'Shortlist a talent or receive a bid before scheduling a Group Meet.');

  const fallbackTitle = `${business.company_name || 'Client'} · Group Meet`;
  const meetingId = randomUUID();
  const { data: meeting, error } = await supabaseAdmin.from('group_meets').insert({
    id: meetingId,
    card_id: cardId,
    business_user_id: businessUserId,
    title: input.title?.trim() || fallbackTitle,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    timezone: input.timezone,
    provider: 'squadup',
    meeting_link: `/group-meet/${meetingId}`,
    room_name: roomName(meetingId),
    created_by_type: actor.type,
    created_by_id: actor.id,
    created_by_name: actor.name,
  }).select('*').single();
  if (error || !meeting) throw new AppError(500, error?.message || 'Could not schedule Group Meet');

  const hostName = business.contact_person_name || business.company_name || 'Client';
  const memberRows: any[] = [{
    group_meet_id: meeting.id,
    participant_type: 'business',
    participant_id: businessUserId,
    display_name: hostName,
    role: 'host',
    rsvp: 'accepted',
    rsvp_at: new Date().toISOString(),
  }];
  if (actor.type !== 'business') {
    memberRows.push({
      group_meet_id: meeting.id,
      participant_type: actor.type,
      participant_id: actor.id,
      display_name: actor.name,
      role: 'team',
      rsvp: 'accepted',
      rsvp_at: new Date().toISOString(),
    });
  }
  for (const recipient of unique.values()) {
    memberRows.push({
      group_meet_id: meeting.id,
      participant_type: 'talent',
      participant_id: recipient.talent_user_id,
      display_name: recipient.talent_name || 'Talent',
      photo_url: recipient.profile_photo_url,
      recipient_id: recipient.recipient_id,
      role: 'guest',
      agreed_amount: recipient.offer_amount || (recipient.proposed_price != null
        ? { amount: recipient.proposed_price, currency: recipient.currency || 'INR', period: 'per_month' }
        : null),
    });
  }
  const { error: memberError } = await supabaseAdmin.from('group_meet_members').insert(memberRows);
  if (memberError) {
    // Avoid a stranded live meeting that blocks retrying the schedule action.
    await supabaseAdmin.from('group_meets').delete().eq('id', meeting.id);
    throw new AppError(500, memberError.message);
  }
  await supabaseAdmin.from('group_meet_messages').insert({
    group_meet_id: meeting.id,
    sender_type: 'system',
    sender_name: 'Group Meet',
    body: `${actor.name} scheduled this Group Meet.`,
  });

  const when = formatGroupMeetNoticeWhen(input.starts_at, input.timezone);
  fanOutGroupMeetNotice([...unique.keys()], {
    kind: 'invite',
    title: 'Group Meet invitation',
    body: `${hostName} invited you to a Group Meet on ${when}. Accept or decline to respond.`,
    cardId,
    meetingId: meeting.id,
  });
  return serialize(meeting);
}

async function requireBusinessMeeting(businessUserId: string, meetingId: string) {
  const { data, error } = await supabaseAdmin.from('group_meets').select('*').eq('id', meetingId).maybeSingle();
  if (error) throw new AppError(500, error.message);
  if (!data || data.business_user_id !== businessUserId) throw new AppError(404, 'Group Meet not found');
  return data;
}

export async function reschedule(businessUserId: string, meetingId: string, input: ScheduleInput, actor: GroupMeetActor) {
  const current = await requireBusinessMeeting(businessUserId, meetingId);
  if (!['scheduled', 'rescheduled'].includes(current.status)) throw new AppError(409, 'This Group Meet cannot be rescheduled.');
  const nextRoomName = roomName(meetingId);
  const { data: updated, error } = await supabaseAdmin.from('group_meets').update({
    title: input.title?.trim() || current.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    timezone: input.timezone,
    provider: 'squadup',
    meeting_link: `/group-meet/${meetingId}`,
    room_name: nextRoomName,
    room_started_at: null,
    room_ended_at: null,
    status: 'rescheduled',
    revision: current.revision + 1,
    created_by_type: actor.type,
    created_by_id: actor.id,
    created_by_name: actor.name,
  }).eq('id', meetingId).select('*').single();
  if (error || !updated) throw new AppError(500, error?.message || 'Could not reschedule Group Meet');
  await closeSquadUpRoom(current.room_name);
  await supabaseAdmin.from('group_meet_members').update({ rsvp: 'invited', rsvp_at: null, joined_at: null, left_at: null })
    .eq('group_meet_id', meetingId).eq('participant_type', 'talent');
  await supabaseAdmin.from('group_meet_messages').insert({
    group_meet_id: meetingId, sender_type: 'system', sender_name: 'Group Meet',
    body: `${actor.name} rescheduled the meeting. Everyone has been asked to confirm the new time.`,
  });
  const { data: people } = await supabaseAdmin.from('group_meet_members').select('participant_id')
    .eq('group_meet_id', meetingId).eq('participant_type', 'talent');
  const when = formatGroupMeetNoticeWhen(input.starts_at, input.timezone);
  fanOutGroupMeetNotice((people ?? []).map((p: any) => p.participant_id), {
    kind: 'rescheduled', title: 'Group Meet rescheduled',
    body: `The Group Meet has moved to ${when}. Please confirm the new time.`,
    cardId: current.card_id, meetingId,
  });
  return serialize(updated);
}

export async function cancel(businessUserId: string, meetingId: string, actor: GroupMeetActor) {
  const current = await requireBusinessMeeting(businessUserId, meetingId);
  if (!['scheduled', 'rescheduled'].includes(current.status)) throw new AppError(409, 'This Group Meet is already closed.');
  const { data: updated, error } = await supabaseAdmin.from('group_meets').update({
    status: 'cancelled', cancelled_at: new Date().toISOString(), room_ended_at: new Date().toISOString(),
  }).eq('id', meetingId).select('*').single();
  if (error || !updated) throw new AppError(500, error?.message || 'Could not cancel Group Meet');
  await closeSquadUpRoom(current.room_name);
  await supabaseAdmin.from('group_meet_messages').insert({
    group_meet_id: meetingId, sender_type: 'system', sender_name: 'Group Meet', body: `${actor.name} cancelled the meeting.`,
  });
  const { data: people } = await supabaseAdmin.from('group_meet_members').select('participant_id')
    .eq('group_meet_id', meetingId).eq('participant_type', 'talent');
  fanOutGroupMeetNotice((people ?? []).map((p: any) => p.participant_id), {
    kind: 'cancelled', title: 'Group Meet cancelled', body: 'The Group Meet has been cancelled.',
    cardId: current.card_id, meetingId,
  });
  return serialize(updated);
}

export async function getForTalent(talentUserId: string, meetingId: string): Promise<GroupMeet> {
  const { data: membership } = await supabaseAdmin.from('group_meet_members').select('group_meet_id, rsvp')
    .eq('group_meet_id', meetingId).eq('participant_type', 'talent').eq('participant_id', talentUserId).maybeSingle();
  if (!membership) throw new AppError(404, 'Group Meet not found');
  const { data: meeting, error } = await supabaseAdmin.from('group_meets').select('*').eq('id', meetingId).single();
  if (error || !meeting) throw new AppError(404, 'Group Meet not found');
  return { ...await serialize(meeting), self_rsvp: membership.rsvp };
}

export async function respond(talentUserId: string, meetingId: string, action: 'accept' | 'decline') {
  await getForTalent(talentUserId, meetingId);
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from('group_meet_members').update({
    rsvp: action === 'accept' ? 'accepted' : 'declined', rsvp_at: now,
  }).eq('group_meet_id', meetingId).eq('participant_type', 'talent').eq('participant_id', talentUserId);
  if (error) throw new AppError(500, error.message);
  return getForTalent(talentUserId, meetingId);
}

async function joinMeeting(
  meeting: any,
  actor: { type: GroupMeetActor['type'] | 'talent'; id: string; name: string },
): Promise<GroupMeetJoinCredentials> {
  if (!['scheduled', 'rescheduled'].includes(meeting.status)) {
    throw new AppError(409, 'This Group Meet is not open.');
  }
  const { data: member, error: memberError } = await supabaseAdmin
    .from('group_meet_members')
    .select('id, rsvp, photo_url')
    .eq('group_meet_id', meeting.id)
    .eq('participant_type', actor.type)
    .eq('participant_id', actor.id)
    .maybeSingle();
  if (memberError || !member) throw new AppError(404, 'Group Meet not found');
  if (actor.type === 'talent' && member.rsvp !== 'accepted') {
    throw new AppError(403, 'Accept the meeting invitation before joining.');
  }

  const identity = `${actor.type}:${actor.id}`;
  const credentials = await mintSquadUpToken({
    roomName: meeting.room_name,
    identity,
    name: actor.name,
    metadata: { participant_type: actor.type, participant_id: actor.id, photo_url: member.photo_url },
  });

  const now = new Date().toISOString();
  const { error: presenceError } = await supabaseAdmin
    .from('group_meet_members')
    .update({ joined_at: now, left_at: null })
    .eq('id', member.id);
  if (presenceError) throw new AppError(500, presenceError.message);
  if (!meeting.room_started_at) {
    await supabaseAdmin.from('group_meets').update({ room_started_at: now }).eq('id', meeting.id).is('room_started_at', null);
  }
  const current = actor.type === 'talent'
    ? await getForTalent(actor.id, meeting.id)
    : await serialize({ ...meeting, room_started_at: meeting.room_started_at || now });
  return { ...credentials, identity, meeting: current };
}

export async function joinForBusiness(
  businessUserId: string,
  meetingId: string,
  actor: GroupMeetActor,
) {
  const meeting = await requireBusinessMeeting(businessUserId, meetingId);
  return joinMeeting(meeting, actor);
}

export async function joinForTalent(talentUserId: string, meetingId: string, name: string) {
  await getForTalent(talentUserId, meetingId);
  const { data: meeting, error } = await supabaseAdmin.from('group_meets').select('*').eq('id', meetingId).single();
  if (error || !meeting) throw new AppError(404, 'Group Meet not found');
  return joinMeeting(meeting, { type: 'talent', id: talentUserId, name });
}

export async function leave(
  meetingId: string,
  actor: { type: GroupMeetActor['type'] | 'talent'; id: string },
) {
  const { error } = await supabaseAdmin.from('group_meet_members').update({
    left_at: new Date().toISOString(),
  }).eq('group_meet_id', meetingId).eq('participant_type', actor.type).eq('participant_id', actor.id);
  if (error) throw new AppError(500, error.message);
}

export async function sendMessage(meetingId: string, actor: { type: GroupMeetActor['type'] | 'talent'; id: string; name: string }, body: string) {
  const { data: membership } = await supabaseAdmin.from('group_meet_members').select('id')
    .eq('group_meet_id', meetingId).eq('participant_type', actor.type).eq('participant_id', actor.id).maybeSingle();
  if (!membership) throw new AppError(404, 'Group Meet not found');
  const { data, error } = await supabaseAdmin.from('group_meet_messages').insert({
    group_meet_id: meetingId, sender_type: actor.type, sender_id: actor.id, sender_name: actor.name, body,
  }).select('*').single();
  if (error) throw new AppError(500, error.message);
  return data;
}
