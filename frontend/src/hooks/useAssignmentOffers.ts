import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export interface OfferAmount {
  amount: number;
  currency?: string;
  period?: 'project' | 'per_month' | 'per_week' | 'per_day' | 'per_hour';
  [key: string]: unknown;
}

export type AssignmentOfferStatus =
  | 'pending_business'
  | 'pending_talent'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export interface AssignmentOffer {
  id: string;
  card_id: string;
  recipient_id: string;
  talent_user_id: string;
  business_user_id: string | null;
  pricing_mode: 'priced' | 'unpriced';
  current_amount: OfferAmount;
  current_terms: Record<string, unknown> | null;
  status: AssignmentOfferStatus;
  opened_by: 'talent' | 'business' | 'admin';
  last_actor_side: 'talent' | 'business' | 'admin' | null;
  expires_on: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignmentOfferEvent {
  id: string;
  actor_type: 'business' | 'talent' | 'admin' | 'system';
  action: string;
  amount: unknown;
  note: string | null;
  created_at: string;
}

/** The talent's live offer + negotiation thread for one recipient (offer is null before any move). */
export interface OfferMoveLimits {
  max_talent_bids?: number;
  max_business_offers?: number;
  talent_bids_used?: number;
  business_offers_used?: number;
  talent_bids_remaining?: number;
  business_offers_remaining?: number;
  negotiation_started?: boolean;
}

export function useAssignmentOffer(recipientId: string, enabled = true) {
  return useQuery({
    queryKey: ['assignment-offer', recipientId],
    queryFn: async () => {
      const { data } = await api.get<
        { offer: AssignmentOffer | null; events: AssignmentOfferEvent[] } & OfferMoveLimits
      >(`/talent/subscriptions/${recipientId}/offer`);
      return data;
    },
    enabled,
  });
}

export function useSubmitAssignmentOffer(recipientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { amount: OfferAmount; terms?: Record<string, unknown>; note?: string }) => {
      const { data } = await api.post<{ offer: AssignmentOffer }>(
        `/talent/subscriptions/${recipientId}/offer`,
        vars,
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-offer', recipientId] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['talent-card-offers'] });
    },
  });
}

export function useRespondAssignmentOffer(recipientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { action: 'accept' | 'decline' | 'withdraw'; note?: string }) => {
      const { data } = await api.post<{ offer: AssignmentOffer }>(
        `/talent/subscriptions/${recipientId}/offer/respond`,
        vars,
      );
      return data.offer;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-offer', recipientId] });
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['talent-card-offers'] });
    },
  });
}

export interface TalentCardOffer extends AssignmentOffer {
  card_type: string | null;
  brand_name: string | null;
  card_title: string | null;
  /** Full card content for rendering the original offer card body. */
  card_content?: Record<string, unknown> | null;
  card_external_id?: string | null;
  card_status?: string | null;
  card_published_at?: string | null;
  card_expires_at?: string | null;
  events: AssignmentOfferEvent[];
}

/** Talent Bidding tab — all bids / offers across cards. */
export function useTalentCardOffers(enabled = true) {
  return useQuery({
    queryKey: ['talent-card-offers'],
    queryFn: async () => {
      const { data } = await api.get<{ offers: TalentCardOffer[] }>('/talent/subscriptions/offers');
      return data.offers ?? [];
    },
    enabled,
  });
}

// ─── Shared formatting ──────────────────────────────────────────────────────

const PERIOD_LABELS: Record<string, string> = {
  project: 'for the project',
  per_month: '/month',
  per_week: '/week',
  per_day: '/day',
  per_hour: '/hour',
};

/** Render an OfferAmount like "₹30,000 for the project". */
export function formatOfferAmount(amount: unknown): string | null {
  if (amount == null || typeof amount !== 'object') return null;
  const a = amount as OfferAmount;
  if (typeof a.amount !== 'number') return null;
  const cur = a.currency && a.currency !== 'INR' ? a.currency + ' ' : '₹';
  const period = a.period ? ' ' + (PERIOD_LABELS[a.period] ?? '') : '';
  return `${cur}${a.amount.toLocaleString()}${period}`.trim();
}
