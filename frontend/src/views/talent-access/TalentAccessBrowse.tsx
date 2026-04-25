'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useTalentAccessSession,
  useTalentAccessProfiles,
  clearSession,
  type AccessSessionMeta,
  type Tier,
} from '@/hooks/useTalentAccess';
import TalentAccessFilters, { type FilterState } from './TalentAccessFilters';
import TalentAccessProfileCard from '@/components/talent-access/TalentAccessProfileCard';

interface Props {
  meta: AccessSessionMeta;
  onLogout: () => void;
}

const VALID_TIERS: Tier[] = ['junior', 'pro', 'elite', 'custom'];

function totalSelected(f: FilterState): number {
  return (
    (f.tier?.length ?? 0) +
    (f.location?.length ?? 0) +
    (f.language?.length ?? 0) +
    (f.skill?.length ?? 0) +
    (f.ai_tool?.length ?? 0)
  );
}

export default function TalentAccessBrowse({ meta, onLogout }: Props) {
  const initialCategoryId = meta.categories[0]?.id ?? '';
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);
  const [filters, setFilters] = useState<FilterState>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // Reset filters whenever the user switches category — different categories
  // have different filter dimensions (skills, AI tools).
  useEffect(() => {
    setFilters({});
  }, [activeCategoryId]);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // If admin removes the active category mid-session, snap to the first granted one
  useEffect(() => {
    if (
      meta.categories.length > 0 &&
      !meta.categories.some((c) => c.id === activeCategoryId)
    ) {
      setActiveCategoryId(meta.categories[0]!.id);
    }
  }, [meta.categories, activeCategoryId]);

  const profilesQuery = useTalentAccessProfiles({
    category_id: activeCategoryId,
    tier: filters.tier,
    location: filters.location,
    language: filters.language,
    skill: filters.skill,
    ai_tool: filters.ai_tool,
    search: debouncedSearch || undefined,
  });

  const expiresInDays = useMemo(() => {
    const ms = new Date(meta.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [meta.expires_at]);

  const profiles = profilesQuery.data?.profiles ?? [];
  const total = profilesQuery.data?.total ?? 0;
  const filterCount = totalSelected(filters);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-base font-semibold text-zinc-900">
              Talent Profile Access
            </h1>
            <span className="hidden truncate rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 sm:inline">
              {meta.email}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span className="truncate">
              Access expires in{' '}
              <span className="font-medium text-zinc-700">
                {expiresInDays} day{expiresInDays === 1 ? '' : 's'}
              </span>
            </span>
            <button
              onClick={() => {
                clearSession();
                onLogout();
              }}
              className="shrink-0 rounded-md px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Category tabs */}
        {meta.categories.length > 1 && (
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <nav className="flex gap-2 overflow-x-auto pb-2">
              {meta.categories.map((cat) => (
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
          </div>
        )}
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar — desktop */}
          <div className="hidden min-w-0 lg:block">
            {activeCategoryId && (
              <TalentAccessFilters
                categoryId={activeCategoryId}
                value={filters}
                onChange={setFilters}
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2 4h12M4 8h8M6 12h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
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

            {/* Sidebar — mobile (inline collapsible) */}
            {filtersOpenMobile && (
              <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 lg:hidden">
                {activeCategoryId && (
                  <TalentAccessFilters
                    categoryId={activeCategoryId}
                    value={filters}
                    onChange={setFilters}
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
                {profiles.map((p) => (
                  <TalentAccessProfileCard key={p.id} profile={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// Re-export tier list for any consumer that needs validation
export { VALID_TIERS };
