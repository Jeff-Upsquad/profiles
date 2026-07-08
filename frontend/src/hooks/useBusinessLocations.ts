import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';

// Saved interview venues — /api/business/locations (business.routes.ts).
// Used by the physical-interview scheduler dropdown; delete is a soft
// deactivate so past rounds' frozen snapshots keep rendering.

export interface BusinessLocation {
  id: string;
  label: string;
  address: string;
  maps_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BusinessLocationInput {
  label: string;
  address: string;
  maps_url?: string | null;
}

export function useBusinessLocations(enabled = true) {
  return useQuery<BusinessLocation[]>({
    queryKey: ['business-locations'],
    queryFn: async () => {
      const { data } = await api.get<{ locations: BusinessLocation[] }>('/business/locations');
      return data.locations ?? [];
    },
    enabled,
  });
}

export function useCreateBusinessLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BusinessLocationInput) => {
      const { data } = await api.post<{ location: BusinessLocation }>('/business/locations', input);
      return data.location;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-locations'] });
      toast.success('Location saved');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to save location');
    },
  });
}

export function useUpdateBusinessLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { locationId: string; input: BusinessLocationInput }) => {
      const { data } = await api.put<{ location: BusinessLocation }>(
        `/business/locations/${vars.locationId}`,
        vars.input,
      );
      return data.location;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-locations'] });
      toast.success('Location updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update location');
    },
  });
}

export function useDeleteBusinessLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (locationId: string) => {
      const { data } = await api.delete(`/business/locations/${locationId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-locations'] });
      toast.success('Location removed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to remove location');
    },
  });
}
