'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useDiscoverProfile, useAddToShortlist, useSendInterest, useBusinessPortfolio } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';

interface Params {
  slug: string;
  id: string;
}

export default function ViewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: profile, isLoading: profileLoading, error: profileError } = useDiscoverProfile(params.slug, params.id);
  const { data: categoryWithFields } = useCategoryWithFields(params.slug);
  const categoryId = profile?.category_id ?? (categoryWithFields as any)?.id;
  const { data: portfolioItems } = useBusinessPortfolio(categoryId, params.id);
  const addToShortlist = useAddToShortlist();
  const sendInterest = useSendInterest();

  const talentUser = {
    full_name: (profile as any)?.talent_user?.full_name ?? 'Unknown',
    current_location: (profile as any)?.talent_user?.current_location,
    profile_photo_url: (profile as any)?.talent_user?.profile_photo_url,
    languages_spoken: (profile as any)?.talent_user?.languages_spoken,
  };

  // Ghost profiles ("Designer + Editor") have no field_data of their own —
  // they point to two source profiles (Designer + Video Editor). The
  // backend embeds those sources (with their portfolios) in the response.
  // We render them via GhostProfileView, which adds a tab switcher.
  const isGhost = (profile as any)?.is_ghost === true;
  const sourceProfiles = (profile as any)?.source_profiles ?? [];

  if (isGhost) {
    return (
      <GhostProfileView
        ghostProfile={profile ?? null}
        sourceProfiles={sourceProfiles}
        talentUser={talentUser}
        mode="business"
        onShortlist={() => profile && addToShortlist.mutate(profile.id)}
        shortlistLoading={addToShortlist.isPending}
        onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
        interestLoading={sendInterest.isPending}
        isLoading={profileLoading}
        error={profileError ? 'Failed to load profile' : undefined}
        onBack={() => router.push(`/business/discover/${params.slug}`)}
      />
    );
  }

  return (
    <ThreadsProfileView
      profile={profile ?? null}
      talentUser={talentUser}
      category={categoryWithFields ?? null}
      portfolioItems={portfolioItems}
      mode="business"
      onShortlist={() => profile && addToShortlist.mutate(profile.id)}
      shortlistLoading={addToShortlist.isPending}
      onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
      interestLoading={sendInterest.isPending}
      isLoading={profileLoading}
      error={profileError ? 'Failed to load profile' : undefined}
      onBack={() => router.push(`/business/discover/${params.slug}`)}
    />
  );
}
