'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useDiscoverProfile, useAddToShortlist, useSendInterest } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';

interface Params {
  slug: string;
  id: string;
}

export default function ViewProfilePage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: profile, isLoading: profileLoading, error: profileError } = useDiscoverProfile(params.slug, params.id);
  const { data: categoryWithFields } = useCategoryWithFields(params.slug);
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
