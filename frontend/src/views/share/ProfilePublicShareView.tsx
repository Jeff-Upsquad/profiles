'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';
import GhostProfileView from '@/views/shared/GhostProfileView';

interface Props {
  token: string;
}

export default function ProfilePublicShareView({ token }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['publicProfileShare', token],
    queryFn: async () => {
      const res = await axios.get(`/api/public/profile-share/${token}`);
      return res.data;
    },
    retry: 1,
  });

  const formatExpiryTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const ms = d.getTime() - Date.now();
      if (ms <= 0) return 'Expired';
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const duration = days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;

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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-950 border-t-transparent" />
        <p className="mt-3 text-xs text-zinc-500">Loading shared profile...</p>
      </div>
    );
  }

  const isExpired =
    (error as any)?.response?.status === 410 ||
    ((error as any)?.response?.data?.message || '').toLowerCase().includes('expired') ||
    ((error as any)?.response?.data?.message || '').toLowerCase().includes('revoked');

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-zinc-950">
            {isExpired ? 'Link Expired or Revoked' : 'Profile Not Found'}
          </h1>
          <p className="mt-2 text-xs text-zinc-600">
            {isExpired
              ? 'This public profile share link has expired or has been revoked. Please request a new link from the administrator.'
              : ((error as any)?.response?.data?.message || 'Could not load profile details. The link may be invalid.')}
          </p>
        </div>
      </div>
    );
  }

  const { profile, talent_user: talentUser, category, portfolio_items: portfolioItems, share_link: shareLink } = data;
  const isGhost = profile?.is_ghost === true;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Expiry and attribution banner */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-2 text-xs backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="font-medium text-zinc-700">Shared Profile</span>
          {shareLink?.expires_at && (
            <span className="text-zinc-500">
              · Valid until {formatExpiryTime(shareLink.expires_at)}
            </span>
          )}
        </div>
        <div className="text-[11px] font-semibold text-zinc-400">
          SquadHire
        </div>
      </div>

      {isGhost ? (
        <GhostProfileView
          ghostProfile={profile}
          sourceProfiles={profile.source_profiles ?? []}
          talentUser={talentUser}
          mode="business"
          isLoading={false}
          onBack={() => {}}
        />
      ) : (
        <ThreadsProfileView
          profile={profile}
          talentUser={talentUser}
          category={category}
          portfolioItems={portfolioItems ?? []}
          mode="business"
          isLoading={false}
          onBack={() => {}}
        />
      )}
    </div>
  );
}
