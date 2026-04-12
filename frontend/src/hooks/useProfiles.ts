import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { Profile, PortfolioItem } from '@/types';
import toast from 'react-hot-toast';

export function useMyProfiles() {
  return useQuery<Profile[]>({
    queryKey: ['myProfiles'],
    queryFn: async () => {
      const { data } = await api.get('/talent/profiles');
      return data.profiles ?? data;
    },
  });
}

export function useProfile(id: string | undefined) {
  return useQuery<Profile>({
    queryKey: ['profile', id],
    queryFn: async () => {
      const { data } = await api.get(`/talent/profiles/${id}`);
      return data.profile ?? data;
    },
    enabled: !!id,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { category_id: string; field_data: Record<string, any> }) => {
      const { data } = await api.post('/talent/profiles', payload);
      return data.profile ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      toast.success('Profile created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create profile');
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field_data }: { id: string; field_data: Record<string, any> }) => {
      const { data } = await api.put(`/talent/profiles/${id}`, { field_data });
      return data.profile ?? data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', variables.id] });
      toast.success('Profile updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    },
  });
}

export function useSubmitProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/talent/profiles/${id}/submit`);
      return data.profile ?? data;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['profile', id] });
      toast.success('Profile submitted for review');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit profile');
    },
  });
}

export function useDeactivateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/talent/profiles/${id}/deactivate`);
      return data.profile ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      toast.success('Profile deactivated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to deactivate profile');
    },
  });
}

export function useReactivateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/talent/profiles/${id}/reactivate`);
      return data.profile ?? data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      toast.success('Profile reactivated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reactivate profile');
    },
  });
}

// ---------------------------------------------------------------------------
// Portfolio Items
// ---------------------------------------------------------------------------

export function usePortfolioItems(profileId: string | undefined) {
  return useQuery<PortfolioItem[]>({
    queryKey: ['portfolio', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/talent/profiles/${profileId}/portfolio`);
      return data.items ?? data;
    },
    enabled: !!profileId,
  });
}

export function useAddPortfolioItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      ...item
    }: {
      profileId: string;
      skill_name: string;
      file_url: string;
      file_type: string;
      file_name: string;
    }) => {
      const { data } = await api.post(`/talent/profiles/${profileId}/portfolio`, item);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.profileId] });
      toast.success('Portfolio item added');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add portfolio item');
    },
  });
}

export function useDeletePortfolioItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, itemId }: { profileId: string; itemId: string }) => {
      await api.delete(`/talent/profiles/${profileId}/portfolio/${itemId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', variables.profileId] });
      toast.success('Portfolio item removed');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to remove portfolio item');
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/talent/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfiles'] });
      toast.success('Profile deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to delete profile');
    },
  });
}
