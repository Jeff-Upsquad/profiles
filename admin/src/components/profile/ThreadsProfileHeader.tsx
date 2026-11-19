'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Profile, CategoryField, CategoryWithFields } from '@/types';
import TierBadge from '@/components/ui/TierBadge';

interface TalentUser {
  full_name: string;
  current_location?: string;
  profile_photo_url?: string;
  languages_spoken?: { language: string; proficiency: string }[];
  age?: number | null;
  gender?: string | null;
  country?: string | null;
  state?: string | null;
  current_district?: string | null;
  city?: string | null;
}

interface ThreadsProfileHeaderProps {
  profile: Profile & { rejection_reason?: string };
  talentUser: TalentUser;
  category: CategoryWithFields | null;
  /** Admin previews are read-only; kept for parity with the shared design. */
  mode: 'business' | 'talent' | 'admin';
  editProfileHref?: string;
  /** Number of portfolio works (text posts excluded), for the "· 9 works" line. */
  worksCount?: number;
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

function readExperience(fieldData: Record<string, any>): { years: number; months: number } | null {
  const value = fieldData?._experience;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { years, months } = value as { years?: unknown; months?: unknown };
  if (typeof years !== 'number' || typeof months !== 'number') return null;
  if (years === 0 && months === 0) return null;
  return { years, months };
}

/** Highest-level names first, ties kept in their saved order. */
function topNames(list: unknown, nameKeys: string[], take: number, minLevel = 0): string[] {
  if (!Array.isArray(list)) return [];
  const rows = list
    .map((entry: any, index) => {
      if (typeof entry === 'string') return { name: entry, level: 3, index };
      const name = nameKeys.map((k) => entry?.[k]).find((v) => typeof v === 'string' && v);
      return { name: name as string | undefined, level: Number(entry?.level ?? 3), index };
    })
    .filter((r): r is { name: string; level: number; index: number } => !!r.name && r.level >= minLevel)
    .sort((a, b) => b.level - a.level || a.index - b.index);
  return rows.slice(0, take).map((r) => r.name);
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function FactChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="shrink-0 rounded-[14px] border border-zinc-200 px-3 py-[9px] sm:min-w-[120px] sm:py-2.5">
      <p className="text-[12px] text-zinc-500">{label}</p>
      <p className="mt-0.5 whitespace-nowrap text-[14px] font-semibold text-zinc-950 sm:text-[15px]">{value}</p>
    </div>
  );
}

