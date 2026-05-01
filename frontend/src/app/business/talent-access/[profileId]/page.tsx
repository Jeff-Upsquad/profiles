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

  // Build a URLSearchParams that carries everything except ids/idx — these are
  // the parent list's filter state, used to navigate back without losing filters.
  const listParams = useMemo(() => {
    const sp = new URLSearchParams();
    searchParams.forEach((v, k) => {
      if (k !== 'ids' && k !== 'idx') sp.set(k, v);
    });
    return sp.toString();
  }, [searchParams]);

  const navigation = useMemo(() => {
    const idsParam = searchParams.get('ids');
    const idxParam = searchParams.get('idx');
    if (!idsParam || idxParam == null) return undefined;

    const ids = idsParam.split(',').filter(Boolean);
    const idx = parseInt(idxParam, 10);
    if (isNaN(idx) || ids.length === 0) return undefined;

    const buildHref = (targetIdx: number) => {
      const sp = new URLSearchParams(listParams);
      sp.set('ids', idsParam);
      sp.set('idx', String(targetIdx));
      return `/business/talent-access/${ids[targetIdx]}?${sp.toString()}`;
    };

    return {
      current: idx + 1,
      total: ids.length,
      onPrev: idx > 0 ? () => router.push(buildHref(idx - 1)) : null,
      onNext: idx < ids.length - 1 ? () => router.push(buildHref(idx + 1)) : null,
    };
  }, [searchParams, router, listParams]);

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
              tier: (data as any).tier ?? null,
              tier_custom: (data as any).tier_custom ?? null,
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
      error={
        status === 403
          ? 'You no longer have access to this profile.'
          : status && status !== 404
            ? (error as any)?.response?.data?.error || 'Failed to load profile'
            : undefined
      }
      onBack={() => router.push(`/business/talent-access${listParams ? `?${listParams}` : ''}`)}
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
