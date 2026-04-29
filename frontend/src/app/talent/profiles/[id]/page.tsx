'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile, usePortfolioItems } from '@/hooks/useProfiles';
import { useCategoryWithFields } from '@/hooks/useCategories';
import { useTalentMe } from '@/hooks/useTalentMe';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';

interface Params {
  id: string;
}

export default function ViewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile(params.id);
  const { data: talentMe } = useTalentMe();
  const { data: categoryWithFields } = useCategoryWithFields(profile?.category?.slug);
  const { data: portfolioItems } = usePortfolioItems(params.id);

  const talentUser = {
    full_name: talentMe?.full_name ?? 'Unknown',
    current_location: talentMe?.current_location,
    profile_photo_url: talentMe?.profile_photo_url,
    languages_spoken: talentMe?.languages_spoken,
  };

  if (profile?.is_ghost) {
    return (
      <GhostProfileView
        ghostProfile={profile}
        sourceProfiles={profile.source_profiles ?? []}
        talentUser={talentUser}
        mode="talent"
        isLoading={profileLoading}
        error={profileError ? 'Failed to load profile' : undefined}
        onBack={() => router.push('/talent/profiles')}
      />
    );
  }

  return (
    <ThreadsProfileView
      profile={profile ?? null}
      talentUser={talentUser}
      category={categoryWithFields ?? null}
      portfolioItems={portfolioItems}
      mode="talent"
      editProfileHref={`/talent/profiles/${params.id}/edit`}
      isLoading={profileLoading}
      error={profileError ? 'Failed to load profile' : undefined}
      onBack={() => router.push('/talent/profiles')}
    />
  );
}