export default function ThreadsProfileHeader({
  profile,
  talentUser,
  category,
  mode,
  editProfileHref,
  worksCount,
}: ThreadsProfileHeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const fields = (category?.fields ?? []).filter((f) => f.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const fieldData = profile.field_data ?? {};
  const bio = extractBio(fields, fieldData);
  const website = extractWebsite(fields, fieldData);
  const isVerified = profile.status === 'approved';

  const location =
    [talentUser.city, talentUser.current_district, talentUser.state, talentUser.country]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .join(', ') || talentUser.current_location;

  // ---- Summary line + fact strip ----
  const experience = readExperience(fieldData);
  const experienceShort = experience
    ? `${experience.years + (experience.months >= 6 ? 0.5 : 0)} yrs experience`
    : null;
  const metaLine = [
    experienceShort,
    worksCount ? `${worksCount} ${worksCount === 1 ? 'work' : 'works'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const expertOn = topNames(fieldData._categories, ['category', 'skill'], 2, 5);
  const bestAt = topNames(fieldData._skills, ['skill'], 1);
  const languageCodes = (talentUser.languages_spoken ?? [])
    .map((l) => l.language?.trim().slice(0, 2).toUpperCase())
    .filter(Boolean);
  const ageGender = [
    talentUser.age != null ? String(talentUser.age) : null,
    talentUser.gender ? capitalize(talentUser.gender) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts: { label: string; value: string }[] = [];
  if (experience) {
    facts.push({
      label: 'Experience',
      value: [experience.years ? `${experience.years} yrs` : null, experience.months ? `${experience.months} mo` : null]
        .filter(Boolean)
        .join(' '),
    });
  }
  if (expertOn.length) facts.push({ label: 'Expert on', value: expertOn.join(', ') });
  if (languageCodes.length) facts.push({ label: 'Languages', value: languageCodes.join(' · ') });
  if (ageGender) facts.push({ label: 'Age', value: ageGender });
  if (bestAt.length) facts.push({ label: 'Best at', value: bestAt[0] });

  return (
    <div className="pt-2 sm:pt-6">
      <div className="px-4 sm:px-6">
        {/* Name + Avatar row */}
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 pt-1.5">
            <h1 className="text-[24px] font-bold leading-[1.1] tracking-tight text-zinc-950 sm:text-[28px]">
              {talentUser.full_name}
            </h1>
            {category && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[14px] text-zinc-950 sm:text-[15px]">{category.name}</span>
                {profile.tier && <TierBadge tier={profile.tier} tierCustom={profile.tier_custom} />}
              </div>
            )}
            {location && (
              <p className="mt-1.5 flex items-center gap-1 text-[13px] text-zinc-500 sm:text-[14px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {location}
              </p>
            )}
          </div>

          <div className="relative shrink-0">
            <div className="h-[72px] w-[72px] overflow-hidden rounded-full bg-zinc-100 sm:h-[84px] sm:w-[84px]">
              {talentUser.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={talentUser.profile_photo_url}
                  alt={talentUser.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-2xl font-semibold text-zinc-500 sm:text-[28px]">
                  {talentUser.full_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {isVerified && (
              <svg width="24" height="24" viewBox="0 0 24 24" role="img" aria-label="Verified" className="absolute -bottom-0.5 -left-0.5">
                <circle cx="12" cy="12" r="11" fill="#1A66D9" stroke="#fff" strokeWidth="2" />
                <path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>

        {/* Bio — clamped on phones with a "more" toggle */}
        {bio && (
          <div className="mt-3 sm:mt-3.5">
            <p
              className={`whitespace-pre-line text-[15px] leading-[1.45] text-zinc-950 sm:leading-normal ${
                bioExpanded ? '' : 'line-clamp-3 sm:line-clamp-none'
              }`}
            >
              {bio}
            </p>
            {!bioExpanded && bio.length > 140 && (
              <button
                type="button"
                onClick={() => setBioExpanded(true)}
                className="text-[15px] text-zinc-500 hover:text-zinc-700 sm:hidden"
              >
                more
              </button>
            )}
          </div>
        )}

        {website && (
          <a
            href={website.startsWith('http') ? website : `https://${website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[14.5px] font-semibold text-[#1A66D9] hover:text-[#124CA6]"
          >
            {website.replace(/^https?:\/\//, '')}
          </a>
        )}

        {metaLine && <p className="mt-2 text-[14px] text-zinc-500 sm:mt-2.5">{metaLine}</p>}

        {/* Admin previews stay read-only — no business actions. Talent keeps
            its edit shortcut for parity with the shared design. */}
        {mode === 'talent' && editProfileHref && (
          <Link
            href={editProfileHref}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-[10px] border border-zinc-300 bg-white text-[15px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-50 sm:h-10"
          >
            Edit profile
          </Link>
        )}
      </div>

      {/* Fact strip — scrolls sideways */}
      {facts.length > 0 && (
        <div className="mt-3.5 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide sm:mt-4 sm:px-6">
          {facts.map((f) => (
            <FactChip key={f.label} label={f.label} value={f.value} />
          ))}
        </div>
      )}

      {/* Rejection reason — useful context while reviewing in admin */}
      {(mode === 'talent' || mode === 'admin') && profile.rejection_reason && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 sm:mx-6">
          <p className="text-xs font-semibold text-red-800">Rejection Reason</p>
          <p className="mt-0.5 text-sm text-red-700">{profile.rejection_reason}</p>
        </div>
      )}
    </div>
  );
}
