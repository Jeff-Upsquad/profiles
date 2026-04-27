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

export default function TalentAccessProfileCard({
  profile,
}: {
  profile: ProfileCardSummary;
}) {
  const tier = profile.tier ? TIER_BADGE[profile.tier] : null;
  const tierLabel = profile.tier === 'custom' && profile.tier_custom ? profile.tier_custom : tier?.label;

  return (
    <Link
      href={`/talent-access/${profile.id}`}
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
            {tier && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tier.className}`}
              >
                {tierLabel}
              </span>
            )}
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
