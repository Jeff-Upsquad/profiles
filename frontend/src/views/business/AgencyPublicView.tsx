'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAgencyPublicView } from '@/hooks/useAgencyPublicView';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import AgencyPortfolioGrid from '@/components/agency/AgencyPortfolioGrid';
import ThreadsPortfolioTabBar from '@/components/profile/ThreadsPortfolioTabBar';

interface Props {
  agencyId: string;
  initialCategoryId?: string;
}

export default function AgencyPublicView({ agencyId, initialCategoryId }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryId = initialCategoryId ?? searchParams.get('category_id') ?? searchParams.get('categoryId') ?? undefined;
  const { data, isLoading, error } = useAgencyPublicView(agencyId, categoryId);
  const [activeTab, setActiveTab] = useState<'All' | 'Individuals'>('All');

  // For portfolio lightbox: track which item's member to show
  const individuals = data?.individuals ?? [];

  const filteredForCategory = useMemo(() => data?.portfolio_items ?? [], [data?.portfolio_items]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[630px] px-4 py-10 text-center">
        <p className="text-sm text-red-600">{(error as any)?.response?.data?.message || (error as any)?.message || 'Failed to load agency'}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm font-medium text-[#0a0a0a] hover:underline">Go back</button>
      </div>
    );
  }

  const agency = data.agency;
  const profile = agency.profile;
  const category = data.category;

  // Agency header data — reuse Threads style
  const displayName = agency.agency_name;
  const agencyInitial = (agency.agency_short_name || agency.agency_name || '?').slice(0,2).toUpperCase();

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-full bg-[#FAFAFA]">
      <ThreadsProfileShell
        topBar={<ThreadsTopBar displayName={displayName} onBack={() => router.back()} />}
      >
        {/* Agency Header — similar to talent header but with agency fields */}
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
              {agency.agency_short_name && (
                <span className="mt-1 inline-flex items-center rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-2 py-0.5 text-xs font-medium text-[#525252]">{agency.agency_short_name}</span>
              )}
              {profile?.tagline && <p className="mt-1 text-sm text-[#525252]">{profile.tagline}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#737373]">
                {profile?.location_city && <span>{profile.location_city}</span>}
                {profile?.location_state && <span>· {profile.location_state}</span>}
                {profile?.location_country && <span>· {profile.location_country}</span>}
                {profile?.languages && profile.languages.length > 0 && <span>· {profile.languages.join(', ')}</span>}
                {profile?.team_size && <span>· {profile.team_size}</span>}
                {profile?.founded_year && <span>· Est. {profile.founded_year}</span>}
              </div>
              {profile?.services && profile.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.services.map((s: string) => (
                    <span key={s} className="inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]">{s}</span>
                  ))}
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
              <span>Filtered for</span>
              <span className="inline-flex items-center rounded-full bg-[#0a0a0a] text-white px-2.5 py-1 text-xs font-medium">{category.name}</span>
              <span className="text-[#a3a3a3]">— showing {filteredForCategory.length} items from {individuals.length} {category.name.toLowerCase()}s</span>
            </div>
          )}
        </div>

        {/* Portfolio tabs: All / Individuals */}
        <div className="mt-1 bg-white">
          <ThreadsPortfolioTabBar
            tabs={['All', 'Individuals']}
            activeTab={activeTab}
            onTabChange={(t) => setActiveTab(t as any)}
          />
        </div>

        {/* All tab — combined portfolio feed with member attribution */}
        {activeTab === 'All' && (
          <div>
            {filteredForCategory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5 bg-white">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <p className="mt-3 text-sm text-zinc-500">No portfolio items for this category</p>
                {category && <p className="mt-1 text-xs text-zinc-400">Agency has no {category.name.toLowerCase()} work yet</p>}
              </div>
            ) : (
              <AgencyPortfolioGrid
                items={filteredForCategory}
                onMemberClick={(memberId) => {
                  // Navigate to member profile within agency view
                  const qs = categoryId ? `?category_id=${categoryId}` : '';
                  router.push(`/business/agency-view/${agencyId}/members/${memberId}${qs}`);
                }}
              />
            )}
          </div>
        )}

        {/* Individuals tab — list of members for this category */}
        {activeTab === 'Individuals' && (
          <div className="bg-white px-2 py-2">
            {individuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <p className="text-sm text-zinc-500">No {category ? category.name.toLowerCase() : ''} profiles in this agency</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {individuals.map(({ member, member_profile }: any) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      const qs = categoryId ? `?category_id=${categoryId}` : '';
                      router.push(`/business/agency-view/${agencyId}/members/${member.id}${qs}`);
                    }}
                    className="flex items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left hover:border-[#0a0a0a] transition-colors"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F6] flex items-center justify-center border border-[#E7E7EA]">
                      {member.profile_photo_url || member.profile_picture_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.profile_photo_url || member.profile_picture_url} alt={member.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-[#0a0a0a]">{(member.full_name || '?').slice(0,2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#0a0a0a] truncate">{member.full_name}</div>
                      <div className="text-xs text-[#737373] truncate">{member.role_title || member.current_location || '—'}</div>
                      <div className="mt-1 inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]">{member_profile.category?.name || category?.name || '—'}</div>
                    </div>
                    <svg className="h-4 w-4 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
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
