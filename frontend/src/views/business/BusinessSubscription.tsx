'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMyCategories, useSharedProfiles } from '@/hooks/useBusiness';
import { SkeletonCard } from '@/components/ui/Skeleton';
import type { Category, Profile } from '@/types';

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;

function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

function initials(name: string | undefined | null): string {
  if (!name) return 'T';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || 'T';
}

export default function BusinessSubscription() {
  const { data: categories, isLoading } = useMyCategories();
  const [activeCategoryId, setActiveCategoryId] = useState('');

  useEffect(() => {
    if (categories && categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0]!.id);
    }
  }, [categories, activeCategoryId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6">
          <div className="h-7 w-40 animate-pulse rounded bg-[#f0f0f0]" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-[#f0f0f0]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {(categories ?? []).length} {(categories ?? []).length === 1 ? 'category' : 'categories'} subscribed
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              My <span className="text-rainbow">subscription</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              Categories you&apos;re subscribed to. Tap a category to see talents who accepted.
            </p>
          </div>
        </div>
      </section>

      {!categories || categories.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F2FCBC]">
              <svg className="h-7 w-7 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
              </svg>
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#0a0a0a]">
              No subscribed categories yet
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              Categories will appear here once your subscription becomes active.
            </p>
          </div>
        </div>
      ) : (
        <>
          <CategoryChipTabs
            categories={categories}
            activeId={activeCategoryId}
            onChange={setActiveCategoryId}
          />
          {activeCategoryId && <AcceptedProfilesList categoryId={activeCategoryId} />}
        </>
      )}
    </div>
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
    <nav
      className="flex gap-2 overflow-x-auto pb-1 stagger-4"
      aria-label="Subscription categories"
    >
      {categories.map((cat) => {
        const isActive = activeId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-[family-name:var(--font-inter)] text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
              isActive
                ? 'bg-[#0a0a0a] text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.15)]'
                : 'bg-[#F2FCBC] text-[#0a0a0a] hover:bg-[#E5DFFC]'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}

function AcceptedProfilesList({ categoryId }: { categoryId: string }) {
  const { data: profiles, isLoading } = useSharedProfiles(categoryId);

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white">
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[#f0f0f0]" />
          ))}
        </div>
      </div>
    );
  }

  if (!profiles || profiles.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8E5DE] bg-white px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F2FCBC]">
          <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h3 className="mb-1 font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          No accepted profiles yet
        </h3>
        <p className="max-w-sm mx-auto text-sm text-[#737373]">
          Profiles appear here once talents accept their subscription invitation.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <ul className="divide-y divide-[#E8E5DE]">
        {profiles.map((profile, i) => (
          <ProfileRow
            key={profile.id}
            profile={profile}
            categoryId={categoryId}
            index={i}
          />
        ))}
      </ul>
    </div>
  );
}

function ProfileRow({
  profile,
  categoryId,
  index,
}: {
  profile: Profile;
  categoryId: string;
  index: number;
}) {
  const name = (profile as any)?.talent_user?.full_name ?? 'Unknown talent';
  const location = (profile as any)?.talent_user?.current_location;
  const photo = (profile as any)?.talent_user?.profile_photo_url;
  const categoryName = (profile as any)?.category?.name;
  const tint = tintFor(profile.id);

  return (
    <li className={`stagger-${Math.min(index + 1, 6)}`}>
      <Link
        href={`/business/dashboard/${categoryId}/${profile.id}`}
        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F7F6F3] sm:px-6"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name}
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className={`${tint} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-jakarta)] text-sm font-semibold`}
            style={{ color: 'var(--tint-icon)' }}
          >
            {initials(name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
            {name}
          </p>
          <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
            {categoryName}
            {categoryName && location ? ' · ' : ''}
            {location}
          </p>
        </div>
        <svg
          className="h-4 w-4 shrink-0 text-[#a3a3a3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0a0a0a]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.25}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}
