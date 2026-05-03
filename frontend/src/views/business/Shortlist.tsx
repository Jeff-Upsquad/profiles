import Link from 'next/link';
import { useShortlist, useRemoveFromShortlist } from '@/hooks/useBusiness';
import Button from '@/components/ui/Button';
import TierBadge from '@/components/ui/TierBadge';
import { SkeletonCard } from '@/components/ui/Skeleton';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

function initials(name: string | undefined | null): string {
  if (!name) return 'T';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'T';
}

export default function Shortlist() {
  const { data: profiles, isLoading } = useShortlist();
  const removeFromShortlist = useRemoveFromShortlist();
  const visible = profiles ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6">
          <div className="h-7 w-40 animate-pulse rounded bg-[#f0f0f0]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#f0f0f0]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {visible.length} {visible.length === 1 ? 'profile' : 'profiles'} saved
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Your <span className="text-rainbow">shortlist</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Talent profiles you've saved for later review.
            </p>
          </div>
          <div className="stagger-4">
            <Link href="/business/discover" className="btn-iridescent text-sm py-2 px-3.5">
              Discover More
              <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No shortlisted profiles
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Browse approved talent and save your favorites here for easy access later.
            </p>
            <div className="mt-5 inline-flex">
              <Link href="/business/discover" className="btn-iridescent text-sm py-2 px-3.5">
                Discover Talent
                <svg className="arrow-icon h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((profile, i) => {
            const fullName = (profile as any).talent_user?.full_name ?? 'Talent';
            const tint = tintFor(profile.id);

            return (
              <article
                key={profile.id}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 stagger-${Math.min(i + 1, 6)}`}
              >
                {/* Tinted top strip */}
                <div className={`${tint} h-20 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                  <div className="absolute bottom-3 left-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm font-[family-name:var(--font-jakarta)] text-sm font-semibold"
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      {initials(fullName)}
                    </div>
                  </div>
                  {profile.category?.name && (
                    <div className="absolute top-3 right-3">
                      <span
                        className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm"
                        style={{ color: 'var(--tint-text)' }}
                      >
                        {profile.category.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#0a0a0a] truncate">
                      {fullName}
                    </h3>
                    <TierBadge
                      tier={(profile as any).tier}
                      tierCustom={(profile as any).tier_custom}
                    />
                  </div>

                  <div className="mt-3 space-y-1 font-[family-name:var(--font-inter)] text-sm text-[#525252]">
                    {profile.field_data?.years_experience !== undefined && (
                      <p>
                        <span className="text-[#a3a3a3]">Experience:</span>{' '}
                        <span className="font-medium text-[#0a0a0a]">
                          {profile.field_data.years_experience} years
                        </span>
                      </p>
                    )}
                    {profile.field_data?.expected_salary !== undefined && (
                      <p>
                        <span className="text-[#a3a3a3]">Expected:</span>{' '}
                        <span className="font-medium text-[#0a0a0a]">
                          ${profile.field_data.expected_salary}/mo
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                    <Link href={`/business/discover/${profile.category?.slug ?? 'profile'}/${profile.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                    <button
                      type="button"
                      disabled={removeFromShortlist.isPending}
                      onClick={() => removeFromShortlist.mutate(profile.id)}
                      className="font-[family-name:var(--font-inter)] inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[#a3a3a3] transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
