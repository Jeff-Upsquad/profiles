'use client';

import { Suspense, use, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBusinessTalentAccessProfile } from '@/hooks/useBusiness';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';

function ProfileContent({ profileId }: { profileId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useBusinessTalentAccessProfile(profileId);

  const status = (error as any)?.response?.status;

  const navigation = useMemo(() => {
    const idsParam = searchParams.get('ids');
    const idxParam = searchParams.get('idx');
    if (!idsParam || idxParam == null) return undefined;

    const ids = idsParam.split(',').filter(Boolean);
    const idx = parseInt(idxParam, 10);
    if (isNaN(idx) || ids.length === 0) return undefined;

    return {
      current: idx + 1,
      total: ids.length,
      onPrev: idx > 0
        ? () => {
            const sp = new URLSearchParams();
            sp.set('ids', idsParam);
            sp.set('idx', String(idx - 1));
            router.push(`/business/talent-access/${ids[idx - 1]}?${sp.toString()}`);
          }
        : null,
      onNext: idx < ids.length - 1
        ? () => {
            const sp = new URLSearchParams();
            sp.set('ids', idsParam);
            sp.set('idx', String(idx + 1));
            router.push(`/business/talent-access/${ids[idx + 1]}?${sp.toString()}`);
          }
        : null,
    };
  }, [searchParams, router]);

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
        age: data?.talent_user.age,
        gender: data?.talent_user.gender,
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
      navigation={navigation}
    />
  );
}

export default function BusinessTalentAccessProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = use(params);

  return (
    <Suspense>
      <ProfileContent profileId={profileId} />
    </Suspense>
  );
}
