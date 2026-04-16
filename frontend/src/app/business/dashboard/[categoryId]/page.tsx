'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';

interface Params {
  categoryId: string;
}

export default function CategoryProfilesPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: categories } = useMyCategories();
  const { data: profiles, isLoading } = useSharedProfiles(params.categoryId);

  const category = categories?.find((c) => c.id === params.categoryId);

  // On desktop, this route has no main-content representation (sidebar drives
  // navigation). Bounce to the dashboard landing page so the user sees something.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    if (mq.matches) router.replace('/business/dashboard');
  }, [router]);

  return (
    <div className="md:hidden">
      {/* Header with back button */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.push('/business/dashboard')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="Back to categories"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Category
          </div>
          <h1 className="text-lg font-bold text-gray-900">
            {category?.name ?? 'Loading...'}
          </h1>
        </div>
      </div>

      {/* Profile list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : !profiles?.length ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          No talents shared in this category yet.
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile: any) => {
            const name = profile.talent_user?.full_name ?? 'Unknown';
            const photo = profile.talent_user?.profile_photo_url;
            const location = profile.talent_user?.current_location;

            return (
              <Link
                key={profile.id}
                href={`/business/dashboard/${params.categoryId}/${profile.id}`}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:bg-gray-50"
              >
                {photo ? (
                  <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600">
                    {name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-gray-900">{name}</div>
                  {location && (
                    <div className="truncate text-xs text-gray-500">{location}</div>
                  )}
                </div>
                <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
