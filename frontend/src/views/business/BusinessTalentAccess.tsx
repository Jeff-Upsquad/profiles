'use client';

import { useEffect, useMemo, useState } from 'react';
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

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
      </div>
    );
  }

  if (!status?.has_access) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-600">No talent profile access.</p>
        <p className="mt-1 text-xs text-gray-400">
          Contact the administrator to get access to talent profiles.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 md:text-2xl">Talent Profiles</h1>
          {expiresInDays !== null && (
            <span className="text-xs text-zinc-500">
              Access expires in{' '}
              <span className="font-medium text-zinc-700">
                {expiresInDays} day{expiresInDays === 1 ? '' : 's'}
              </span>
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Browse talent profiles shared with your account.
        </p>
      </div>

      {/* Category tabs */}
      {categories.length > 1 && (
        <nav className="mb-5 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* Body */}
      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Filters — desktop */}
        <div className="hidden min-w-0 lg:block">
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

        {/* Profiles list */}
        <section className="min-w-0">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-72 sm:flex-initial"
              />
              <button
                type="button"
                onClick={() => setFiltersOpenMobile(true)}
                className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 lg:hidden"
                aria-haspopup="dialog"
                aria-expanded={filtersOpenMobile}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Filters
                {filterCount > 0 && (
                  <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-900 px-1.5 text-[10px] font-semibold text-white">
                    {filterCount}
                  </span>
                )}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {profilesQuery.isLoading
                ? 'Loading profiles…'
                : `${total} ${total === 1 ? 'profile' : 'profiles'}`}
            </p>
          </div>

          {/* Filters drawer (mobile) */}
          {filtersOpenMobile && (
            <div className="lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
              <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
                onClick={() => setFiltersOpenMobile(false)}
                aria-hidden
              />
              <div className="fixed inset-y-0 right-0 z-50 flex w-[88%] max-w-sm flex-col border-l border-zinc-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
                  <h2 className="text-sm font-semibold text-zinc-900">Filters</h2>
                  <button
                    onClick={() => setFiltersOpenMobile(false)}
                    className="-mr-1 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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
                <div className="border-t border-zinc-200 px-4 py-3">
                  <button
                    onClick={() => setFiltersOpenMobile(false)}
                    className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 active:scale-[0.98]"
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
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {(profilesQuery.error as any)?.response?.data?.error ||
                'Failed to load profiles.'}
            </div>
          ) : profilesQuery.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-zinc-200 bg-white"
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">
                No profiles match these filters
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Try clearing some filters to widen your search.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {profiles.map((p: any, idx: number) => {
                const sp = new URLSearchParams();
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
