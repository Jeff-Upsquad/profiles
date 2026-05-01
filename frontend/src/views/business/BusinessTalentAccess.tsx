'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useBusinessTalentAccess,
  useBusinessTalentAccessProfiles,
  useBusinessTalentAccessFilterOptions,
} from '@/hooks/useBusiness';
import TalentAccessFilters, { type FilterState } from '@/views/talent-access/TalentAccessFilters';
import TalentAccessProfileCard from '@/components/talent-access/TalentAccessProfileCard';

type Tier = 'junior' | 'pro' | 'elite' | 'custom';

function totalSelected(f: FilterState): number {
  return (
    (f.tier?.length ?? 0) +
    (f.location?.length ?? 0) +
    (f.language?.length ?? 0) +
    (f.skill?.length ?? 0) +
    (f.ai_tool?.length ?? 0)
  );
}

export default function BusinessTalentAccess() {
  const { data: status, isLoading: statusLoading } = useBusinessTalentAccess();
  const categories = status?.categories ?? [];
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [filters, setFilters] = useState<FilterState>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0]!.id);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    setFilters({});
  }, [activeCategoryId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filterOptionsQuery = useBusinessTalentAccessFilterOptions(activeCategoryId || undefined);

  const profilesQuery = useBusinessTalentAccessProfiles({
    category_id: activeCategoryId,
    tier: filters.tier,
    location: filters.location,
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
              onClick={() => setActiveCategoryId(cat.id)}
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

        {/* Profiles grid */}
        <section className="min-w-0">
          {/* Mobile: filters toggle + search + count */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpenMobile((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 lg:hidden"
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
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:w-72 sm:flex-initial"
              />
            </div>
            <p className="text-xs text-zinc-500">
              {profilesQuery.isLoading
                ? 'Loading profiles…'
                : `${total} ${total === 1 ? 'profile' : 'profiles'}`}
            </p>
          </div>

          {/* Filters — mobile (inline collapsible) */}
          {filtersOpenMobile && (
            <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 lg:hidden">
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
          )}

          {profilesQuery.isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {(profilesQuery.error as any)?.response?.data?.error ||
                'Failed to load profiles.'}
            </div>
          ) : profilesQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl border border-zinc-200 bg-white"
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((p: any) => (
                <TalentAccessProfileCard
                  key={p.id}
                  profile={p}
                  basePath="/business/talent-access"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
