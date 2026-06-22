'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useBusinessTalentAccess,
  useBusinessTalentAccessProfiles,
  useBusinessTalentAccessFilterOptions,
} from '@/hooks/useBusiness';
import { useFilterParams } from '@/hooks/useFilterParams';
import TalentAccessFilters, { type FilterState } from '@/views/talent-access/TalentAccessFilters';
import TalentAccessProfileCard from '@/components/talent-access/TalentAccessProfileCard';

function totalSelected(f: FilterState): number {
  return (
    (f.tier?.length ?? 0) +
    (f.location?.length ?? 0) +
    (f.country?.length ?? 0) +
    (f.state?.length ?? 0) +
    (f.district?.length ?? 0) +
    (f.language?.length ?? 0) +
    (f.skill?.length ?? 0) +
    (f.ai_tool?.length ?? 0)
  );
}

export default function BusinessTalentAccess() {
  const { data: status, isLoading: statusLoading } = useBusinessTalentAccess();
  const categories = status?.categories ?? [];

  const {
    filters,
    activeCategoryId,
    search,
    setFilters,
    setCategory,
    setSearch,
  } = useFilterParams();

  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setCategory(categories[0]!.id);
    }
  }, [categories, activeCategoryId, setCategory]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filterOptionsQuery = useBusinessTalentAccessFilterOptions(activeCategoryId || undefined);

  const profilesQuery = useBusinessTalentAccessProfiles({
    category_id: activeCategoryId,
    tier: filters.tier,
    location: filters.location,
    country: filters.country,
    state: filters.state,
    district: filters.district,
    language: filters.language,
    skill: filters.skill,
    ai_tool: filters.ai_tool,
    search: debouncedSearch || undefined,
  });

  const expiresInDays = useMemo(() => {
    if (!status?.expires_at) return null;
    const ms = new Date(status.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [status?.expires_at]);

  const profiles = profilesQuery.data?.profiles ?? [];
  const total = profilesQuery.data?.total ?? 0;
  const filterCount = totalSelected(filters);

  const profileIds = useMemo(() => profiles.map((p: any) => p.id), [profiles]);

  const urlSearchParams = useSearchParams();
  const parentParamsString = useMemo(() => urlSearchParams.toString(), [urlSearchParams]);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E7E7EA] border-t-[#0a0a0a]" />
      </div>
    );
  }

  if (!status?.has_access) {
    return (
      <div className="space-y-6">
        <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
          <div className="hero-content">
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">Talent Access</span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Talent <span className="text-rainbow">Profiles</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Browse talent profiles shared with your account.
            </p>
          </div>
        </section>

        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No talent profile access
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Contact the administrator to get access to talent profiles.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-blue relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 flex flex-wrap items-center gap-1.5 stagger-1">
              <span className="eyebrow-rainbow">
                {profilesQuery.isLoading ? 'Loading' : `${total} ${total === 1 ? 'profile' : 'profiles'}`}
              </span>
              {expiresInDays !== null && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Access expires in {expiresInDays} day{expiresInDays === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Talent <span className="text-rainbow">Profiles</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Browse talent profiles shared with your account.
            </p>
          </div>
        </div>
      </section>

      {/* Category chip tabs */}
      {categories.length > 1 && (
        <nav
          className="flex gap-2 overflow-x-auto pb-1 stagger-4"
          aria-label="Talent access categories"
        >
          {categories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-[family-name:var(--font-inter)] text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                  isActive
                    ? 'bg-[#0a0a0a] text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.15)]'
                    : 'bg-[#FFFAC2] text-[#0a0a0a] hover:bg-[#F1F1F3]'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </nav>
      )}

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Filters — desktop */}
        <div className="hidden min-w-0 lg:block">
          {activeCategoryId && (
            <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <TalentAccessFilters
                categoryId={activeCategoryId}
                value={filters}
                onChange={setFilters}
                filterOptions={filterOptionsQuery.data}
                filterOptionsLoading={filterOptionsQuery.isLoading}
              />
            </div>
          )}
        </div>

        {/* Profiles list */}
        <section className="min-w-0 space-y-4">
          {/* Search + mobile filters */}
          <div className="rounded-2xl border border-[#E7E7EA] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a3a3]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  className="w-full rounded-lg border border-[#E7E7EA] bg-white py-2 pl-9 pr-3 text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] focus:border-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/12"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpenMobile(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#f0f0f0] lg:hidden"
                aria-haspopup="dialog"
                aria-expanded={filtersOpenMobile}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Filters
                {filterCount > 0 && (
                  <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0a0a0a] px-1.5 text-[10px] font-semibold text-white">
                    {filterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filters drawer (mobile) */}
          {filtersOpenMobile && (
            <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
              <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setFiltersOpenMobile(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col border-l border-[#E7E7EA] bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[#E7E7EA] px-4 py-3">
                  <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">Filters</h2>
                  <button
                    onClick={() => setFiltersOpenMobile(false)}
                    className="-mr-1 rounded-md p-1.5 text-[#737373] transition-colors hover:bg-[#f0f0f0] hover:text-[#0a0a0a]"
                    aria-label="Close filters"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  {activeCategoryId && (
                    <TalentAccessFilters
                      categoryId={activeCategoryId}
                      value={filters}
                      onChange={setFilters}
                      filterOptions={filterOptionsQuery.data}
                      filterOptionsLoading={filterOptionsQuery.isLoading}
                    />
                  )}
                </div>
                <div className="border-t border-[#E7E7EA] px-4 py-3">
                  <button
                    onClick={() => setFiltersOpenMobile(false)}
                    className="w-full rounded-lg bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#000] active:scale-[0.98]"
                  >
                    {profilesQuery.isLoading
                      ? 'Updating…'
                      : `Show ${total} ${total === 1 ? 'profile' : 'profiles'}`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {profilesQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {(profilesQuery.error as any)?.response?.data?.error ||
                'Failed to load profiles.'}
            </div>
          ) : profilesQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl border border-[#E7E7EA] bg-white"
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
              <div className="hero-glow-orange absolute inset-0 pointer-events-none" />
              <div className="relative">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFFAC2]">
                  <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
                  No profiles match these filters
                </h3>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
                  Try clearing some filters to widen your search.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profiles.map((p: any, idx: number) => {
                const sp = new URLSearchParams(parentParamsString);
                sp.set('ids', profileIds.join(','));
                sp.set('idx', String(idx));
                return (
                  <TalentAccessProfileCard
                    key={p.id}
                    profile={p}
                    basePath="/business/talent-access"
                    searchParams={sp.toString()}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
