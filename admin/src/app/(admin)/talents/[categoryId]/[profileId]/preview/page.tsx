'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';
import type {
  CategoryField,
  CategoryWithFields,
  GhostSourceProfile,
  PortfolioItem,
  Profile,
} from '@/types';

interface AdminProfileResponse {
  id: string;
  category_id: string;
  status: Profile['status'];
  field_data: Record<string, any>;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  talent_user_id?: string;
  is_ghost?: boolean;
  source_profiles?: GhostSourceProfile[];
  talent_users?: {
    full_name: string;
    phone?: string;
    age?: number;
    gender?: string;
    current_location?: string;
    native_place?: string;
    languages_spoken?: { language: string; proficiency: string }[];
    profile_photo_url?: string;
  };
  categories?: { id?: string; name: string; slug: string };
  portfolio_items?: PortfolioItem[];
}

export default function TalentProfilePreviewPage(props: {
  params: Promise<{ categoryId: string; profileId: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();

  const { data: profileRaw, isLoading: profileLoading, error: profileError } = useQuery<AdminProfileResponse>({
    queryKey: ['talent-profile', params.profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/profiles/${params.profileId}`);
      return data.profile ?? data;
    },
    enabled: !!params.profileId,
  });

  const { data: fields, isLoading: fieldsLoading } = useQuery<CategoryField[]>({
    queryKey: ['category-fields', profileRaw?.category_id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/categories/${profileRaw!.category_id}/fields`);
      return data.fields ?? data;
    },
    enabled: !!profileRaw?.category_id,
  });

  const profile = useMemo<(Profile & { rejection_reason?: string }) | null>(() => {
    if (!profileRaw) return null;
    return {
      id: profileRaw.id,
      user_id: profileRaw.talent_user_id ?? '',
      category_id: profileRaw.category_id,
      status: profileRaw.status,
      field_data: profileRaw.field_data ?? {},
      rejection_reason: profileRaw.rejection_reason,
      created_at: profileRaw.created_at,
      updated_at: profileRaw.updated_at,
    };
  }, [profileRaw]);

  const category = useMemo<CategoryWithFields | null>(() => {
    if (!profileRaw?.categories) return null;
    return {
      id: profileRaw.categories.id ?? profileRaw.category_id,
      name: profileRaw.categories.name,
      slug: profileRaw.categories.slug,
      is_active: true,
      created_at: '',
      updated_at: '',
      fields: fields ?? [],
    };
  }, [profileRaw, fields]);

  const talentUser = {
    full_name: profileRaw?.talent_users?.full_name ?? 'Unknown',
    current_location: profileRaw?.talent_users?.current_location,
    profile_photo_url: profileRaw?.talent_users?.profile_photo_url,
    languages_spoken: profileRaw?.talent_users?.languages_spoken,
    age: profileRaw?.talent_users?.age,
    gender: profileRaw?.talent_users?.gender,
  };

  const isGhost = profileRaw?.is_ghost === true;

  if (isGhost) {
    return (
      <GhostProfileView
        ghostProfile={profile}
        sourceProfiles={profileRaw?.source_profiles ?? []}
        talentUser={talentUser}
        mode="admin"
        isLoading={profileLoading}
        error={profileError ? 'Failed to load profile' : undefined}
        onBack={() => router.push(`/talents/${params.categoryId}/${params.profileId}`)}
      />
    );
  }

  return (
    <ThreadsProfileView
      profile={profile}
      talentUser={talentUser}
      category={category}
      portfolioItems={profileRaw?.portfolio_items}
      mode="admin"
      isLoading={profileLoading || (!!profileRaw?.category_id && fieldsLoading)}
      error={profileError ? 'Failed to load profile' : undefined}
      onBack={() => router.push(`/talents/${params.categoryId}/${params.profileId}`)}
    />
  );
}
