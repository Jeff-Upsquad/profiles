'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { FilterState } from '@/views/talent-access/TalentAccessFilters';

const ARRAY_KEYS: (keyof FilterState)[] = [
  'tier',
  'location',
  'country',
  'state',
  'district',
  'language',
  'skill',
  'ai_tool',
];

const STORAGE_KEY = 'business-talent-access-filters';

function parseArray(val: string | null): string[] | undefined {
  if (!val) return undefined;
  const items = val.split(',').filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function filtersToParams(filters: FilterState, category: string, search: string): URLSearchParams {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search) params.set('search', search);
  for (const key of ARRAY_KEYS) {
    const vals = filters[key];
    if (vals && vals.length > 0) {
      params.set(key, vals.join(','));
    }
  }
  return params;
}

function loadStoredFilters(): Record<string, FilterState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredFilters(map: Record<string, FilterState>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be full or unavailable; ignore.
  }
}

export function useFilterParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeCategoryId = searchParams.get('category') ?? '';
  const search = searchParams.get('search') ?? '';

  const filters: FilterState = useMemo(() => {
    const f: FilterState = {};
    for (const key of ARRAY_KEYS) {
      const val = parseArray(searchParams.get(key));
      if (val) (f as any)[key] = val;
    }
    return f;
  }, [searchParams]);

  // Persist current category's filters to localStorage on every change so a
  // round-trip through another category restores them.
  useEffect(() => {
    if (!activeCategoryId) return;
    const stored = loadStoredFilters();
    stored[activeCategoryId] = filters;
    saveStoredFilters(stored);
  }, [filters, activeCategoryId]);

  const replaceParams = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, pathname],
  );

  const setFilters = useCallback(
    (next: FilterState) => {
      replaceParams(filtersToParams(next, activeCategoryId, search));
    },
    [replaceParams, activeCategoryId, search],
  );

  const setCategory = useCallback(
    (id: string) => {
      // Restore the target category's saved filters (empty if never visited)
      // so each tab keeps its own filter set across switches.
      const stored = loadStoredFilters();
      const savedFilters = stored[id] ?? {};
      replaceParams(filtersToParams(savedFilters, id, search));
    },
    [replaceParams, search],
  );

  const setSearch = useCallback(
    (term: string) => {
      replaceParams(filtersToParams(filters, activeCategoryId, term));
    },
    [replaceParams, filters, activeCategoryId],
  );

  return { filters, activeCategoryId, search, setFilters, setCategory, setSearch };
}
