'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import ThreadsProfileShell from '@/components/profile/ThreadsProfileShell';
import ThreadsTopBar from '@/components/profile/ThreadsTopBar';
import AgencyPortfolioGrid from '@/components/agency/AgencyPortfolioGrid';
import Link from 'next/link';

interface Props {
  token: string;
}

export default function AgencyPublicShareView({ token }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'All' | 'Individuals'>('All');

  const { data, isLoading, error } = useQuery({
    queryKey: ['agencyPublicShare', token],
    queryFn: () => agencyApi.getPublicShare(token),
    retry: 1,
  });

  const formatExpiryTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const ms = d.getTime() - Date.now();
      if (ms <= 0) return 'Expired';
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let duration = '';
      if (days > 0) duration = `${days}d ${hours}h left`;
      else duration = `${hours}h left`;

      const formatted = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${formatted} (${duration})`;
    } catch {
      return isoDate;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
        <p className="mt-3 text-xs text-[#737373]">Loading shared preview...</p>
      </div>
    );
  }

  // Handle expired or error
  const isExpired =
    (error as any)?.response?.status === 410 ||
    ((error as any)?.response?.data?.message || '').toLowerCase().includes('expired');

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[#E7E7EA] bg-white p-8 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            {isExpired ? (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <h1 className="mt-4 font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
            {isExpired ? 'This preview link has expired' : 'Preview link not found'}
          </h1>
          <p className="mt-2 text-xs text-[#737373] leading-relaxed">
            {isExpired
              ? 'The time limit set by the agency for this public link has ended. Please contact the agency directly if you need a new preview link.'
              : ((error as any)?.response?.data?.message || 'The link may have been revoked or typed incorrectly.')}
          </p>
          <div className="mt-6 border-t border-[#E7E7EA] pt-4 text-[11px] text-[#a3a3a3]">
            SquadHire Talent &amp; Agency Platform
          </div>
        </div>
      </div>
    );
  }

  const agency = data.agency;
  const profile = agency.profile;
  const category = data.category;
  const portfolioItems = data.portfolio_items ?? [];
  const individuals = data.individuals ?? [];
  const shareLink = data.share_link;

  const displayName = agency.agency_name;
  const agencyInitial = (agency.agency_short_name || agency.agency_name || '?').slice(0, 2).toUpperCase();

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 min-h-screen bg-[#FAFAFA]">
      {/* Top Banner Notice */}
      <div className="bg-[#0a0a0a] text-white px-4 py-2 text-center text-xs flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 font-medium">
          <svg className="h-3.5 w-3.5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Shared Agency Profile
        </span>
        {shareLink?.expires_at && (
          <span className="text-zinc-300">
            • Link valid until <span className="text-white font-semibold">{formatExpiryTime(shareLink.expires_at)}</span>
          </span>
        )}
      </div>

      <ThreadsProfileShell
        topBar={
          <ThreadsTopBar
            displayName={displayName}
            onBack={() => {}}
            title={displayName}
            subtitle={category ? `Preview for ${category.name}` : 'Shared Agency Portfolio'}
          />
        }
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
              <h1 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                {agency.agency_name}
              </h1>
              {agency.agency_short_name && (
                <span className="mt-1 inline-flex items-center rounded-full bg-[#F5F5F6] border border-[#E7E7EA] px-2 py-0.5 text-xs font-medium text-[#525252]">
                  {agency.agency_short_name}
                </span>
              )}
              {profile?.tagline && <p className="mt-1 text-sm text-[#525252]">{profile.tagline}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-[#737373]">
                {profile?.location_city && <span>{profile.location_city}</span>}
                {profile?.location_state && <span>· {profile.location_state}</span>}
                {profile?.location_country && <span>· {profile.location_country}</span>}
                {profile?.languages && profile.languages.length > 0 && <span>· {profile.languages.join(', ')}</span>}
              </div>
              {profile?.services && profile.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.services.map((s: string) => (
                    <span
                      key={s}
                      className="inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
                    >
                      {s}
                    </span>
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
              <span>Portfolio for</span>
              <span className="inline-flex items-center rounded-full bg-[#0a0a0a] text-white px-2.5 py-1 text-xs font-medium">
                {category.name}
              </span>
              <span className="text-[#a3a3a3]">
                — {portfolioItems.length} items • {individuals.length} members
              </span>
            </div>
          )}

          {!category && (
            <div className="mt-4 text-xs text-[#737373]">
              All categories • {portfolioItems.length} items • {individuals.length} members
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="mt-1 bg-white">
          <div className="flex w-full border-b border-zinc-200 px-6 overflow-x-auto">
            {(['All', 'Individuals'] as const).map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 pb-3 px-4 text-[14px] font-semibold transition-colors relative ${
                    isActive ? 'text-zinc-950' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <span className="whitespace-nowrap">{tab}</span>
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-950" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* All Tab */}
        {activeTab === 'All' && (
          <div className="bg-white">
            {portfolioItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <p className="text-sm text-zinc-500">No portfolio items available</p>
              </div>
            ) : (
              <AgencyPortfolioGrid
                items={portfolioItems}
                onMemberClick={(memberId) => {
                  router.push(`/share/agency/${token}/members/${memberId}`);
                }}
              />
            )}
          </div>
        )}

        {/* Individuals Tab */}
        {activeTab === 'Individuals' && (
          <div className="bg-white px-4 py-4">
            {individuals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-5">
                <p className="text-sm text-zinc-500">No squad members available</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {individuals.map(({ member, member_profile }: any) => (
                  <Link
                    key={member_profile.id}
                    href={`/share/agency/${token}/members/${member.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[#E7E7EA] bg-white p-3 text-left transition-colors hover:border-[#0a0a0a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0a0a0a]"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F6] border border-[#E7E7EA] flex items-center justify-center">
                      {member.profile_photo_url || member.profile_picture_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.profile_photo_url || member.profile_picture_url}
                          alt={member.full_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-[#0a0a0a]">
                          {(member.full_name || '?').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#0a0a0a] truncate">
                        {member.full_name}
                      </div>
                      <div className="text-xs text-[#737373] truncate">
                        {member.role_title || member.current_location || '—'}
                      </div>
                      <div className="mt-1 inline-flex items-center rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]">
                        {member_profile.category?.name || category?.name || '—'}
                      </div>
                    </div>
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-[#a3a3a3]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </ThreadsProfileShell>
    </div>
  );
}
