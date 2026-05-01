import { useState } from 'react';
import Link from 'next/link';
import { useDiscoverProfiles, useAddToShortlist } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
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

export default function DiscoverProfiles({ categorySlug }: { categorySlug: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');

  const { data: category } = useCategoryWithFields(categorySlug);
  const { data, isLoading } = useDiscoverProfiles({
    categorySlug,
    page,
    search,
    sort_by: sortBy as any,
  });
  const addToShortlist = useAddToShortlist();

  const profiles = data?.profiles ?? [];
  const total = data?.total ?? 0;
  const perPage = data?.per_page ?? 20;
  const totalPages = Math.ceil(total / perPage);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 flex items-center gap-2 text-xs stagger-1">
              <Link
                href="/business/discover"
                className="font-[family-name:var(--font-inter)] inline-flex items-center gap-1 font-semibold text-[#838383] transition-colors hover:text-[#202020]"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Discover
              </Link>
              <span className="text-[#D4D4D8]">/</span>
              <span className="eyebrow-rainbow">
                {total} approved profile{total !== 1 ? 's' : ''}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#202020] stagger-2">
              <span className="text-rainbow">{category?.name ?? 'Profiles'}</span>
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#646464] stagger-3">
              Search, sort, and shortlist talent that matches your needs.
            </p>
          </div>
        </div>
      </section>

      {/* ── Search & Sort ── */}
      <div className="rounded-2xl border border-[#ECECEF] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form onSubmit={handleSearch} className="flex flex-1 gap-2">
            <div className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A1A1AA]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, skills, location..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-lg border border-[#E4E4E7] bg-white py-2 pl-9 pr-3 text-sm text-[#202020] placeholder:text-[#A1A1AA] focus:border-[#6647F0] focus:outline-none focus:ring-2 focus:ring-[#6647F0]/12"
              />
            </div>
            <Button type="submit">Search</Button>
          </form>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-sm font-medium text-[#202020] focus:border-[#6647F0] focus:outline-none focus:ring-2 focus:ring-[#6647F0]/12"
          >
            <option value="newest">Newest First</option>
            <option value="experience_high">Experience: High to Low</option>
            <option value="experience_low">Experience: Low to High</option>
            <option value="salary_low">Salary: Low to High</option>
            <option value="salary_high">Salary: High to Low</option>
          </select>
        </div>
      </div>

      {/* ── Profile list ── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#ECECEF] bg-white px-6 py-16 text-center">
          <div className="hero-glow-orange absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2EEFF]">
              <svg className="h-7 w-7 text-[#6647F0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#202020]">
              No profiles found
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#838383]">
              Try adjusting your search or sort options.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile, i) => {
              const fullName = (profile as any).talent_user?.full_name ?? 'Talent';
              const tint = tintFor(profile.id);
              const skills = (profile.field_data?.accounting_software as string[]) ?? [];

              return (
                <article
                  key={profile.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#ECECEF] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 stagger-${Math.min(i + 1, 6)}`}
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
                    <div className="absolute top-3 right-3">
                      <span className="pill-live">Approved</span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#202020] truncate">
                        {fullName}
                      </h3>
                      <TierBadge
                        tier={(profile as any).tier}
                        tierCustom={(profile as any).tier_custom}
                      />
                    </div>

                    <div className="mt-3 space-y-1 font-[family-name:var(--font-inter)] text-sm text-[#646464]">
                      {profile.field_data?.years_experience !== undefined && (
                        <p>
                          <span className="text-[#A1A1AA]">Experience:</span>{' '}
                          <span className="font-medium text-[#202020]">
                            {profile.field_data.years_experience} years
                          </span>
                        </p>
                      )}
                      {profile.field_data?.expected_salary !== undefined && (
                        <p>
                          <span className="text-[#A1A1AA]">Salary:</span>{' '}
                          <span className="font-medium text-[#202020]">
                            ${profile.field_data.expected_salary}/mo
                          </span>
                        </p>
                      )}
                      {profile.field_data?.type_of_work && (
                        <p>
                          <span className="text-[#A1A1AA]">Type:</span>{' '}
                          <span className="font-medium text-[#202020]">
                            {String(profile.field_data.type_of_work).replace(/_/g, ' ')}
                          </span>
                        </p>
                      )}
                    </div>

                    {skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {skills.slice(0, 4).map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-[#F2EEFF] px-2 py-0.5 text-[11px] font-medium text-[#6647F0]"
                          >
                            {s.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
                      <Link href={`/business/discover/${categorySlug}/${profile.id}`}>
                        <Button variant="outline" size="sm">
                          View Profile
                        </Button>
                      </Link>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={addToShortlist.isPending}
                        onClick={() => addToShortlist.mutate(profile.id)}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        Shortlist
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="font-[family-name:var(--font-inter)] text-sm text-[#646464]">
                Page <span className="font-semibold text-[#202020]">{page}</span> of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
