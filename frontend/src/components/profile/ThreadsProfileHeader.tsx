'use client';

import Link from 'next/link';
import type { Profile, CategoryField, CategoryWithFields } from '@/types';

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
  shortlistLoading?: boolean;
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

function generateUsername(name: string): string {
  return '@' + name.toLowerCase().replace(/\s+/g, '.');
}

export default function ThreadsProfileHeader({
  profile,
  talentUser,
  category,
  mode,
  onShortlist,
  shortlistLoading,
  onSendInterest,
  interestLoading,
  editProfileHref,
}: ThreadsProfileHeaderProps) {
  const fields = (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const bio = extractBio(fields, profile.field_data);
  const website = extractWebsite(fields, profile.field_data);
  const isVerified = profile.status === 'approved';

  return (
    <div className="px-5 pt-5 pb-2">
      {/* Name + Avatar row */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-4">
          <h1 className="font-serif-display text-[30px] leading-[1.15] text-[var(--threads-text-primary)]">
            {talentUser.full_name}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--threads-text-secondary)]">
            {generateUsername(talentUser.full_name)}
          </p>
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-[84px] w-[84px] rounded-full border-[3px] border-white ring-1 ring-[var(--threads-border)] overflow-hidden bg-gray-100">
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

      {/* Category */}
      {category && (
        <p className="mt-3 text-[14.5px] font-medium text-[var(--threads-text-primary)]">
          {category.name}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {talentUser.current_location && (
          <span className="flex items-center gap-1 text-[13px] text-[var(--threads-text-secondary)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {talentUser.current_location}
          </span>
        )}
        {talentUser.languages_spoken && talentUser.languages_spoken.length > 0 && (
          <span className="flex items-center gap-1 text-[13px] text-[var(--threads-text-secondary)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
            {talentUser.languages_spoken.map((l) => l.language).join(', ')}
          </span>
        )}
      </div>

      {/* Bio */}
      {bio && (
        <p className="mt-3 text-[14.5px] leading-relaxed text-[var(--threads-text-primary)]">
          {bio}
        </p>
      )}

      {/* Website */}
      {website && (
        <a
          href={website.startsWith('http') ? website : `https://${website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[14.5px] font-semibold text-[var(--threads-text-primary)] hover:underline"
        >
          {website.replace(/^https?:\/\//, '')}
        </a>
      )}

      {/* Action buttons */}
      <div className="mt-5">
        {mode === 'business' ? (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={onShortlist}
              disabled={shortlistLoading}
              className="flex h-[40px] items-center justify-center rounded-[10px] bg-[var(--threads-accent)] text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {shortlistLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                'Shortlist'
              )}
            </button>
            <button
              onClick={onSendInterest}
              disabled={interestLoading}
              className="flex h-[40px] items-center justify-center rounded-[10px] border border-[var(--threads-border)] bg-[var(--threads-bg)] text-sm font-semibold text-[var(--threads-text-primary)] transition-colors hover:bg-[var(--threads-bg-hover)] disabled:opacity-50"
            >
              {interestLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
              ) : (
                'Send Interest'
              )}
            </button>
          </div>
        ) : (
          editProfileHref && (
            <Link
              href={editProfileHref}
              className="flex h-[40px] w-full items-center justify-center rounded-[10px] border border-[var(--threads-border)] bg-[var(--threads-bg)] text-sm font-semibold text-[var(--threads-text-primary)] transition-colors hover:bg-[var(--threads-bg-hover)]"
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
