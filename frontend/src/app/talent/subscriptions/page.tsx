'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import SubscriptionCardView from '@/components/subscriptions/SubscriptionCardView';
import RespondedListView from '@/components/subscriptions/RespondedListView';
import {
  useMySubscriptionCards,
  type SubscriptionListFilter,
} from '@/hooks/useSubscriptionCards';

const TABS: { key: SubscriptionListFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'responded', label: 'Responded' },
];

export default function SubscriptionsPage() {
  const [tab, setTab] = useState<SubscriptionListFilter>('pending');
  const { data, isLoading, isError } = useMySubscriptionCards(tab);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Offers pushed to you based on your profile. Accept or reject each one.
        </p>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-gray-100" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-gray-100" />
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <p className="text-sm text-red-600">
            Could not load subscriptions. Please refresh.
          </p>
        </Card>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <Card>
          <p className="text-sm text-neutral-600">
            {tab === 'pending'
              ? 'No subscription offers right now — check back soon.'
              : 'You haven\u2019t responded to any offers yet.'}
          </p>
        </Card>
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && tab === 'pending' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {data!.map((item) => (
            <SubscriptionCardView key={item.id} item={item} />
          ))}
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && tab === 'responded' && (
        <RespondedListView items={data!} />
      )}
    </div>
  );
}
