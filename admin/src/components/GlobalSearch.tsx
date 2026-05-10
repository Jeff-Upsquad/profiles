'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface TalentResult {
  id: string;
  full_name: string;
  phone: string | null;
  current_location: string | null;
  profile_photo_url: string | null;
  is_active: boolean;
}

interface BusinessResult {
  id: string;
  company_name: string;
  contact_person_name: string | null;
  contact_email: string | null;
}

interface LeadResult {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  form_type: string;
  status: string;
  profile_type: string | null;
  auto_approved: boolean;
}

interface SearchResponse {
  talents: TalentResult[];
  businesses: BusinessResult[];
  leads: LeadResult[];
}

export default function GlobalSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input.trim()), 300);
    return () => clearTimeout(t);
  }, [input]);

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ['admin-search', debounced],
    queryFn: async () => {
      const { data } = await api.get('/admin/search', {
        params: { q: debounced },
      });
      return data;
    },
    enabled: debounced.length >= 2,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const flat: Array<{ kind: 'talent' | 'business' | 'lead'; id: string }> = [
    ...(data?.talents ?? []).map((t) => ({ kind: 'talent' as const, id: t.id })),
    ...(data?.businesses ?? []).map((b) => ({ kind: 'business' as const, id: b.id })),
    ...(data?.leads ?? []).map((l) => ({ kind: 'lead' as const, id: l.id })),
  ];

  useEffect(() => {
    setActiveIndex(0);
  }, [debounced]);

  const goTo = (kind: 'talent' | 'business' | 'lead', id: string) => {
    setOpen(false);
    setInput('');
    setDebounced('');
    if (kind === 'business') {
      router.push(`/business/${id}`);
    } else if (kind === 'lead') {
      router.push(`/leads?selected=${id}`);
    } else {
      router.push(`/users/${id}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setInput('');
      setDebounced('');
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flat[activeIndex];
      if (target) goTo(target.kind, target.id);
    }
  };

  const showDropdown = open && debounced.length >= 2;
  const hasResults =
    (data?.talents.length ?? 0) + (data?.businesses.length ?? 0) + (data?.leads.length ?? 0) > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={input}
          placeholder="Search talents and businesses..."
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {isFetching && !data ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">Searching…</div>
          ) : !hasResults ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">No results</div>
          ) : (
            <>
              {(data?.talents ?? []).length > 0 && (
                <div>
                  <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Talents
                  </div>
                  {(data?.talents ?? []).map((t, i) => {
                    const idx = i;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo('talent', t.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                          isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        {t.profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={t.profile_photo_url}
                            alt={t.full_name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                            {t.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <span className="truncate">{t.full_name}</span>
                            {!t.is_active && (
                              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                                Inactive
                              </span>
                            )}
                          </div>
                          {(t.phone || t.current_location) && (
                            <div className="truncate text-xs text-gray-500">
                              {[t.phone, t.current_location].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {(data?.businesses ?? []).length > 0 && (
                <div>
                  <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Businesses
                  </div>
                  {(data?.businesses ?? []).map((b, i) => {
                    const idx = (data?.talents.length ?? 0) + i;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo('business', b.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                          isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-600">
                          {b.company_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {b.company_name}
                          </div>
                          {(b.contact_person_name || b.contact_email) && (
                            <div className="truncate text-xs text-gray-500">
                              {[b.contact_person_name, b.contact_email].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {(data?.leads ?? []).length > 0 && (
                <div>
                  <div className="bg-gray-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Candidates
                  </div>
                  {(data?.leads ?? []).map((l, i) => {
                    const idx =
                      (data?.talents.length ?? 0) + (data?.businesses.length ?? 0) + i;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => goTo('lead', l.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                          isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-xs font-semibold text-amber-700">
                          {l.name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <span className="truncate">{l.name}</span>
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                              {l.profile_type || l.form_type}
                            </span>
                          </div>
                          {(l.phone || l.email) && (
                            <div className="truncate text-xs text-gray-500">
                              {[l.phone, l.email].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
