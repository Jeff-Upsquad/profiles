'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useCandidateProfile } from '@/hooks/useBusinessJobs';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';

// Full talent profile for a job candidate — access rule server-side: the
// candidate applied to YOUR card (no talent-access session or shared-profile
// grant needed). Mirrors the talent-access profile page's rendering.

function CandidateProfileContent({ cardId, candidateId }: { cardId: string; candidateId: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useCandidateProfile(cardId, candidateId);

  const status = (error as any)?.response?.status;
  const errorMessage = error
    ? status === 404
      ? 'This candidate has no viewable profile.'
      : 'Could not load the profile — please try again.'
    : undefined;

  const onBack = () => router.push(`/business/job-posts/${cardId}`);

  if (data?.is_ghost) {
    return (
      <GhostProfileView
        ghostProfile={{
          id: data.profile.id,
          user_id: data.talent_user.id,
          category_id: data.profile.category_id,
          status: data.profile.status as any,
          field_data: data.profile.field_data,
          created_at: data.profile.created_at,
          updated_at: data.profile.updated_at,
          tier: data.tier ?? null,
          tier_custom: data.tier_custom ?? null,
        }}
        sourceProfiles={data.source_profiles ?? []}
        talentUser={{
          full_name: data.talent_user.full_name ?? '',
          current_location: data.talent_user.current_location ?? undefined,
          profile_photo_url: data.talent_user.profile_photo_url ?? undefined,
          languages_spoken: data.talent_user.languages_spoken ?? [],
          age: data.talent_user.age,
          gender: data.talent_user.gender,
        }}
        mode="business"
        isLoading={isLoading}
        error={errorMessage}
        onBack={onBack}
      />
    );
  }

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
              tier: data.tier ?? null,
              tier_custom: data.tier_custom ?? null,
            }
          : null
      }
      talentUser={{
        full_name: data?.talent_user.full_name ?? '',
        current_location: data?.talent_user.current_location ?? undefined,
        profile_photo_url: data?.talent_user.profile_photo_url ?? undefined,
        languages_spoken: data?.talent_user.languages_spoken ?? [],
        age: data?.talent_user.age,
        gender: data?.talent_user.gender,
        country: data?.talent_user.country ?? null,
        state: data?.talent_user.state ?? null,
        current_district: data?.talent_user.current_district ?? null,
        city: data?.talent_user.city ?? null,
      }}
      category={data?.category ?? null}
      portfolioItems={data?.portfolio_items ?? []}
      mode="business"
      isLoading={isLoading}
      error={errorMessage}
      onBack={onBack}
    />
  );
}

export default function BusinessJobCandidateProfilePage({
  params,
}: {
  params: Promise<{ cardId: string; candidateId: string }>;
}) {
  const { cardId, candidateId } = use(params);
  return <CandidateProfileContent cardId={cardId} candidateId={candidateId} />;
}
