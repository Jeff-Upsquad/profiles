import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export type SubscriptionStatus = 'pending' | 'accepted' | 'rejected';
export type SubscriptionListFilter = 'pending' | 'accepted' | 'rejected' | 'all';

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
  notes?: string;
  target_country_names?: string[];
  target_languages?: string[];
  // Plan-card fields (SquadHub should forward these from the selected plan):
  plan_name?: string;                // "Plus"
  subscription_name?: string;        // "Designer"
  hours_label?: string;              // "4-5 hours/day"
  capacity_label?: string;           // "50% Capacity"
  deliverables_label?: string;       // "e.g. 20 posters per month"
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
  };
}

export function useMySubscriptionCards(filter: SubscriptionListFilter = 'pending') {
  return useQuery({
    queryKey: ['subscriptions', filter],
    queryFn: async () => {
      const { data } = await api.get<{ items: SubscriptionCardItem[] }>(
        '/talent/subscriptions',
        { params: { status: filter } }
      );
      return data.items ?? [];
    },
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
