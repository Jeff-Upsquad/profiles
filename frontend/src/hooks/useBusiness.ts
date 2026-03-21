import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { Profile, Category } from '@/types';
import toast from 'react-hot-toast';

export interface DiscoverParams {
  categorySlug: string;
  page?: number;
  search?: string;
  district?: string;
  min_salary?: number;
  max_salary?: number;
  min_experience?: number;
  max_experience?: number;
  sort_by?: 'newest' | 'experience_high' | 'experience_low' | 'salary_low' | 'salary_high';
}

export interface DiscoverResponse {
  profiles: Profile[];
  total: number;
  page: number;
  per_page: number;
}

export interface InterestRequest {
  id: string;
  business_user_id: string;
  talent_profile_id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  profile?: Profile;
  created_at: string;
  updated_at: string;
}

export function useDiscoverProfiles(params: DiscoverParams) {
  const { categorySlug, ...query } = params;
  return useQuery<DiscoverResponse>({
    queryKey: ['discover', categorySlug, query],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (query.page) searchParams.set('page', String(query.page));
      if (query.search) searchParams.set('search', query.search);
      if (query.district) searchParams.set('district', query.district);
      if (query.min_salary) searchParams.set('min_salary', String(query.min_salary));
      if (query.max_salary) searchParams.set('max_salary', String(query.max_salary));
      if (query.min_experience) searchParams.set('min_experience', String(query.min_experience));
      if (query.max_experience) searchParams.set('max_experience', String(query.max_experience));
      if (query.sort_by) searchParams.set('sort_by', query.sort_by);
      const qs = searchParams.toString();
      const { data } = await api.get(`/business/discover/${categorySlug}${qs ? `?${qs}` : ''}`);
      return data;
    },
    enabled: !!categorySlug,
  });
}

export function useDiscoverProfile(categorySlug: string, profileId: string | undefined) {
  return useQuery<Profile>({
    queryKey: ['discover-profile', categorySlug, profileId],
    queryFn: async () => {
      const { data } = await api.get(`/business/discover/${categorySlug}/${profileId}`);
      return data.profile ?? data;
    },
    enabled: !!categorySlug && !!profileId,
  });
}

export function useShortlist() {
  return useQuery<Profile[]>({
    queryKey: ['shortlist'],
    queryFn: async () => {
      const { data } = await api.get('/business/shortlist');
      return data.profiles ?? data;
    },
  });
}

export function useAddToShortlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      await api.post(`/business/shortlist/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      toast.success('Profile added to shortlist');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add to shortlist');
    },
  });
}

export function useRemoveFromShortlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      await api.delete(`/business/shortlist/${profileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shortlist'] });
      toast.success('Removed from shortlist');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to remove from shortlist');
    },
  });
}

export function useSendInterest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, message }: { profileId: string; message: string }) => {
      await api.post(`/business/interest/${profileId}`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interests'] });
      toast.success('Interest request sent');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to send interest request');
    },
  });
}

export function useMyInterests() {
  return useQuery<InterestRequest[]>({
    queryKey: ['interests'],
    queryFn: async () => {
      const { data } = await api.get('/business/interests');
      return data.interests ?? data;
    },
  });
}

export function useBusinessCategories() {
  return useQuery<Category[]>({
    queryKey: ['business-categories'],
    queryFn: async () => {
      const { data } = await api.get('/public/categories');
      return data.categories ?? data;
    },
  });
}
