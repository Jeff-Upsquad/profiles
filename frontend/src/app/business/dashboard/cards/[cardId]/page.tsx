'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useMySubscriptionCard,
  useShortlistedProfilesForCard,
} from '@/hooks/useBusiness';
import type { Profile } from '@/types';

interface Params {
  cardId: string;
}

function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

export default function CardShortlistPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  const router = useRouter();

  const { data: card, isLoading: cardLoading, error: cardError } = useMySubscriptionCard(params.cardId);
  const { data: profiles, isLoading: profilesLoading } = useShortlistedProfilesForCard(params.cardId);

  if (cardLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-gray-700">Card not found.</p>
        <button
          onClick={() => router.push('/business/dashboard')}
          className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const title = card.brand_name
    ? card.subscription_name
      ? `${card.brand_name} · ${card.subscription_name}`
      : card.brand_name
    : 'Subscription card';
  const price = formatPrice(card.monthly_price, card.currency);

  return (
    <>
      {/* Back link */}
      <button
        onClick={() => router.push('/business/dashboard')}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to dashboard
      </button>

      {/* Card details */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-gray-900">{title}</h1>
            {card.plan_name && (
              <p className="mt-0.5 text-sm text-gray-500">{card.plan_name}</p>
            )}
          </div>
          {price && (
            <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
              {price}
            </span>
          )}
        </div>

        {card.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.categories.map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {card.business_nature && (
          <p className="mt-3 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Nature of business:</span>{' '}
            {card.business_nature}
          </p>
        )}

        {card.hours_label && (
          <p className="mt-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Commitment:</span> {card.hours_label}
          </p>
        )}

        {card.working_days && card.working_days.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            <span className="font-medium text-gray-700">Working days:</span>{' '}
            {card.working_days.join(', ')}
          </p>
        )}

        {card.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-gray-700">{card.description}</p>
        )}
      </div>

      {/* Shortlisted talents */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Your shortlisted talents</h2>
        {profiles && (
          <span className="text-xs text-gray-400">{profiles.length} total</span>
        )}
      </div>

      {profilesLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : !profiles || profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-gray-600">No shortlisted talents yet.</p>
          <p className="mt-1 text-xs text-gray-400">
            Browse talents in {card.categories.map((c) => c.name).join(' or ') || 'this card\'s categories'} from the sidebar, then click Shortlist.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <ShortlistedRow key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </>
  );
}

function ShortlistedRow({ profile }: { profile: Profile }) {
  const name = (profile as any)?.talent_user?.full_name ?? 'Unknown talent';
  const location = (profile as any)?.talent_user?.current_location;
  const photo = (profile as any)?.talent_user?.profile_photo_url;
  const categoryName = (profile as any)?.category?.name;
  const initial = name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/business/dashboard/${profile.category_id}/${profile.id}`}
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
