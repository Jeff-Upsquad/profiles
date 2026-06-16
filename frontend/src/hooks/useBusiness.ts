import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { Profile, Category } from '@/types';
import toast from 'react-hot-toast';

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
  /** Partner skill bracket — Junior/Pro/Elite (a.k.a. Top Talents) — rendered alongside
   *  plan_name on the card row. Null on legacy rows that predate the
   *  SquadHub fix that sends this field. */
  plan_tier: string | null;
  customer_monthly_price: number | null;
  currency: string | null;
  status: 'active' | 'assigned' | 'archived';
  published_at: string | null;
  /** Set when SquadHub recalled an already-accepted card. The card stays in
   *  the Open section but renders a "Recalled" tag. */
  recalled_at: string | null;
  category_ids: string[];
  /** Tiers this card covers. A multi-tier brief is collapsed server-side into
   *  one card spanning several tiers; single-tier cards have one entry. */
  tiers?: string[];
  /** True when this row represents a multi-tier brief (several tier siblings
   *  collapsed into one card). customer_monthly_price is then the lowest tier. */
  is_group?: boolean;
  counts: { accepted: number; pending: number; rejected: number; shortlisted: number; for_review: number; selected: number };
}

export interface BusinessSubscriptionCardDetail {
  id: string;
  external_id: string;
  brand_name: string | null;
  subscription_name: string | null;
  plan_name: string | null;
  plan_tier: string | null;
  customer_company: string | null;
  customer_location: string | null;
  customer_monthly_price: number | null;
  currency: string | null;
  description: string | null;
  business_nature: string | null;
  hours_label: string | null;
  working_days: string[] | null;
  target_tiers: string[];
  target_languages: string[];
  target_regions: Array<{ country_id: string; region: string }>;
  custom_deliverables: Array<{
    id?: string;
    name: string;
    kind: string;
    per_day?: number;
    per_week?: number;
    per_month?: number;
  }>;
  status: 'active' | 'assigned' | 'archived';
  recalled_at: string | null;
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

// ─── Per-Card Talent Review ─────────────────────────────────────────────────

export interface CardRecipientForBusiness {
  recipient_id: string;
  talent_user_id: string;
  talent_name: string | null;
  profile_photo_url: string | null;
  current_location: string | null;
  languages_spoken: any;
  profile_id: string | null;
  category: { id: string; name: string; slug: string } | null;
  tier: string | null;
  tier_custom: string | null;
  /** The tier card this talent was matched into (for multi-tier briefs). */
  card_id?: string;
  /** Proposed monthly price of this talent's tier card — shown to the business. */
  proposed_price?: number | null;
  currency?: string | null;
  business_review_status: 'shortlisted' | 'rejected' | null;
  business_reviewed_at: string | null;
  selected_at: string | null;
  passed_over_at: string | null;
  responded_at: string | null;
}

export function useCardRecipients(cardId: string | undefined) {
  return useQuery<CardRecipientForBusiness[]>({
    queryKey: ['card-recipients', cardId],
    queryFn: async () => {
      const { data } = await api.get(`/business/my-subscription-cards/${cardId}/recipients`);
      return data.recipients ?? [];
    },
    enabled: !!cardId,
  });
}

export function useReviewCardRecipient(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ recipientId, action }: { recipientId: string; action: 'shortlist' | 'reject' | 'unshortlist' }) => {
      await api.post(`/business/my-subscription-cards/${cardId}/recipients/${recipientId}/review`, { action });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-recipients', cardId] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-cards'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to review recipient');
    },
  });
}

export function useSelectCardRecipient(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      await api.post(`/business/my-subscription-cards/${cardId}/select`, { recipient_id: recipientId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card-recipients', cardId] });
      queryClient.invalidateQueries({ queryKey: ['my-subscription-cards'] });
      toast.success('Talent selected successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to select talent');
    },
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
  /** Structured location facets — talent_profiles_basic.country/state/current_district. */
  country?: string[];
  state?: string[];
  district?: string[];
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
      appendCsv(params, 'country', filters.country);
      appendCsv(params, 'state', filters.state);
      appendCsv(params, 'district', filters.district);
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
