'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import SubscriptionCardView from '@/components/subscriptions/SubscriptionCardView';
import RespondedListView from '@/components/subscriptions/RespondedListView';
import {
  useMySubscriptionCards,
  type SubscriptionListFilter,
} from '@/hooks/useSubscriptionCards';
import { useTalentMe, useUpdateTalentMe } from '@/hooks/useTalentMe';

const TABS: { key: SubscriptionListFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

export default function TalentOffersView({
  variant = 'subscription',
}: {
  variant?: 'subscription' | 'assignment';
}) {
  const isAssignment = variant === 'assignment';
  const heading = isAssignment ? 'Assignments' : 'Subscriptions';
  const [tab, setTab] = useState<SubscriptionListFilter>('pending');
  const { data, isLoading, isError } = useMySubscriptionCards(tab, variant);
  const { data: pendingCount } = useMySubscriptionCards('pending', variant);

  const pendingNum = (pendingCount ?? []).length;

  return (
    <div className="space-y-6">
      {/* Compact Hero */}
      <section className="hero-container hero-glow-orange relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-6 sm:px-7 sm:py-7">
        <div className="hero-content flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2.5 stagger-1">
              <span className="eyebrow-rainbow">
                {pendingNum > 0 ? `${pendingNum} pending offer${pendingNum === 1 ? '' : 's'}` : 'No pending offers'}
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[26px] sm:text-[30px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              <span className="text-rainbow">{heading}</span>.
            </h1>
            <p className="mt-1.5 font-[family-name:var(--font-jakarta)] text-sm text-[#525252] stagger-3">
              {isAssignment
                ? 'One-off project briefs matched to your profile. Accept or decline each one.'
                : 'Offers pushed to you based on your profile. Accept or decline each one.'}
            </p>
          </div>
        </div>
      </section>

      <WhatsAppUpdatesToggle />

      {/* V5 Tab Control */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-[#F5F5F6] p-1.5 border border-[#E7E7EA]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const count = t.key === 'pending' ? pendingNum : null;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`font-[family-name:var(--font-inter)] inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#0a0a0a] shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]'
                  : 'text-[#525252] hover:text-[#0a0a0a]'
              }`}
            >
              {t.label}
              {count !== null && count > 0 && (
                <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                  isActive ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'bg-[#E7E7EA] text-[#525252]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <div className="h-32 animate-pulse rounded-xl bg-[#f0f0f0]" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-[#f0f0f0]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[#f0f0f0]" />
              <div className="mt-1 h-3 w-5/6 animate-pulse rounded bg-[#f0f0f0]" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-100">
            <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3L13.74 5a2 2 0 00-3.48 0L3.19 16a2 2 0 001.74 3z" />
            </svg>
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-red-900">Could not load {heading.toLowerCase()}</h3>
            <p className="mt-0.5 text-sm text-red-700">Please refresh the page to try again.</p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-6 py-16 text-center">
          <div className="hero-glow-purple absolute inset-0 pointer-events-none" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFFAC2]">
              {tab === 'pending' ? (
                <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-1.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 007.586 13H4" />
                </svg>
              ) : (
                <svg className="h-6 w-6 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              )}
            </div>
            <h3 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              {tab === 'pending'
                ? 'No offers right now'
                : tab === 'accepted'
                  ? 'No accepted offers yet'
                  : 'No declined offers'}
            </h3>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#737373]">
              {tab === 'pending'
                ? `We'll notify you when a brand sends ${isAssignment ? 'an assignment' : 'a subscription'} offer.`
                : tab === 'accepted'
                  ? "You haven't accepted any offers yet."
                  : "You haven't declined any offers."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && tab === 'pending' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {data!.map((item, i) => (
            <div key={item.id} className={`stagger-${Math.min(i + 1, 6)}`}>
              <SubscriptionCardView item={item} />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !isError && (data?.length ?? 0) > 0 && tab !== 'pending' && (
        <RespondedListView items={data!} />
      )}
    </div>
  );
}

function WhatsAppUpdatesToggle() {
  const { data: me, isLoading } = useTalentMe();
  const update = useUpdateTalentMe();

  if (isLoading || !me) return null;

  // Default to enabled when the column hasn't loaded yet (e.g. older user
  // record before the migration ran). The DB default is TRUE.
  const enabled = me.whatsapp_subscription_updates_enabled !== false;

  const handleToggle = () => {
    if (update.isPending) return;
    const next = !enabled;
    update.mutate(
      { whatsapp_subscription_updates_enabled: next },
      {
        onSuccess: () =>
          toast.success(next ? 'WhatsApp updates enabled' : 'WhatsApp updates disabled'),
        onError: () => toast.error('Could not update preference'),
      },
    );
  };

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#E7E7EA] bg-white px-5 py-4">
      <div className="min-w-0">
        <h3 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          WhatsApp updates
        </h3>
        <p className="mt-0.5 text-xs text-[#737373]">
          Get a WhatsApp message when a new opportunity arrives. Throttled so you
          won&apos;t be spammed if several arrive at once.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={handleToggle}
        disabled={update.isPending}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          enabled ? 'bg-emerald-500' : 'bg-[#D4D4D4]'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
