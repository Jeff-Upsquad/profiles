'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  useTalentAccessProfile,
  useTalentAccessSession,
  clearSession,
} from '@/hooks/useTalentAccess';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import TalentAccessLogin from '@/views/talent-access/TalentAccessLogin';

export default function TalentAccessProfileDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const router = useRouter();
  const { profileId } = use(params);
  const { meta, ready } = useTalentAccessSession();
  const { data, isLoading, error } = useTalentAccessProfile(
    meta ? profileId : undefined,
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      </div>
    );
  }

  if (!meta) {
    return <TalentAccessLogin onSuccess={() => router.refresh()} />;
  }

  // 403 here means the profile's category is no longer in the grant.
  // 401 means the session is gone — interceptor already cleared storage.
  const status = (error as any)?.response?.status;
  if (status === 401) {
    clearSession();
    return <TalentAccessLogin onSuccess={() => router.refresh()} />;
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
      onBack={() => router.push('/talent-access')}
    />
  );
}
