'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  useSharedProfile,
  useBusinessPortfolio,
  useAddToShortlist,
  useRemoveFromShortlist,
  useShortlist,
  useSendInterest,
} from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';

interface Params {
  categoryId: string;
  id: string;
}

export default function DashboardProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: profile, isLoading: profileLoading, error: profileError } = useSharedProfile(params.categoryId, params.id);
  const { data: portfolioItems } = useBusinessPortfolio(params.categoryId, params.id);

  const categorySlug = (profile as any)?.category?.slug;
  const { data: categoryWithFields } = useCategoryWithFields(categorySlug);

  const { data: shortlist } = useShortlist();
  const addToShortlist = useAddToShortlist();
  const removeFromShortlist = useRemoveFromShortlist();
  const sendInterest = useSendInterest();

  const isShortlisted = !!profile && (shortlist ?? []).some((p) => p.id === profile.id);

  const talentUser = {
    full_name: (profile as any)?.talent_user?.full_name ?? 'Unknown',
    current_location: (profile as any)?.talent_user?.current_location,
    profile_photo_url: (profile as any)?.talent_user?.profile_photo_url,
    languages_spoken: (profile as any)?.talent_user?.languages_spoken,
  };

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
        onUnshortlist={() => profile && removeFromShortlist.mutate(profile.id)}
        shortlistLoading={addToShortlist.isPending || removeFromShortlist.isPending}
        isShortlisted={isShortlisted}
        onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
        interestLoading={sendInterest.isPending}
        isLoading={profileLoading}
        error={profileError ? 'Failed to load profile' : undefined}
        onBack={() => router.push(`/business/dashboard/${params.categoryId}`)}
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
      onUnshortlist={() => profile && removeFromShortlist.mutate(profile.id)}
      shortlistLoading={addToShortlist.isPending || removeFromShortlist.isPending}
      isShortlisted={isShortlisted}
      onSendInterest={(message) => profile && sendInterest.mutate({ profileId: profile.id, message })}
      interestLoading={sendInterest.isPending}
      isLoading={profileLoading}
      error={profileError ? 'Failed to load profile' : undefined}
      onBack={() => router.push(`/business/dashboard/${params.categoryId}`)}
    />
  );
}
