'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';
import type { Category, Profile } from '@/types';

export default function BusinessSubscription() {
  const { data: categories, isLoading } = useMyCategories();
  const [activeCategoryId, setActiveCategoryId] = useState('');

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0]!.id);
    }
  }, [categories, activeCategoryId]);

  const greeting = (
    <div className="mb-5">
      <h1 className="text-xl font-bold text-gray-900 md:text-2xl">My subscription</h1>
      <p className="mt-1 text-sm text-gray-500">
        Categories you're subscribed to. Tap a category to see the talents who accepted.
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <>
        {greeting}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
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
          <p className="text-sm font-medium text-gray-600">No subscribed categories yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Categories appear here once your subscription becomes active.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {greeting}
      <CategoryChipTabs
        categories={categories}
        activeId={activeCategoryId}
        onChange={setActiveCategoryId}
      />
      {activeCategoryId && <AcceptedProfilesList categoryId={activeCategoryId} />}
    </>
  );
}

function CategoryChipTabs({
  categories,
  activeId,
  onChange,
}: {
  categories: Category[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="mb-4 flex gap-2 overflow-x-auto" aria-label="Subscription categories">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            activeId === cat.id
              ? 'bg-indigo-600 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
          }`}
        >
          {cat.name}
        </button>
      ))}
    </nav>
  );
}

function AcceptedProfilesList({ categoryId }: { categoryId: string }) {
  const { data: profiles, isLoading } = useSharedProfiles(categoryId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-600">No accepted profiles in this category yet.</p>
        <p className="mt-1 text-xs text-gray-400">
          Profiles appear here once talents accept their subscription invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {profiles.map((profile) => (
        <ProfileRow key={profile.id} profile={profile} categoryId={categoryId} />
      ))}
    </div>
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
