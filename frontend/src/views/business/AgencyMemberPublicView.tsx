'use client';

import { useRouter } from 'next/navigation';
import { useAgencyMemberPublicView } from '@/hooks/useAgencyPublicView';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import { useCategoryWithFields } from '@/hooks/useCategories';

export default function AgencyMemberPublicView({ agencyId, memberId }: { agencyId: string; memberId: string }) {
  const router = useRouter();
  const { data, isLoading, error } = useAgencyMemberPublicView(agencyId, memberId);
  const member = (data as any)?.member;
  const profiles = (data as any)?.member_profiles ?? [];
  const primaryProfile = profiles[0] ?? null;
  const { data: category } = useCategoryWithFields(primaryProfile?.category?.slug);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }
  if (error || !member) {
    return (
      <div className="mx-auto max-w-[630px] px-4 py-10 text-center">
        <p className="text-sm text-red-600">{(error as any)?.message || 'Member not found'}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-[#0a0a0a] hover:underline">Go back</button>
      </div>
    );
  }

  const talentUser = {
    full_name: member.full_name || 'Talent',
    current_location: member.current_location,
    profile_photo_url: member.profile_photo_url || member.profile_picture_url,
    languages_spoken: member.languages_spoken,
    age: member.age,
    gender: member.gender,
  };

  const adaptedProfile = primaryProfile ? {
    id: primaryProfile.id,
    user_id: member.id,
    category_id: primaryProfile.category_id,
    status: primaryProfile.status,
    field_data: primaryProfile.field_data || {},
    created_at: primaryProfile.created_at,
    updated_at: primaryProfile.updated_at,
  } as any : null;

  const displayProfile = adaptedProfile || {
    id: member.id,
    user_id: member.id,
    category_id: '',
    status: 'draft' as const,
    field_data: {},
    created_at: member.created_at,
    updated_at: member.updated_at,
  };

  const displayCategory = category ? {
    ...category,
    fields: (category as any).fields || (category as any).category_fields || [],
  } : { id: '', name: '', slug: '', fields: [] } as any;

  const portfolioItems = (data as any)?.portfolio_items ?? [];

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <ThreadsProfileView
        profile={displayProfile}
        talentUser={talentUser}
        category={displayCategory}
        portfolioItems={portfolioItems as any}
        mode="business"
        isLoading={false}
        onBack={() => router.push(`/business/agency-view/${agencyId}${typeof window !== 'undefined' ? window.location.search : ''}`)}
      />
      {profiles.length > 1 && (
        <div className="mx-auto max-w-[630px] px-4 pb-8">
          <h3 className="mt-4 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">All Job Profiles for {member.full_name}</h3>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {profiles.map((p: any) => (
              <div key={p.id} className="aspect-square rounded-lg border border-[#E7E7EA] bg-white p-3 flex flex-col justify-between">
                <div className="text-xs font-medium text-[#0a0a0a]">{(p.category as any)?.name || p.category_id.slice(0,8)}</div>
                <div className="text-[11px] text-[#737373]">{p.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
