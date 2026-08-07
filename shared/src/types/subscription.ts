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
  // Structured fields from SquadHub (see SubscriptionCardContent.tsx for render rules):
  custom_deliverables?: Array<
    | {
        label?: string;
        name?: string;
        title?: string;
        description?: string;
        kind?: 'hours' | 'item';
        per_day?: number;
        per_week?: number;
        per_month?: number;
      }
    | string
  >;
  working_days?: string[];
  brand_name?: string;
  /** About-the-client: nature of business (not location). */
  business_nature?: string;
  /** About-the-client: location of business (kept separate from business_nature). */
  customer_location?: string;
  /** About-the-client: short note about the business. */
  notes?: string;
  /** Client-brief requirement; also mirrored into deliverables_label by SquadHub. */
  requirement_note?: string;
  /** Public R2 URL of the client's recorded requirement voice note (optional). */
  requirement_voice_url?: string;
  target_country_names?: string[];
  target_languages?: string[];
  // Plan-card fields (forwarded from SquadHub's selected plan):
  plan_name?: string;
  subscription_name?: string;
  hours_label?: string;
  capacity_label?: string;
  /** Prefer this for Deliverables; SquadHub sets it from requirement_note. */
  deliverables_label?: string;
  monthly_price?: number;
  currency?: string;
  price_label?: string;
  is_popular?: boolean;
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
