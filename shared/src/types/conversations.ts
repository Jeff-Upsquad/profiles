export type IntroConversationStatus = 'open' | 'awaiting_salesperson' | 'closed';

export type IntroParticipantType = 'business' | 'talent' | 'salesperson' | 'staff';

export type IntroMemberRole = 'member' | 'salesperson' | 'observer';

export type IntroSenderType =
  | 'business'
  | 'talent'
  | 'salesperson'
  | 'staff'
  | 'admin'
  | 'system';

export type IntroMessageKind = 'text' | 'meeting' | 'system';

export type IntroMeetingProvider = 'meet' | 'zoom' | 'teams' | 'other';

export type IntroMeetingStatus =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed';

export type IntroFrozenReason =
  | 'assigned'
  | 'placed'
  | 'cancelled'
  | 'closed'
  | 'archived'
  | 'admin_closed';

export type IntroCardType = 'subscription' | 'assignment' | 'hiring';

export interface IntroPerson {
  id: string;
  name: string;
  email?: string | null;
  photo_url?: string | null;
}

export interface IntroConversationMember {
  participant_type: IntroParticipantType;
  participant_id: string;
  role: IntroMemberRole;
  name: string;
  last_read_at: string | null;
}

export interface IntroMeeting {
  id: string;
  conversation_id: string;
  proposed_by_type: IntroSenderType;
  proposed_by_id: string | null;
  starts_at: string;
  ends_at: string | null;
  timezone: string | null;
  provider: IntroMeetingProvider;
  meeting_link: string | null;
  status: IntroMeetingStatus;
  created_at: string;
}

export interface IntroMessage {
  id: string;
  conversation_id: string;
  sender_type: IntroSenderType;
  sender_id: string | null;
  sender_name: string | null;
  kind: IntroMessageKind;
  body: string | null;
  meeting: IntroMeeting | null;
  created_at: string;
  deleted_at: string | null;
}

export interface IntroConversationSummary {
  id: string;
  status: IntroConversationStatus;
  frozen: boolean;
  frozen_reason: IntroFrozenReason | null;
  can_send: boolean;
  card_id: string;
  card_type: IntroCardType | null;
  card_title: string | null;
  business: IntroPerson;
  talent: IntroPerson;
  salesperson: IntroPerson | null;
  last_message: {
    kind: IntroMessageKind;
    body: string | null;
    sender_type: IntroSenderType;
    created_at: string;
  } | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

export interface IntroConversationDetail extends IntroConversationSummary {
  recipient_id: string | null;
  job_candidate_id: string | null;
  members: IntroConversationMember[];
}

export interface IntroConversationNote {
  id: string;
  conversation_id: string;
  author_staff_id: string | null;
  author_name: string | null;
  author_email: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}
