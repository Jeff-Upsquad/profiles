'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useBusinessTalentAccessProfile } from '@/hooks/useBusiness';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';

export default function BusinessTalentAccessProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const router = useRouter();
  const { profileId } = use(params);
  const { data, isLoading, error } = useBusinessTalentAccessProfile(profileId);

  const status = (error as any)?.response?.status;

  return (
    <ThreadsProfileView
      profile={
        data
          ? {
              id: data.profile.id,
              user_id: data.talent_user.id,
              category_id: data.profile.category_id,
              status: data.profile.status as any,
              field_data: data.profile.field_data,
              created_at: data.profile.created_at,
              updated_at: data.profile.updated_at,
            }
          : null
      }
      talentUser={{
        full_name: data?.talent_user.full_name ?? '',
        current_location: data?.talent_user.current_location ?? undefined,
        profile_photo_url: data?.talent_user.profile_photo_url ?? undefined,
        languages_spoken: data?.talent_user.languages_spoken ?? [],
      }}
      category={data?.category ?? null}
      portfolioItems={data?.portfolio_items ?? []}
      mode="business"
      isLoading={isLoading}
      error={
        status === 403
          ? 'You no longer have access to this profile.'
          : status && status !== 404
            ? (error as any)?.response?.data?.error || 'Failed to load profile'
            : undefined
      }
      onBack={() => router.push('/business/talent-access')}
    />
  );
}
