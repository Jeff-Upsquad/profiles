'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import { useCategoryWithFields } from '@/hooks/useCategories';

interface Props {
  token: string;
  memberId: string;
}

export default function AgencyMemberPublicShareView({ token, memberId }: Props) {
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['agencyPublicShareMember', token, memberId],
    queryFn: () => agencyApi.getPublicShareMember(token, memberId),
    retry: 1,
  });

  const member = (data as any)?.member;
  const profiles = (data as any)?.member_profiles ?? [];
  const primaryProfile = profiles[0] ?? null;
  const { data: category } = useCategoryWithFields(primaryProfile?.category?.slug);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
        <p className="mt-3 text-xs text-[#737373]">Loading squad member...</p>
      </div>
    );
  }

  const isExpired =
    (error as any)?.response?.status === 410 ||
    ((error as any)?.response?.data?.message || '').toLowerCase().includes('expired');

  if (error || !member) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#E7E7EA] bg-white p-8 text-center shadow-xs">
          <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
            {isExpired ? 'This preview link has expired' : 'Member not found'}
          </h1>
          <p className="mt-2 text-xs text-[#737373]">
            {isExpired
              ? 'The link validity has ended. Please request a new link.'
              : ((error as any)?.response?.data?.message || 'Could not load member details.')}
          </p>
          <button
            onClick={() => router.push(`/share/agency/${token}`)}
            className="mt-4 inline-flex items-center rounded-xl bg-[#0a0a0a] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Back to Agency
          </button>
        </div>
      </div>
    );
  }

  const talentUser = {
    full_name: member.full_name || 'Squad Member',
    current_location: member.current_location,
    profile_photo_url: member.profile_photo_url || member.profile_picture_url,
    languages_spoken: member.languages_spoken,
    age: member.age,
    gender: member.gender,
  };

  const adaptedProfile = primaryProfile
    ? ({
        id: primaryProfile.id,
        user_id: member.id,
        category_id: primaryProfile.category_id,
        status: primaryProfile.status,
        field_data: primaryProfile.field_data || {},
        created_at: primaryProfile.created_at,
        updated_at: primaryProfile.updated_at,
      } as any)
    : null;

  const displayProfile = adaptedProfile || {
    id: member.id,
    user_id: member.id,
    category_id: '',
    status: 'draft' as const,
    field_data: {},
    created_at: member.created_at,
    updated_at: member.updated_at,
  };

  const displayCategory = category
    ? {
        ...category,
        fields: (category as any).fields || (category as any).category_fields || [],
      }
    : ({ id: '', name: '', slug: '', fields: [] } as any);

  const portfolioItems = (data as any)?.portfolio_items ?? [];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-screen bg-[#FAFAFA]">
      <ThreadsProfileView
        profile={displayProfile}
        talentUser={talentUser}
        category={displayCategory}
        portfolioItems={portfolioItems as any}
        mode="business"
        isLoading={false}
        onBack={() => router.push(`/share/agency/${token}`)}
      />
      {profiles.length > 1 && (
        <div className="mx-auto max-w-[630px] px-4 pb-8">
          <h3 className="mt-4 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            All Job Profiles for {member.full_name}
          </h3>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {profiles.map((p: any) => (
              <div
                key={p.id}
                className="aspect-square rounded-lg border border-[#E7E7EA] bg-white p-3 flex flex-col justify-between"
              >
                <div className="text-xs font-medium text-[#0a0a0a]">
                  {(p.category as any)?.name || p.category_id?.slice(0, 8)}
                </div>
                <div className="text-[11px] text-[#737373]">{p.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
