'use client';

import Link from 'next/link';
import type { Profile, CategoryField, CategoryWithFields } from '@/types';
import TierBadge from '@/components/ui/TierBadge';

interface TalentUser {
  full_name: string;
  current_location?: string;
  profile_photo_url?: string;
  languages_spoken?: { language: string; proficiency: string }[];
}

interface ThreadsProfileHeaderProps {
  profile: Profile;
  talentUser: TalentUser;
  category: CategoryWithFields | null;
  mode: 'business' | 'talent';
  onShortlist?: () => void;
  onUnshortlist?: () => void;
  shortlistLoading?: boolean;
  isShortlisted?: boolean;
  onSendInterest?: () => void;
  interestLoading?: boolean;
  editProfileHref?: string;
}

function extractBio(fields: CategoryField[], fieldData: Record<string, any>): string | null {
  const textareaField = fields
    .filter((f) => f.is_active && f.field_type === 'textarea')
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!textareaField) return null;
  const val = fieldData?.[textareaField.field_key];
  return val && typeof val === 'string' ? val : null;
}

function extractWebsite(fields: CategoryField[], fieldData: Record<string, any>): string | null {
  const urlField = fields.find(
    (f) => f.is_active && (f.field_type === 'email' || f.field_key.includes('website') || f.field_key.includes('url') || f.field_key.includes('link'))
  );
  if (!urlField) return null;
  const val = fieldData?.[urlField.field_key];
  return val && typeof val === 'string' && (val.startsWith('http') || val.startsWith('www')) ? val : null;
}

export default function ThreadsProfileHeader({
  profile,
  talentUser,
  category,
  mode,
  onShortlist,
  onUnshortlist,
  shortlistLoading,
  isShortlisted,
  onSendInterest,
  interestLoading,
  editProfileHref,
}: ThreadsProfileHeaderProps) {
  const fields = (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const bio = extractBio(fields, profile.field_data);
  const website = extractWebsite(fields, profile.field_data);
  const isVerified = profile.status === 'approved';

  return (
    <div className="pt-6 px-6 pb-2">
      {/* Name + Avatar row */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4 mt-1">
          <h1 className="text-[26px] sm:text-[28px] font-bold tracking-tight text-zinc-950 leading-none">
            {talentUser.full_name}
          </h1>
          {category && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-[15px] text-zinc-500">
                {category.name}
              </p>
              {profile.tier && (
                <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-[84px] w-[84px] rounded-full overflow-hidden bg-gray-100">
            {talentUser.profile_photo_url ? (
              <img
                src={talentUser.profile_photo_url}
                alt={talentUser.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-200 text-2xl font-semibold text-gray-500">
                {talentUser.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && (
            <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--threads-accent-green)] ring-2 ring-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      {talentUser.current_location && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1 text-[13px] text-zinc-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {talentUser.current_location}
          </span>
        </div>
      )}

      {/* Bio */}
      {bio && (
        <p className="mt-3 text-[14.5px] leading-relaxed text-zinc-800">
          {bio}
        </p>
      )}

      {/* Website */}
      {website && (
        <a
          href={website.startsWith('http') ? website : `https://${website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[14.5px] font-semibold text-zinc-950 hover:underline"
        >
          {website.replace(/^https?:\/\//, '')}
        </a>
      )}

      {/* Action buttons */}
      <div className="mt-5">
        {mode === 'business' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={isShortlisted ? onUnshortlist : onShortlist}
              disabled={shortlistLoading}
              aria-pressed={isShortlisted ? true : false}
              className={`flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 ${
                isShortlisted
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-950 text-white'
              }`}
            >
              {shortlistLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : isShortlisted ? (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Shortlisted
                </>
              ) : (
                'Shortlist'
              )}
            </button>
            <button
              disabled
              className="relative flex h-[40px] items-center justify-center gap-1.5 rounded-[10px] border border-zinc-200 bg-white text-sm font-semibold text-zinc-400 cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Coming Soon
            </button>
          </div>
        ) : (
          editProfileHref && (
            <Link
              href={editProfileHref}
              className="flex h-[40px] w-full items-center justify-center rounded-[10px] border border-zinc-200 bg-white text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-50"
            >
              Edit Profile
            </Link>
          )
        )}
      </div>

      {/* Rejection reason */}
      {mode === 'talent' && profile.rejection_reason && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
          <p className="mt-0.5 text-sm text-red-700">{profile.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
