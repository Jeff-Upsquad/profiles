'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';

function TalentList({ categoryId }: { categoryId: string }) {
  const { data: profiles, isLoading } = useSharedProfiles(categoryId);
  const pathname = usePathname();

  if (isLoading) {
    return (
      <div className="space-y-2 px-2 py-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2">
            <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
            <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  if (!profiles?.length) {
    return (
      <p className="px-5 py-3 text-xs text-gray-400">No talents shared yet</p>
    );
  }

  return (
    <div className="space-y-0.5 px-2 py-1">
      {profiles.map((profile: any) => {
        const href = `/business/dashboard/${categoryId}/${profile.id}`;
        const isActive = pathname === href;
        const name = profile.talent_user?.full_name ?? 'Unknown';
        const photo = profile.talent_user?.profile_photo_url;

        return (
          <Link
            key={profile.id}
            href={href}
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-indigo-50 text-indigo-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {photo ? (
              <img src={photo} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                {name[0]?.toUpperCase()}
              </div>
            )}
            <span className="truncate">{name}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function BusinessSidebar() {
  const { data: categories, isLoading } = useMyCategories();
  const pathname = usePathname();
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

  const isDashboardActive = pathname === '/business/dashboard';

  const toggleCategory = (catId: string) => {
    setExpandedCategoryId((prev) => (prev === catId ? null : catId));
  };

  return (
    <nav className="flex h-full flex-col overflow-y-auto p-3">
      {/* Dashboard link */}
      <Link
        href="/business/dashboard"
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isDashboardActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
        Dashboard
      </Link>

      {/* Categories section label */}
      <div className="mt-5 mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Categories
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mx-3 h-9 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : !categories?.length ? (
        <p className="px-3 text-xs text-gray-400">No categories assigned</p>
      ) : (
        <div className="space-y-0.5">
          {categories.map((cat) => {
            const isExpanded = expandedCategoryId === cat.id;
            const isCategoryActive = pathname?.startsWith(`/business/dashboard/${cat.id}`);

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isCategoryActive || isExpanded
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && <TalentList categoryId={cat.id} />}
              </div>
            );
          })}
        </div>
      )}
    </nav>
  );
}
