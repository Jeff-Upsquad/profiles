import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type {
  OfferAmount,
  AssignmentOfferEvent,
  AssignmentOfferStatus,
} from '@/hooks/useAssignmentOffers';

export interface BusinessAssignmentOffer {
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
  talent_name: string;
  events: AssignmentOfferEvent[];
  profile_id?: string | null;
  category_id?: string | null;
  profile_photo_url?: string | null;
  list_price?: number | null;
  list_currency?: string | null;
  talent_bids_used?: number;
  business_offers_used?: number;
  talent_bids_remaining?: number;
  business_offers_remaining?: number;
  /** False for first talent-only bids (those stay under For Review). */
  negotiation_started?: boolean;
}

export function isOpenBusinessOffer(o: Pick<BusinessAssignmentOffer, 'status' | 'negotiation_started'>): boolean {
  return (
    o.status === 'pending_business' ||
    o.status === 'pending_talent' ||
    o.status === 'accepted' ||
    !!o.negotiation_started
  );
}

function offersBase(cardId: string) {
  // Canonical path works for subscription + assignment cards.
  return `/business/my-subscription-cards/${cardId}/offers`;
}

export function useBusinessAssignmentOffers(cardId: string, enabled = true) {
  return useQuery({
    queryKey: ['business-assignment-offers', cardId],
    queryFn: async () => {
      const { data } = await api.get<{ offers: BusinessAssignmentOffer[] }>(offersBase(cardId));
      return data.offers ?? [];
    },
    enabled,
  });
}

function useInvalidate(cardId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['business-assignment-offers', cardId] });
    // Accept shortlists — refresh recipients + the card lists too.
    qc.invalidateQueries({ queryKey: ['card-recipients', cardId] });
    qc.invalidateQueries({ queryKey: ['my-assignment-cards'] });
    qc.invalidateQueries({ queryKey: ['my-subscription-cards'] });
  };
}

export function useBusinessCounterOffer(cardId: string) {
  const invalidate = useInvalidate(cardId);
  return useMutation({
    mutationFn: async (vars: { offerId: string; amount: OfferAmount; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessAssignmentOffer }>(
        `${offersBase(cardId)}/${vars.offerId}/counter`,
        { amount: vars.amount, ...(vars.note ? { note: vars.note } : {}) },
      );
      return data.offer;
    },
    onSuccess: invalidate,
  });
}

export function useBusinessAcceptOffer(cardId: string) {
  const invalidate = useInvalidate(cardId);
  return useMutation({
    mutationFn: async (vars: { offerId: string; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessAssignmentOffer }>(
        `${offersBase(cardId)}/${vars.offerId}/accept`,
        { ...(vars.note ? { note: vars.note } : {}) },
      );
      return data.offer;
    },
    onSuccess: invalidate,
  });
}

export function useBusinessDeclineOffer(cardId: string) {
  const invalidate = useInvalidate(cardId);
  return useMutation({
    mutationFn: async (vars: { offerId: string; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessAssignmentOffer }>(
        `${offersBase(cardId)}/${vars.offerId}/decline`,
        { ...(vars.note ? { note: vars.note } : {}) },
      );
      return data.offer;
    },
    onSuccess: invalidate,
  });
}

/** Business "Send an Offer" from a talent profile / review row. Auto-shortlists. */
export function useBusinessSendOffer(cardId: string) {
  const invalidate = useInvalidate(cardId);
  return useMutation({
    mutationFn: async (vars: { recipientId: string; amount: OfferAmount; note?: string }) => {
      const { data } = await api.post<{ offer: BusinessAssignmentOffer }>(
        `${offersBase(cardId)}/send`,
        {
          recipient_id: vars.recipientId,
          amount: vars.amount,
          ...(vars.note ? { note: vars.note } : {}),
        },
      );
      return data.offer;
    },
    onSuccess: invalidate,
  });
}
