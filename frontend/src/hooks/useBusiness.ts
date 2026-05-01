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

// ─── Invite-Only: Subscribed Categories & Shared Profiles ──────────────────

export function useMyCategories() {
  return useQuery<Category[]>({
    queryKey: ['my-categories'],
    queryFn: async () => {
      const { data } = await api.get('/business/my-categories');
      return data.categories ?? data;
    },
  });
}

export function useSharedProfiles(categoryId: string | undefined) {
  return useQuery<Profile[]>({
    queryKey: ['shared-profiles', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-categories/${categoryId}/profiles`);
      return data.profiles ?? data;
    },
    enabled: !!categoryId,
  });
}

export function useSharedProfile(categoryId: string | undefined, profileId: string | undefined) {
  return useQuery<Profile>({
    queryKey: ['shared-profile', categoryId, profileId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-categories/${categoryId}/profiles/${profileId}`);
      return data.profile ?? data;
    },
    enabled: !!categoryId && !!profileId,
  });
}

export function useBusinessPortfolio(categoryId: string | undefined, profileId: string | undefined) {
  return useQuery<any[]>({
    queryKey: ['business-portfolio', categoryId, profileId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-categories/${categoryId}/profiles/${profileId}/portfolio`);
      return data.items ?? data;
    },
    enabled: !!categoryId && !!profileId,
  });
}

// ─── Subscription cards (linked to this business via SquadHub publish) ─────

export interface BusinessSubscriptionCardSummary {
  id: string;
  external_id: string;
  brand_name: string | null;
  subscription_name: string | null;
  plan_name: string | null;
  customer_monthly_price: number | null;
  currency: string | null;
  status: 'active' | 'archived';
  published_at: string | null;
  category_ids: string[];
  counts: { accepted: number; pending: number; rejected: number; shortlisted: number };
}

export interface BusinessSubscriptionCardDetail {
  id: string;
  external_id: string;
  brand_name: string | null;
  subscription_name: string | null;
  plan_name: string | null;
  customer_monthly_price: number | null;
  currency: string | null;
  description: string | null;
  business_nature: string | null;
  hours_label: string | null;
  working_days: string[] | null;
  status: 'active' | 'archived';
  published_at: string | null;
  expires_at: string | null;
  category_ids: string[];
  categories: Array<{ id: string; name: string; slug: string }>;
}

export function useMySubscriptionCards() {
  return useQuery<BusinessSubscriptionCardSummary[]>({
    queryKey: ['my-subscription-cards'],
    queryFn: async () => {
      const { data } = await api.get('/business/my-subscription-cards');
      return data.cards ?? [];
    },
  });
}

export function useMySubscriptionCard(cardId: string | undefined) {
  return useQuery<BusinessSubscriptionCardDetail>({
    queryKey: ['my-subscription-card', cardId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-subscription-cards/${cardId}`);
      return data.card;
    },
    enabled: !!cardId,
  });
}

export function useShortlistedProfilesForCard(cardId: string | undefined) {
  return useQuery<Profile[]>({
    queryKey: ['my-subscription-card-shortlisted', cardId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-subscription-cards/${cardId}/shortlisted-profiles`);
      return data.profiles ?? [];
    },
    enabled: !!cardId,
  });
}

// ─── Talent Access (bridged via business user email) ────────────────────────

export interface TalentAccessStatus {
  has_access: boolean;
  email?: string;
  expires_at?: string;
  categories?: Array<{ id: string; name: string; slug: string }>;
}

export interface TalentAccessProfileFilters {
  category_id: string;
  tier?: string[];
  location?: string[];
  language?: string[];
  skill?: string[];
  ai_tool?: string[];
  search?: string;
  page?: number;
}

export function useBusinessTalentAccess() {
  return useQuery<TalentAccessStatus>({
    queryKey: ['business-talent-access-status'],
    queryFn: async () => {
      const { data } = await api.get('/business/talent-access/status');
      return data;
    },
  });
}

function appendCsv(params: URLSearchParams, key: string, values: string[] | undefined) {
  if (!values || values.length === 0) return;
  params.set(key, values.join(','));
}

export function useBusinessTalentAccessProfiles(filters: TalentAccessProfileFilters) {
  return useQuery({
    queryKey: ['business-talent-access-profiles', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('category_id', filters.category_id);
      appendCsv(params, 'tier', filters.tier);
      appendCsv(params, 'location', filters.location);
      appendCsv(params, 'language', filters.language);
      appendCsv(params, 'skill', filters.skill);
      appendCsv(params, 'ai_tool', filters.ai_tool);
      if (filters.search) params.set('search', filters.search);
      if (filters.page) params.set('page', String(filters.page));
      const { data } = await api.get(`/business/talent-access/profiles?${params.toString()}`);
      return data;
    },
    enabled: !!filters.category_id,
  });
}

export function useBusinessTalentAccessProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ['business-talent-access-profile', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/business/talent-access/profiles/${profileId}`);
      return data;
    },
    enabled: !!profileId,
  });
}

export function useBusinessTalentAccessFilterOptions(categoryId: string | undefined) {
  return useQuery({
    queryKey: ['business-talent-access-filter-options', categoryId],
    queryFn: async () => {
      const { data } = await api.get(`/business/talent-access/filter-options?category_id=${categoryId}`);
      return data;
    },
    enabled: !!categoryId,
  });
}
