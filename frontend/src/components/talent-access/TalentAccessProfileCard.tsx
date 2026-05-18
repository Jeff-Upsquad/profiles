'use client';

import Link from 'next/link';
import type { ProfileCardSummary, Tier } from '@/hooks/useTalentAccess';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  junior: {
    label: 'Junior',
    className: 'bg-[#EDF6FD] text-[#0070C9] ring-[#D6EBFA]',
  },
  pro: {
    label: 'Pro',
    className: 'bg-[#EFEDFD] text-[#0a0a0a] ring-[#DDD8FA]',
  },
  elite: {
    label: 'Top Talents',
    className: 'bg-[#FDF6E7] text-[#92400E] ring-[#F8E7B8]',
  },
  'Top Talents': {
    label: 'Top Talents',
    className: 'bg-[#FDF6E7] text-[#92400E] ring-[#F8E7B8]',
  },
  custom: {
    label: 'Custom',
    className: 'bg-[#F2F2F4] text-[#52525B] ring-[#E8E5DE]',
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
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${badge.className}`}
    >
      {label}
    </span>
  );
}

function Avatar({
  name,
  url,
  tint,
  size = 'md',
}: {
  name: string;
  url?: string | null;
  tint: string;
  size?: 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`${dim} shrink-0 rounded-xl object-cover`}
      />
    );
  }
  return (
    <div
      className={`${tint} ${dim} flex shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-jakarta)] text-sm font-semibold`}
      style={{ color: 'var(--tint-icon)' }}
    >
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
  const tint = tintFor(profile.id);

  if (variant === 'card') {
    return (
      <Link
        href={href}
        className="group block overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]"
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar
              name={profile.full_name}
              url={profile.profile_photo_url}
              tint={tint}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
                  {profile.full_name || 'Unnamed talent'}
                </h3>
                <TierBadge tier={profile.tier} tierCustom={profile.tier_custom ?? undefined} />
              </div>
              {profile.current_location && (
                <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#737373]">
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
                  className="inline-flex items-center rounded-full bg-[#F2FCBC] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
                >
                  {skill}
                </span>
              ))}
            </div>
          )}
          {profile.languages_spoken.length > 0 && (
            <p className="mt-3 truncate font-[family-name:var(--font-inter)] text-[11px] text-[#a3a3a3]">
              {profile.languages_spoken
                .map((l) => l.language)
                .filter(Boolean)
                .slice(0, 4)
                .join(' · ')}
            </p>
          )}
        </div>
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
      className="group flex items-center gap-4 overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E8E5DE] hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] sm:px-5"
    >
      <Avatar name={profile.full_name} url={profile.profile_photo_url} tint={tint} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold tracking-[-0.01em] text-[#0a0a0a]">
            {profile.full_name || 'Unnamed talent'}
          </h3>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-[family-name:var(--font-inter)] text-xs text-[#737373]">
          {profile.current_location && (
            <span className="truncate">{profile.current_location}</span>
          )}
          {profile.current_location && (experienceText || ageGenderText) && (
            <span className="text-[#D4D4D8]">·</span>
          )}
          {experienceText && (
            <span className="truncate font-medium text-[#525252]">{experienceText}</span>
          )}
          {experienceText && ageGenderText && (
            <span className="text-[#D4D4D8]">·</span>
          )}
          {ageGenderText && <span className="truncate">{ageGenderText}</span>}
        </div>
      </div>

      {profile.top_skills.length > 0 && (
        <div className="hidden shrink-0 lg:flex max-w-[180px] flex-wrap justify-end gap-1">
          {profile.top_skills.slice(0, 2).map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-full bg-[#F2FCBC] px-2 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <TierBadge tier={profile.tier} tierCustom={profile.tier_custom ?? undefined} />

      <svg
        className="h-4 w-4 shrink-0 text-[#a3a3a3] transition-all group-hover:translate-x-0.5 group-hover:text-[#0a0a0a]"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.25}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
