'use client';

import Link from 'next/link';
import type { ProfileCardSummary, Tier } from '@/hooks/useTalentAccess';

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  junior: {
    label: 'Junior',
    className: 'bg-blue-50 text-blue-700 ring-blue-100',
  },
  pro: {
    label: 'Pro',
    className: 'bg-violet-50 text-violet-700 ring-violet-100',
  },
  elite: {
    label: 'Elite',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  custom: {
    label: 'Custom',
    className: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function TierBadge({ tier, tierCustom }: { tier: Tier | null; tierCustom?: string }) {
  if (!tier) return null;
  const badge = TIER_BADGE[tier];
  const label = tier === 'custom' && tierCustom ? tierCustom : badge.label;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${badge.className}`}
    >
      {label}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
      {initials(name) || '?'}
    </div>
  );
}

export default function TalentAccessProfileCard({
  profile,
  basePath = '/talent-access',
  searchParams,
  variant = 'row',
}: {
  profile: ProfileCardSummary;
  basePath?: string;
  searchParams?: string;
  variant?: 'row' | 'card';
}) {
  const href = `${basePath}/${profile.id}${searchParams ? `?${searchParams}` : ''}`;

  if (variant === 'card') {
    return (
      <Link
        href={href}
        className="group block rounded-2xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm"
      >
        <div className="flex items-start gap-3">
          {profile.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_photo_url}
              alt={profile.full_name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
              {initials(profile.full_name) || '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold text-zinc-900 group-hover:text-zinc-700">
                {profile.full_name || 'Unnamed talent'}
              </h3>
              <TierBadge tier={profile.tier} tierCustom={profile.tier_custom ?? undefined} />
            </div>
            {profile.current_location && (
              <p className="mt-0.5 truncate text-xs text-zinc-500">
                {profile.current_location}
              </p>
            )}
          </div>
        </div>
        {profile.top_skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {profile.top_skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
        {profile.languages_spoken.length > 0 && (
          <p className="mt-3 truncate text-[11px] text-zinc-500">
            {profile.languages_spoken
              .map((l) => l.language)
              .filter(Boolean)
              .slice(0, 4)
              .join(' · ')}
          </p>
        )}
      </Link>
    );
  }

  const experienceText =
    profile.years_experience != null
      ? `${profile.years_experience} yr${profile.years_experience === 1 ? '' : 's'} exp`
      : null;

  const ageGenderText = [
    profile.age != null ? `Age ${profile.age}` : null,
    profile.gender || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm"
    >
      <Avatar name={profile.full_name} url={profile.profile_photo_url} />

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:text-zinc-700">
          {profile.full_name || 'Unnamed talent'}
        </h3>
        {profile.current_location && (
          <p className="truncate text-xs text-zinc-500">{profile.current_location}</p>
        )}
      </div>

      {(experienceText || ageGenderText) && (
        <div className="hidden shrink-0 flex-col items-end text-[11px] text-zinc-500 sm:flex">
          {experienceText && <span>{experienceText}</span>}
          {ageGenderText && <span>{ageGenderText}</span>}
        </div>
      )}

      <TierBadge tier={profile.tier} tierCustom={profile.tier_custom ?? undefined} />

      <svg
        className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
