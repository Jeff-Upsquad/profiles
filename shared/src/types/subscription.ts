/**
 * Subscription card types shared between the Profiles backend and frontend.
 *
 * Both `content` and `match_rules` are open-shape JSONB on the DB side because
 * SquadHub (the publisher) evolves them independently. The frontend only
 * renders a whitelisted subset of `content` keys — see SubscriptionCardContent.
 */

export type SubscriptionCardStatus = 'active' | 'archived';
export type SubscriptionCardRecipientStatus = 'pending' | 'accepted' | 'rejected';

export interface SubscriptionCardContent {
  title?: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface SubscriptionCardMatchRules {
  category_ids?: string[];
  [key: string]: unknown;
}

export interface SubscriptionCard {
  id: string;
  external_id: string;
  content: SubscriptionCardContent;
  match_rules?: SubscriptionCardMatchRules;
  status: SubscriptionCardStatus;
  published_at: string;
  expires_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SubscriptionCardRecipient {
  id: string;
  card: SubscriptionCard;
  status: SubscriptionCardRecipientStatus;
  responded_at: string | null;
  created_at?: string;
}

export type SubscriptionCardAction = 'accept' | 'reject';

export interface SubscriptionCardCallbackPayload {
  external_id: string;
  recipient_id: string;
  talent_user_id: string;
  action: SubscriptionCardAction;
  responded_at: string;
}
