export type GroupMeetStatus = 'scheduled' | 'rescheduled' | 'cancelled' | 'completed';
export type GroupMeetRsvp = 'invited' | 'accepted' | 'declined';
export type GroupMeetParticipantType = 'business' | 'salesperson' | 'staff' | 'admin' | 'talent';

export interface GroupMeetMember {
  id: string;
  participant_type: GroupMeetParticipantType;
  participant_id: string;
  display_name: string;
  photo_url: string | null;
  recipient_id: string | null;
  role: 'host' | 'team' | 'guest';
  rsvp: GroupMeetRsvp;
  rsvp_at: string | null;
  agreed_amount: Record<string, unknown> | null;
  joined_at: string | null;
  left_at?: string | null;
}

export interface GroupMeetMessage {
  id: string;
  sender_type: GroupMeetParticipantType | 'system';
  sender_id: string | null;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface GroupMeet {
  id: string;
  card_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  provider: 'squadup' | 'meet' | 'zoom' | 'teams' | 'other';
  meeting_link: string;
  room_name?: string;
  room_started_at?: string | null;
  room_ended_at?: string | null;
  status: GroupMeetStatus;
  revision: number;
  created_by_name: string | null;
  members: GroupMeetMember[];
  messages: GroupMeetMessage[];
  invited_count: number;
  accepted_count: number;
  declined_count: number;
  /** Present on the talent endpoint so a group room never mistakes another
   * talent's RSVP for the signed-in person's response. */
  self_rsvp?: GroupMeetRsvp;
}

export interface GroupMeetJoinCredentials {
  token: string;
  url: string;
  identity: string;
  meeting: GroupMeet;
}
