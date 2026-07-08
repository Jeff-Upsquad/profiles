import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';

// Talent-side offer hooks — /api/talent/jobs/offers (offers.service.ts).
// Negotiate is locked out once the business makes its FINAL counteroffer
// (is_final_counter / status 'countered') — the API 403s it.

export type OfferStatus =
  | 'draft'
  | 'sent'
  | 'negotiating'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired';

export interface CompensationSlot {
  amount?: number | null;
  cadence?: string | null;
  [key: string]: unknown;
}

/** {currency, training:{amount,cadence}, probation:{...}, confirmed:{...}} — free-form. */
export interface OfferCompensation {
  currency?: string;
  training?: CompensationSlot;
  probation?: CompensationSlot;
  confirmed?: CompensationSlot;
  [key: string]: unknown;
}

export interface OfferLetterSection {
  key: string;
  title?: string;
  body_html?: string;
}

/** Frozen at send: {sections[], merge_values{}, signatory{}}. */
export interface OfferLetter {
  sections?: OfferLetterSection[];
  merge_values?: Record<string, unknown>;
  signatory?: { name?: string | null; title?: string | null } | null;
  [key: string]: unknown;
}

export interface JobOffer {
  id: string;
  candidate_id: string;
  card_id: string;
  job_profile_id: string;
  talent_user_id: string;
  squadhub_template_id: string | null;
  delivery_mode: 'platform' | 'manual_email';
  position_title: string;
  effective_date: string | null;
  join_by_date: string | null;
  expires_on: string | null;
  compensation: OfferCompensation;
  letter: OfferLetter | null;
  status: OfferStatus;
  is_final_counter: boolean;
  sent_at: string | null;
  responded_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
}

export interface TalentJobOffer extends JobOffer {
  business_name: string;
  job_title: string;
}

export interface OfferEvent {
  id: string;
  actor_type: 'talent' | 'business' | 'admin' | 'system';
  action: string;
  amount: unknown;
  note: string | null;
  created_at: string;
}

export function useMyJobOffers(opts: { enabled?: boolean } = {}) {
  return useQuery<TalentJobOffer[]>({
    queryKey: ['job-offers', 'mine'],
    queryFn: async () => {
      const { data } = await api.get<{ offers: TalentJobOffer[] }>('/talent/jobs/offers');
      return data.offers ?? [];
    },
    enabled: opts.enabled ?? true,
  });
}

export function useJobOffer(offerId: string | undefined) {
  return useQuery<{ offer: JobOffer; events: OfferEvent[] }>({
    queryKey: ['job-offers', 'detail', offerId],
    queryFn: async () => {
      const { data } = await api.get<{ offer: JobOffer; events: OfferEvent[] }>(
        `/talent/jobs/offers/${offerId}`,
      );
      return data;
    },
    enabled: !!offerId,
  });
}

export function useRespondToOffer(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      action: 'accept' | 'decline' | 'negotiate';
      amount?: number | Record<string, unknown>;
      note?: string;
    }) => {
      const { data } = await api.post<{ offer: JobOffer }>(
        `/talent/jobs/offers/${offerId}/respond`,
        vars,
      );
      return data.offer;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['job-offers'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(
        vars.action === 'accept'
          ? 'Offer accepted — congratulations!'
          : vars.action === 'decline'
            ? 'Offer declined'
            : 'Negotiation request sent',
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Could not save your response');
    },
  });
}

export function useAskOfferQuestion(offerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (question: string) => {
      const { data } = await api.post(`/talent/jobs/offers/${offerId}/questions`, { question });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['job-offers', 'detail', offerId] });
      toast.success("Question sent — you'll be notified when it's answered.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send question');
    },
  });
}
