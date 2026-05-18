'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import taApi, {
  TALENT_ACCESS_TOKEN_KEY,
  TALENT_ACCESS_META_KEY,
} from '@/services/talent-access-api';

// ── Types ──────────────────────────────────────────────

export type Tier = 'junior' | 'pro' | 'elite' | 'Top Talents' | 'custom';

export interface AccessCategory {
  id: string;
  name: string;
  slug: string;
}

export interface AccessSessionMeta {
  email: string;
  expires_at: string;
  categories: AccessCategory[];
}

export interface LoginResponse {
  access_token: string;
  expires_at: string;
  email: string;
  categories: AccessCategory[];
}

export interface ProfileCardSummary {
  id: string;
  full_name: string;
  profile_photo_url: string | null;
  current_location: string | null;
  languages_spoken: { language: string; proficiency?: string }[];
  age?: number | null;
  gender?: string | null;
  years_experience?: number | null;
  tier: Tier | null;
  tier_custom: string | null;
  top_skills: string[];
  category: AccessCategory;
}

export interface ProfilesResponse {
  profiles: ProfileCardSummary[];
  page: number;
  per_page: number;
  total: number;
}

export interface FilterOptions {
  tiers: Tier[];
  /** Free-text current_location filter (legacy). */
  locations: string[];
  /** Structured location facets sourced from talent_profiles_basic. */
  countries: string[];
  states: string[];
  districts: string[];
  languages: string[];
  skills: string[];
  tools: string[];
  ai_tools: string[];
}

export interface ProfileDetailResponse {
  profile: {
    id: string;
    category_id: string;
    status: string;
    field_data: Record<string, any>;
    resume_url: string | null;
    created_at: string;
    updated_at: string;
  };
  talent_user: {
    id: string;
    full_name: string;
    profile_photo_url: string | null;
    current_location: string | null;
    native_place: string | null;
    country?: string | null;
    state?: string | null;
    current_district?: string | null;
    city?: string | null;
    pin_code?: string | null;
    permanent_address?: string | null;
    age: number | null;
    gender: string | null;
    languages_spoken: { language: string; proficiency: string }[];
  };
  category: any; // CategoryWithFields-shaped (fields[] populated)
  portfolio_items: {
    id: string;
    profile_id: string;
    skill_name: string;
    file_url: string;
    file_type: 'image' | 'pdf' | 'video';
    file_name: string;
    sort_order: number;
  }[];
  tier: Tier | null;
  tier_custom: string | null;
}

export interface ProfileFilters {
  category_id: string;
  tier?: Tier[];
  location?: string[];
  language?: string[];
  skill?: string[];
  ai_tool?: string[];
  search?: string;
  page?: number;
}

// ── Local session storage helpers ──────────────────────

function readMeta(): AccessSessionMeta | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(TALENT_ACCESS_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccessSessionMeta;
  } catch {
    return null;
  }
}

function persistSession(token: string, meta: AccessSessionMeta) {
  localStorage.setItem(TALENT_ACCESS_TOKEN_KEY, token);
  localStorage.setItem(TALENT_ACCESS_META_KEY, JSON.stringify(meta));
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TALENT_ACCESS_TOKEN_KEY);
  localStorage.removeItem(TALENT_ACCESS_META_KEY);
}

/**
 * Reads the current session from localStorage and re-renders if it changes.
 * Returns null until mounted client-side (avoids SSR hydration mismatch).
 */
export function useTalentAccessSession(): {
  meta: AccessSessionMeta | null;
  ready: boolean;
} {
  const [ready, setReady] = useState(false);
  const [meta, setMeta] = useState<AccessSessionMeta | null>(null);

  useEffect(() => {
    setMeta(readMeta());
    setReady(true);

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === TALENT_ACCESS_META_KEY ||
        e.key === TALENT_ACCESS_TOKEN_KEY
      ) {
        setMeta(readMeta());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { meta, ready };
}

// ── Mutations + queries ────────────────────────────────

export function useTalentAccessLogin() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await taApi.post<LoginResponse>('/login', { email });
      const meta: AccessSessionMeta = {
        email: data.email,
        expires_at: data.expires_at,
        categories: data.categories,
      };
      persistSession(data.access_token, meta);
      // Notify same-tab listeners (the storage event only fires cross-tab).
      window.dispatchEvent(
        new StorageEvent('storage', { key: TALENT_ACCESS_META_KEY }),
      );
      return data;
    },
  });
}

export function useTalentAccessMe() {
  return useQuery<AccessSessionMeta>({
    queryKey: ['talent-access', 'me'],
    queryFn: async () => {
      const { data } = await taApi.get<AccessSessionMeta>('/me');
      return data;
    },
  });
}

function appendCsv(
  params: URLSearchParams,
  key: string,
  values: string[] | undefined,
) {
  if (!values || values.length === 0) return;
  params.set(key, values.join(','));
}

export function useTalentAccessProfiles(filters: ProfileFilters) {
  return useQuery<ProfilesResponse>({
    queryKey: ['talent-access', 'profiles', filters],
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
      const { data } = await taApi.get<ProfilesResponse>(
        `/profiles?${params.toString()}`,
      );
      return data;
    },
    enabled: !!filters.category_id,
  });
}

export function useTalentAccessProfile(profileId: string | undefined) {
  return useQuery<ProfileDetailResponse>({
    queryKey: ['talent-access', 'profile', profileId],
    queryFn: async () => {
      const { data } = await taApi.get<ProfileDetailResponse>(
        `/profiles/${profileId}`,
      );
      return data;
    },
    enabled: !!profileId,
  });
}

export function useTalentAccessFilterOptions(categoryId: string | undefined) {
  return useQuery<FilterOptions>({
    queryKey: ['talent-access', 'filter-options', categoryId],
    queryFn: async () => {
      const { data } = await taApi.get<FilterOptions>(
        `/filter-options?category_id=${categoryId}`,
      );
      return data;
    },
    enabled: !!categoryId,
  });
}
