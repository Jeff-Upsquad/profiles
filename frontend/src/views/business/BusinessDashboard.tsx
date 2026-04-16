'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useMyCategories } from '@/hooks/useBusiness';

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { data: categories, isLoading } = useMyCategories();

  return (
    <>
      {/* ── Mobile: category list drill-down ── */}
      <div className="md:hidden">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">
            Welcome{user?.company_name ? `, ${user.company_name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Tap a category to browse shared talents.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : !categories?.length ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            No categories assigned yet.
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/business/dashboard/${cat.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </span>
                  {cat.name}
                </span>
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Desktop: welcome message (sidebar drives navigation) ── */}
      <div className="hidden md:flex md:flex-col md:items-center md:justify-center md:py-20">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome{user?.company_name ? `, ${user.company_name}` : ''}!
        </h1>
        <p className="mt-2 max-w-md text-center text-sm text-gray-500">
          Select a category from the sidebar to browse talents shared with you.
        </p>
      </div>
    </>
  );
}
