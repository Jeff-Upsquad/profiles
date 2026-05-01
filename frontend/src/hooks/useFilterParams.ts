'use client';

import { useCallback, useMemo } from 'react';
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
      // Changing category clears filters but keeps search
      replaceParams(filtersToParams({}, id, search));
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
