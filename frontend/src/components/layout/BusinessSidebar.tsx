'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';

function TalentPanel({
  categoryId,
  categoryName,
  onBack,
  onNavigate,
}: {
  categoryId: string;
  categoryName: string;
  onBack?: () => void;
  onNavigate?: () => void;
}) {
  const { data: profiles, isLoading } = useSharedProfiles(categoryId);
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full flex-shrink-0 flex-col border-r border-gray-200 bg-white md:w-56">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        {onBack && (
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 md:hidden">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {categoryName}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
                <div className="h-3.5 w-24 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : !profiles?.length ? (
          <p className="px-3 py-4 text-xs text-gray-400">No talents shared yet</p>
        ) : (
          <div className="space-y-0.5">
            {profiles.map((profile: any) => {
              const href = `/business/dashboard/${categoryId}/${profile.id}`;
              const isActive = pathname === href;
              const name = profile.talent_user?.full_name ?? 'Unknown';
              const photo = profile.talent_user?.profile_photo_url;

              return (
                <Link
                  key={profile.id}
                  href={href}
                  onClick={onNavigate}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {photo ? (
                    <img src={photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="truncate">{name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BusinessSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data: categories, isLoading } = useMyCategories();
  const pathname = usePathname();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  // On mobile, track which panel is showing: 'categories' or 'talents'
  const [mobilePanel, setMobilePanel] = useState<'categories' | 'talents'>('categories');

  // Auto-select category from URL
  useEffect(() => {
    if (!categories?.length) return;
    const match = pathname?.match(/^\/business\/dashboard\/([^/]+)/);
    if (match) {
      const catId = match[1];
      if (categories.some((c) => c.id === catId)) {
        setActiveCategoryId(catId);
        setMobilePanel('talents');
      }
    }
  }, [pathname, categories]);

  const isDashboardActive = pathname === '/business/dashboard';
  const activeCategory = categories?.find((c) => c.id === activeCategoryId);

  const handleCategoryClick = (catId: string) => {
    const isActive = activeCategoryId === catId;
    if (isActive) {
      setActiveCategoryId(null);
      setMobilePanel('categories');
    } else {
      setActiveCategoryId(catId);
      setMobilePanel('talents');
    }
  };

  const handleMobileBack = () => {
    setMobilePanel('categories');
  };

  return (
    <>
      {/* ── Mobile: single-panel drill-down ── */}
      <div className="flex h-full w-72 flex-col border-r border-gray-200 bg-white md:hidden">
        {mobilePanel === 'categories' || !activeCategory ? (
          <nav className="flex flex-1 flex-col overflow-y-auto p-3">
            <Link
              href="/business/dashboard"
              onClick={() => { setActiveCategoryId(null); onNavigate?.(); }}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isDashboardActive && !activeCategoryId
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>

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
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeCategoryId === cat.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </nav>
        ) : (
          <TalentPanel
            categoryId={activeCategory.id}
            categoryName={activeCategory.name}
            onBack={handleMobileBack}
            onNavigate={onNavigate}
          />
        )}
      </div>

      {/* ── Desktop: two-panel side by side ── */}
      <div className="hidden md:flex">
        {/* Panel 1: Categories */}
        <div className="flex h-full w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
          <nav className="flex flex-1 flex-col overflow-y-auto p-3">
            <Link
              href="/business/dashboard"
              onClick={() => setActiveCategoryId(null)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isDashboardActive && !activeCategoryId
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Dashboard
            </Link>

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
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeCategoryId === cat.id
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}
          </nav>
        </div>

        {/* Panel 2: Talents (shown when a category is selected) */}
        {activeCategory && (
          <TalentPanel categoryId={activeCategory.id} categoryName={activeCategory.name} />
        )}
      </div>
    </>
  );
}
