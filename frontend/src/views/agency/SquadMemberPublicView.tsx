'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { agencyApi } from '@/services/agency-api';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import { useCategoryWithFields } from '@/hooks/useCategories';

export default function SquadMemberPublicView({ memberId }: { memberId: string }){
  const router = useRouter();
  const { data: squad=[] } = useQuery({ queryKey:['agencySquad'], queryFn: agencyApi.listSquad });
  const member = (squad as any[]).find((m:any)=> m.id===memberId);
  const { data: profiles=[] } = useQuery({ queryKey:['agencyMemberProfiles'], queryFn: agencyApi.listMemberProfiles });
  const memberProfiles = (profiles as any[]).filter((p:any)=> p.squad_member_id===memberId);
  // Use first job profile as primary for public view, like talent
  const primaryProfile = memberProfiles[0] || null;
  const { data: category } = useCategoryWithFields(primaryProfile?.category?.slug);
  const { data: portfolioData } = useQuery({ queryKey:['agencyTotal'], queryFn: agencyApi.total });
  const portfolioItems = ((portfolioData as any)?.portfolio_items||[]).filter((it:any)=> memberProfiles.some((p:any)=> p.id===it.member_profile_id));

  // Map squad member to talentUser shape expected by ThreadsProfileView
  const talentUser = {
    full_name: member?.full_name || 'Talent',
    current_location: member?.current_location,
    profile_photo_url: member?.profile_photo_url || member?.profile_picture_url,
    languages_spoken: member?.languages_spoken,
    age: member?.age,
    gender: member?.gender,
  };

  // Adapt squad job profile to Profile shape
  const adaptedProfile = primaryProfile ? {
    id: primaryProfile.id,
    user_id: memberId,
    category_id: primaryProfile.category_id,
    category: primaryProfile.category,
    status: primaryProfile.status,
    field_data: primaryProfile.field_data || {},
    created_at: primaryProfile.created_at,
    updated_at: primaryProfile.updated_at,
    is_ghost: false,
  } as any : null;

  const adaptedCategory = category ? {
    ...category,
    fields: (category as any).fields || (category as any).category_fields || [],
  } : null;

  if(!member){
    return <div className="flex h-40 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" /></div>;
  }

  // If no job profile yet, still show public view with header only (like talent with no profile)
  // Create a mock profile for display if none exists, so header still renders Instagram-style
  const displayProfile = adaptedProfile || {
    id: memberId,
    user_id: memberId,
    category_id: '',
    category: null,
    status: 'draft' as const,
    field_data: {},
    created_at: member.created_at,
    updated_at: member.updated_at,
    is_ghost: false,
  };

  const displayCategory = adaptedCategory || { id:'', name:'', slug:'', fields: [] } as any;

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8">
      <ThreadsProfileView
        profile={displayProfile}
        talentUser={talentUser}
        category={displayCategory}
        portfolioItems={portfolioItems as any}
        mode="business"
        isLoading={false}
        error={undefined}
        onBack={()=> router.push('/agency/squad')}
        editProfileHref={`/agency/squad/${memberId}/edit`}
      />
      {/* Extra squad-specific job profiles grid below, like Instagram posts */}
      {memberProfiles.length>1 && (
        <div className="mx-auto max-w-[630px] px-4 pb-8">
          <h3 className="mt-4 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">All Job Profiles for {member.full_name}</h3>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {memberProfiles.map((p:any)=>(
              <div key={p.id} className="aspect-square rounded-lg border border-[#E7E7EA] bg-white p-3 flex flex-col justify-between">
                <div className="text-xs font-medium text-[#0a0a0a]">{(p.category as any)?.name || p.category_id.slice(0,8)}</div>
                <div className="text-[11px] text-[#737373]">{p.status} • {new Date(p.created_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#737373]">Job profile cards created by talent or for squad member — same as talent.</p>
        </div>
      )}
    </div>
  );
}
