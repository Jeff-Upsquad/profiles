'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAgencyPublicView } from '@/hooks/useAgencyPublicView';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import ThreadsPortfolioFeed from '@/components/profile/ThreadsPortfolioFeed';
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

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
              <AgencyAllPortfolioFeed
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

// Custom feed for agency All tab — wraps ThreadsPortfolioFeed but adds member attribution
function AgencyAllPortfolioFeed({ items, onMemberClick }: { items: any[]; onMemberClick: (memberId: string) => void }) {
  // Reuse ThreadsPortfolioFeed for grid + lightbox, but we need to show member name in lightbox
  // We'll render a custom lightbox that extends the feed
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 mt-0.5 pb-0.5 px-0.5 bg-white">
        {items.map((item: any, idx: number) => (
          <button
            key={item.id}
            onClick={() => setSelectedIndex(idx)}
            className="group relative aspect-square overflow-hidden bg-zinc-100"
          >
            {item.file_type === 'image' && item.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.file_url} alt={item.file_name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnail_url} alt={item.file_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-500">{item.file_name || 'Video'}</div>
            )}
            {/* Member attribution badge */}
            {item.member_name && (
              <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{item.member_name}</span>
            )}
            {item.category_name && (
              <span className="absolute top-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[#0a0a0a]">{item.category_name}</span>
            )}
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {selectedItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80" onClick={() => setSelectedIndex(null)}>
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {selectedIndex! > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex! - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
          )}
          {selectedIndex! < items.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex! + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          )}
          <div className="absolute top-4 left-4 z-10 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90">{selectedIndex! + 1} / {items.length}</div>
          <div className="relative flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {selectedItem.file_type === 'image' && selectedItem.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedItem.file_url} alt={selectedItem.file_name} className="max-h-[75vh] max-w-[85vw] rounded-lg object-contain" />
            ) : selectedItem.file_type === 'video' && selectedItem.file_url ? (
              <video src={selectedItem.file_url} controls autoPlay className="max-h-[75vh] max-w-[85vw] rounded-lg" />
            ) : selectedItem.embed_url ? (
              <iframe src={selectedItem.embed_url} title={selectedItem.file_name} className="h-[75vh] w-[90vw] max-w-[900px] rounded-lg bg-black" allow="autoplay; fullscreen" allowFullScreen />
            ) : (
              <div className="rounded-lg bg-white p-8 text-sm text-zinc-700">{selectedItem.file_name || 'Portfolio item'}</div>
            )}
            {/* Member attribution in lightbox */}
            {selectedItem.member_name && selectedItem.member_id && (
              <button
                onClick={() => {
                  setSelectedIndex(null);
                  onMemberClick(selectedItem.member_id);
                }}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#FFFAC2] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {selectedItem.member_photo_url && <img src={selectedItem.member_photo_url} alt={selectedItem.member_name} className="h-6 w-6 rounded-full object-cover" />}
                <span>{selectedItem.member_name}</span>
                <svg className="h-3.5 w-3.5 text-[#737373]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            <p className="mt-2 text-center text-sm text-white/80">{selectedItem.file_name || ''}</p>
          </div>
        </div>
      )}
    </>
  );
}
