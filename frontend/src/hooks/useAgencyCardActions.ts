'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';

/** Whether this agency has completed (locked = no services set). */
export function useAgencyCanRespond(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['agencyCanRespond'],
    queryFn: () => agencyApi.getProfile(),
    select: (profile: any) => {
      const services = Array.isArray(profile?.services) ? profile.services : [];
      return { canRespond: services.length > 0, serviceCount: services.length };
    },
    enabled: opts.enabled ?? true,
  });
}

export function useRespondAgencyCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { recipientId: string; action: 'accept' | 'reject' }) =>
      agencyApi.respondCard(vars.recipientId, vars.action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencySubscriptions'] });
      qc.invalidateQueries({ queryKey: ['agencyAssignments'] });
    },
  });
}

export function useAgencyOffer(recipientId: string, enabled = true) {
  return useQuery({
    queryKey: ['agencyOffer', recipientId],
    queryFn: () => agencyApi.getOffer(recipientId),
    enabled,
  });
}

export function useSubmitAgencyOffer(recipientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { amount: any; terms?: any; note?: string }) =>
      agencyApi.submitOffer(recipientId, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencyOffer', recipientId] }),
  });
}

export function useRespondAgencyOffer(recipientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { action: 'accept' | 'decline' | 'withdraw'; note?: string }) =>
      agencyApi.respondOffer(recipientId, vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agencyOffer', recipientId] }),
  });
}