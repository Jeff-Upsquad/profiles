import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import type { ModulePermission } from '../../../shared/src/types/access';

// ── Types ──────────────────────────────────────────────

export interface AdminModuleInfo {
  slug: string;
  name: string;
  section: string;
  sort: number;
  is_active: boolean;
}

export interface StaffGrant {
  module_slug: string;
  permission: ModulePermission;
}

export interface StaffSummary {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  grants: StaffGrant[];
}

export interface CreateStaffPayload {
  email: string;
  name: string;
  password: string;
}

export interface UpdateStaffPayload {
  name?: string;
  is_active?: boolean;
  password?: string;
}

// ── Queries ────────────────────────────────────────────

export function useAdminModules() {
  return useQuery<AdminModuleInfo[]>({
    queryKey: ['admin', 'modules'],
    queryFn: async () => {
      const { data } = await api.get('/admin/modules');
      return data.modules ?? [];
    },
  });
}

export function useStaffList() {
  return useQuery<StaffSummary[]>({
    queryKey: ['admin', 'staff'],
    queryFn: async () => {
      const { data } = await api.get('/admin/staff');
      return data.staff ?? [];
    },
  });
}

export function useStaffGrants(id: string | undefined) {
  return useQuery<StaffGrant[]>({
    queryKey: ['admin', 'staff', 'grants', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/staff/${id}/grants`);
      return data.grants ?? [];
    },
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────

function invalidateStaff(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin', 'staff'] });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateStaffPayload) => {
      const { data } = await api.post('/admin/staff', payload);
      return data.staff as StaffSummary;
    },
    onSuccess: () => {
      invalidateStaff(qc);
      toast.success('Staff user created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to create staff user');
    },
  });
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateStaffPayload & { id: string }) => {
      const { data } = await api.patch(`/admin/staff/${id}`, payload);
      return data.staff as StaffSummary;
    },
    onSuccess: () => {
      invalidateStaff(qc);
      toast.success('Staff user updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update staff user');
    },
  });
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/staff/${id}`);
    },
    onSuccess: () => {
      invalidateStaff(qc);
      toast.success('Staff user deleted');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || 'Failed to delete staff user');
    },
  });
}

export function useSaveStaffGrants() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, grants }: { id: string; grants: StaffGrant[] }) => {
      const { data } = await api.put(`/admin/staff/${id}/grants`, { grants });
      return data.grants as StaffGrant[];
    },
    onSuccess: (_data, vars) => {
      invalidateStaff(qc);
      qc.invalidateQueries({ queryKey: ['admin', 'staff', 'grants', vars.id] });
      toast.success('Access updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Failed to update access');
    },
  });
}
