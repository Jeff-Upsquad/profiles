'use client';

import Link from 'next/link';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';
import type { Category, Profile } from '@/types';

export default function BusinessAllProfiles() {
  const { data: categories, isLoading } = useMyCategories();

  const greeting = (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">All profiles</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every accepted talent across your subscribed categories.
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {greeting}
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <>
        {greeting}
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-600">No profiles available yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Profiles appear here once your subscription becomes active.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {greeting}
      <div className="space-y-6">
        {categories.map((cat) => (
          <CategoryProfilesSection key={cat.id} category={cat} />
        ))}
      </div>
    </>
  );
}

function CategoryProfilesSection({ category }: { category: Category }) {
  const { data: profiles, isLoading } = useSharedProfiles(category.id);

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{category.name}</h2>
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  if (!profiles || profiles.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{category.name}</h2>
        <span className="text-xs text-gray-400">{profiles.length}</span>
      </div>
      <div className="space-y-2">
        {profiles.map((profile) => (
          <ProfileRow key={profile.id} profile={profile} categoryId={category.id} />
        ))}
      </div>
    </section>
  );
}

function ProfileRow({ profile, categoryId }: { profile: Profile; categoryId: string }) {
  const name = (profile as any)?.talent_user?.full_name ?? 'Unknown talent';
  const location = (profile as any)?.talent_user?.current_location;
  const photo = (profile as any)?.talent_user?.profile_photo_url;
  const categoryName = (profile as any)?.category?.name;
  const initial = name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/business/dashboard/${categoryId}/${profile.id}`}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{name}</p>
        <p className="truncate text-[11px] text-gray-500">
          {categoryName}
          {categoryName && location ? ' · ' : ''}
          {location}
        </p>
      </div>
      <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
