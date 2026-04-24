import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export type SubscriptionStatus = 'pending' | 'accepted' | 'rejected';
export type SubscriptionListFilter = 'pending' | 'responded' | 'all';

export interface SubscriptionCardContentShape {
  title?: string;
  description?: string;
  imageUrl?: string;
  ctaLabel?: string;
  expiresAt?: string;
  // Structured fields forwarded from SquadHub's subscription_cards row:
  custom_deliverables?: Array<{ label?: string; name?: string; title?: string; description?: string } | string>;
  working_days?: string[];
  brand_name?: string;
  business_nature?: string;
  notes?: string;
  target_country_names?: string[];
  target_languages?: string[];
  [key: string]: unknown;
}

export interface SubscriptionCardItem {
  id: string;
  status: SubscriptionStatus;
  responded_at: string | null;
  card: {
    id: string;
    external_id: string;
    content: SubscriptionCardContentShape;
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
