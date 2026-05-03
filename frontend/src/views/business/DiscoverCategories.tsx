import Link from 'next/link';
import { useBusinessCategories } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

export default function DiscoverCategories() {
  const { data: categories, isLoading } = useBusinessCategories();
  const visibleCategories = categories ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6">
          <div className="h-7 w-40 animate-pulse rounded bg-[#f0f0f0]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#f0f0f0]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-blue relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {visibleCategories.length} {visibleCategories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Discover <span className="text-rainbow">talent</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Browse approved professionals by job category and find the right fit for your team.
            </p>
          </div>
          <div className="stagger-4">
            <Link
              href="/business/shortlist"
              className="font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg border border-[#E8E5DE] bg-white px-3.5 py-2 text-sm font-semibold text-[#0a0a0a] transition-all duration-200 hover:bg-[#f0f0f0] active:scale-[0.97]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              View Shortlist
            </Link>
          </div>
        </div>
      </section>

      {visibleCategories.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No categories available
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Check back soon for new talent categories.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCategories.map((cat, i) => {
            const tint = tintFor(cat.name);
            return (
              <Link
                key={cat.id}
                href={`/business/discover/${cat.slug}`}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 stagger-${Math.min(i + 1, 6)}`}
              >
                {/* Tinted top strip */}
                <div className={`${tint} h-20 relative overflow-hidden`}>
                  <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
                  <div className="absolute bottom-3 left-4">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    {cat.name}
                  </h3>
                  {cat.description ? (
                    <p className="mt-1.5 font-[family-name:var(--font-inter)] text-sm text-[#737373] line-clamp-2">
                      {cat.description}
                    </p>
                  ) : (
                    <p className="mt-1.5 font-[family-name:var(--font-inter)] text-sm text-[#a3a3a3]">
                      Browse approved {cat.name.toLowerCase()} profiles
                    </p>
                  )}

                  <div className="mt-auto pt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#0a0a0a] group-hover:gap-2 transition-all">
                    Browse profiles
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
