import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export type SubscriptionStatus = 'pending' | 'accepted' | 'rejected';
export type SubscriptionListFilter =
  | 'pending'
  | 'responded'
  | 'expired'
  | 'accepted'
  | 'rejected'
  | 'all';

export interface SubscriptionCardContentShape {
  title?: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  expiresAt?: string;
  // Structured fields forwarded from SquadHub's subscription_cards row:
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
  business_nature?: string;
  customer_location?: string;
  notes?: string;
  requirement_note?: string;
  // Optional skills/tools the business requested on the brief, keyed by group
  // ('skills' | 'tools' | 'ai_tools' | …) → labels. Descriptive only — shown to
  // talent as nice-to-haves; never affects whether this card was broadcast.
  additional_requirements?: Record<string, string[]>;
  // Per-viewer match (tick/cross on the talent card) computed server-side from
  // the talent's own profile vs the card's required language/location and the
  // optional skills/tools. Present only on talent-facing card fetches.
  viewer_match?: {
    languages: { label: string; matched: boolean }[];
    countries: { label: string; matched: boolean }[];
    regions: { label: string; matched: boolean }[];
    additional: { group: string; label: string; matched: boolean }[];
  };
  target_country_names?: string[];
  target_languages?: string[];
  // Plan-card fields (SquadHub should forward these from the selected plan):
  plan_name?: string;                // "Plus"
  subscription_name?: string;        // "Designer"
  hours_label?: string;              // "4-5 hours/day"
  capacity_label?: string;           // "50% Capacity"
  deliverables_label?: string;       // requirement note or "e.g. 20 posters per month"
  monthly_price?: number;            // 20000
  currency?: string;                 // "INR"
  price_label?: string;              // pre-formatted "₹20,000/month" (optional; overrides monthly_price+currency)
  is_popular?: boolean;              // adds a POPULAR ribbon
  [key: string]: unknown;
}

export interface SubscriptionCardItem {
  id: string;
  status: SubscriptionStatus;
  responded_at: string | null;
  cancelled_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  card: {
    id: string;
    external_id: string;
    content: SubscriptionCardContentShape;
    status: 'active' | 'assigned' | 'archived';
    published_at: string;
    expires_at: string | null;
    // Product line — 'assignment' = freelance project. Both types share this
    // feed; the UI tags each card so they're distinguishable at a glance.
    card_type?: 'subscription' | 'assignment' | 'hiring';
  };
}

export function useMySubscriptionCards(
  filter: SubscriptionListFilter = 'pending',
  cardType: 'subscription' | 'assignment' = 'subscription',
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['subscriptions', cardType, filter],
    queryFn: async () => {
      const { data } = await api.get<{ items: SubscriptionCardItem[] }>(
        '/talent/subscriptions',
        { params: { status: filter, card_type: cardType } }
      );
      return data.items ?? [];
    },
    enabled: opts.enabled ?? true,
  });
}

export function useUnreadSubscriptionCount(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['subscriptions', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>(
        '/talent/subscriptions/unread-count'
      );
      return data.count ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: opts.enabled ?? true,
  });
}

/** Pending assignment offers — assignments have no dedicated unread endpoint. */
export function useUnreadAssignmentCount(opts: { enabled?: boolean } = {}) {
  const query = useMySubscriptionCards('pending', 'assignment', opts);
  return { ...query, data: query.data?.length ?? 0 };
}

export function useRespondToSubscriptionCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { recipientId: string; action: 'accept' | 'reject' }) => {
      const { data } = await api.patch<{ id: string; status: SubscriptionStatus; responded_at: string }>(
        `/talent/subscriptions/${vars.recipientId}/respond`,
        { action: vars.action }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
    },
  });
}
