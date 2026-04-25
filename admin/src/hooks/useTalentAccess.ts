import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

// ── Types ──────────────────────────────────────────────

export interface AccessGrantCategory {
  id: string;
  name: string;
  slug: string;
}

export interface AccessGrant {
  id: string;
  email: string;
  expires_at: string;
  revoked_at: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  categories: AccessGrantCategory[];
  status?: 'active' | 'expired' | 'revoked';
}

export type GrantStatusFilter = 'active' | 'expired' | 'revoked' | 'all';

export interface CreateGrantPayload {
  email: string;
  expires_at?: string;
  category_ids: string[];
  notes?: string;
}

export interface UpdateGrantPayload {
  expires_at?: string;
  category_ids?: string[];
  notes?: string | null;
}

// ── List + read ────────────────────────────────────────

export function useTalentAccessGrants(
  status: GrantStatusFilter = 'active',
  search?: string,
) {
  return useQuery<AccessGrant[]>({
    queryKey: ['admin', 'talent-access', status, search ?? ''],
    queryFn: async () => {
      const params = new URLSearchParams({ status });
      if (search) params.set('search', search);
      const { data } = await api.get(`/admin/talent-access?${params.toString()}`);
      return data;
    },
  });
}

export function useTalentAccessGrant(id: string | undefined) {
  return useQuery<AccessGrant>({
    queryKey: ['admin', 'talent-access', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talent-access/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin', 'talent-access'] });
}

export function useCreateTalentAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateGrantPayload) => {
      const { data } = await api.post('/admin/talent-access', payload);
      return data as AccessGrant;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Access grant created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to create grant');
    },
  });
}

export function useUpdateTalentAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateGrantPayload & { id: string }) => {
      const { data } = await api.patch(`/admin/talent-access/${id}`, payload);
      return data as AccessGrant;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Access grant updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to update grant');
    },
  });
}

export function useRevokeTalentAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/admin/talent-access/${id}/revoke`);
      return data as AccessGrant;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Access revoked');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to revoke');
    },
  });
}

export function useExtendTalentAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, days }: { id: string; days: number }) => {
      const { data } = await api.post(`/admin/talent-access/${id}/extend`, { days });
      return data as AccessGrant;
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Access extended');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to extend');
    },
  });
}

export function useDeleteTalentAccessGrant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/talent-access/${id}`);
    },
    onSuccess: () => {
      invalidateAll(qc);
      toast.success('Access grant deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete');
    },
  });
}
