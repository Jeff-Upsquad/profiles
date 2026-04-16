'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useSharedProfile, useBusinessPortfolio, useAddToShortlist, useSendInterest } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';

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

  const addToShortlist = useAddToShortlist();
  const sendInterest = useSendInterest();

  const talentUser = {
    full_name: (profile as any)?.talent_user?.full_name ?? 'Unknown',
    current_location: (profile as any)?.talent_user?.current_location,
    profile_photo_url: (profile as any)?.talent_user?.profile_photo_url,
    languages_spoken: (profile as any)?.talent_user?.languages_spoken,
  };

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
      onBack={() => router.push(`/business/dashboard/${params.categoryId}`)}
    />
  );
}
