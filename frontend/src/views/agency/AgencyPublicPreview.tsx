'use client';

import { useState } from 'react';
import Link from 'next/link';
import AgencyPortfolioGrid from '@/components/agency/AgencyPortfolioGrid';
import { useRouter } from 'next/navigation';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';

export default function AgencyPublicPreview({ data, isLoading, error, categoryId, initialTab = 'All' }: { data: any; isLoading: boolean; error: any; categoryId?: string; initialTab?: 'All' | 'Individuals' }){
  const router=useRouter();
  const [activeTab, setActiveTab]=useState<'All'|'Individuals'>(initialTab);

  if(isLoading){
    return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" /></div>;
  }
  if(error || !data){
    return (
      <div className="mx-auto max-w-[630px] px-4 py-10 text-center">
        <p className="text-sm text-red-600">{error?.response?.data?.message || error?.message || 'Failed to load preview'}</p>
        <button onClick={()=>router.back()} className="mt-4 text-sm font-medium text-[#0a0a0a] hover:underline">Go back</button>
      </div>
    );
  }

  const agency=data.agency;
  const profile=agency.profile;
  const category=data.category;
  const portfolioItems=data.portfolio_items ?? [];
  const individuals=data.individuals ?? [];

  const displayName=agency.agency_name;
  const agencyInitial=(agency.agency_short_name || agency.agency_name || '?').slice(0,2).toUpperCase();

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
      <ThreadsProfileShell
        topBar={<ThreadsTopBar displayName={displayName} onBack={()=>router.push('/agency/profiles')} />}
      >
        <div className="px-6 pt-6 pb-4 bg-white">
          <div className="flex gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white flex items-center justify-center">
              {agency.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agency.logo_url} alt={agency.agency_name} className="h-full w-full object-contain" />
              ) : (
                <span className="text-lg font-semibold text-[#0a0a0a]">{agencyInitial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">{agency.agency_name}</h1>
              {agency.agency_short_name && <span className="mt-1 inline-flex items-center rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-2 py-0.5 text-xs font-medium text-[#525252]">{agency.agency_short_name}</span>}
              {profile?.tagline && <p className="mt-1 text-sm text-[#525252]">{profile.tagline}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#737373]">
                {profile?.location_city && <span>{profile.location_city}</span>}
                {profile?.location_state && <span>· {profile.location_state}</span>}
                {profile?.location_country && <span>· {profile.location_country}</span>}
                {profile?.languages && profile.languages.length>0 && <span>· {profile.languages.join(', ')}</span>}
              </div>
              {profile?.services && profile.services.length>0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.services.map((s:string)=><span key={s} className="inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]">{s}</span>)}
                </div>
              )}
            </div>
          </div>
          {profile?.about && (
            <div className="mt-4 rounded-xl bg-[#F5F5F6] border border-[#E7E7EA] p-4">
              <p className="text-sm leading-relaxed text-[#525252] whitespace-pre-wrap">{profile.about}</p>
            </div>
          )}
          {category && (
            <div className="mt-4 flex items-center gap-2 text-xs text-[#737373]">
              <span>Preview for</span>
              <span className="inline-flex items-center rounded-full bg-[#0a0a0a] text-white px-2.5 py-1 text-xs font-medium">{category.name}</span>
              <span className="text-[#a3a3a3]">— {portfolioItems.length} items • {individuals.length} members</span>
            </div>
          )}
          {!category && (
            <div className="mt-4 text-xs text-[#737373]">Preview — all categories • {portfolioItems.length} items • {individuals.length} members</div>
          )}
          <div className="mt-3 rounded-lg bg-[#FFFAC2] border border-[#F8E7B8] px-3 py-2 text-xs text-[#92400E]">This is how businesses will see your agency for {category ? category.name : 'all categories'}.</div>
        </div>

        <div className="mt-1 bg-white">
          <div className="flex w-full border-b border-zinc-200 px-6 overflow-x-auto">
            {(['All','Individuals'] as const).map(tab=>{
              const isActive=activeTab===tab;
              return (
                <button key={tab} onClick={()=>setActiveTab(tab)} className={`flex-shrink-0 pb-3 px-4 text-[14px] font-semibold transition-colors relative ${isActive?'text-zinc-950':'text-zinc-400 hover:text-zinc-600'}`}>
                  <span className="whitespace-nowrap">{tab}</span>
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-950" />}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab==='All' && (
          <div className="bg-white">
            {portfolioItems.length===0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <p className="text-sm text-zinc-500">No portfolio items for this category</p>
              </div>
            ) : (
              <AgencyPortfolioGrid
                items={portfolioItems}
                onMemberClick={memberId => {
                  const params = new URLSearchParams({ from: 'preview', agencyId: agency.id });
                  if (categoryId) { params.set('category_id', categoryId); params.set('preview_category_id', categoryId); }
                  router.push(`/agency/squad/${memberId}?${params}`);
                }}
              />
            )}
          </div>
        )}

        {activeTab==='Individuals' && (
          <div className="bg-white px-2 py-2">
            {individuals.length===0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5"><p className="text-sm text-zinc-500">No members for this category</p></div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {individuals.map(({member, member_profile}:any)=>(
                  <Link
                    key={member_profile.id}
                    href={{ pathname: `/agency/squad/${member.id}`, query: { from: 'preview', agencyId: agency.id, preview_category_id: categoryId, category_id: member_profile.category_id || categoryId || category?.id } }}
                    className="flex items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left transition-colors hover:border-[#0a0a0a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a0a0a]"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F6] border border-[#E7E7EA] flex items-center justify-center">
                      {member.profile_photo_url || member.profile_picture_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.profile_photo_url || member.profile_picture_url} alt={member.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-[#0a0a0a]">{(member.full_name||'?').slice(0,2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#0a0a0a] truncate">{member.full_name}</div>
                      <div className="text-xs text-[#737373] truncate">{member.role_title || member.current_location || '—'}</div>
                      <div className="mt-1 inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]">{member_profile.category?.name || category?.name || '—'}</div>
                    </div>
                    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-4" />
      </ThreadsProfileShell>
    </div>
  );
}
