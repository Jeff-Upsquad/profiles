import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';
import type { DayAvailableHours, DayHours } from '@/lib/workHours';

/**
 * One live opportunity as a non-partner sees it: the work, the pay, and nothing
 * that could identify the client. The server builds this from a whitelist — the
 * client never receives brand_name, notes or location, so there is nothing here
 * to hide in the UI.
 */
export interface OpportunityPreviewItem {
  id: string;
  /** Short opaque handle ("7F3A") so two cards read as two clients, unnamed. */
  ref: string;
  card_type: 'subscription' | 'assignment';
  published_at: string;
  expires_at: string | null;
  content: SubscriptionCardContentShape;
}

export function useOpportunityPreview(
  cardType: 'subscription' | 'assignment' = 'subscription',
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['opportunity-preview', cardType],
    queryFn: async () => {
      const { data } = await api.get<{ items: OpportunityPreviewItem[] }>(
        '/talent/opportunity-preview',
        { params: { card_type: cardType } },
      );
      return data.items ?? [];
    },
    staleTime: 60_000,
    enabled: opts.enabled ?? true,
  });
}

export type PartnerTrack = 'partner_program' | 'freelance';

export interface PartnerApplicationInput {
  tracks: PartnerTrack[];
  virtual_office_hours: DayHours[];
  daily_available_hours: DayAvailableHours[];
}

export function useApplyForPartnerProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PartnerApplicationInput) => {
      const { data } = await api.post<{ partner_approval_status: 'pending' | 'approved' }>(
        '/talent/me/partner-program/apply',
        input,
      );
      return data;
    },
    onSuccess: () => {
      // The locked modules key off partner_approval_status on the auth user,
      // so the caller also refetches it — this just clears the cached profile.
      qc.invalidateQueries({ queryKey: ['talentMe'] });
      qc.invalidateQueries({ queryKey: ['basicProfile'] });
    },
  });
}

/**
 * Whether the Partner modules (Subscriptions, Assignments, My Clients) are
 * read-only for this viewer.
 *
 * `partner_approval_status` being absent means a session that predates the
 * column — those accounts are full partners, so an absent value is NOT locked.
 * null (never applied), 'pending' and 'rejected' all are.
 */
export function usePartnerAccess() {
  const { user } = useAuth();
  const status = user?.partner_approval_status;
  const locked = status !== undefined && status !== 'approved';
  return { status, locked, approved: !locked };
}
