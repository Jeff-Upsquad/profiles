'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useMySubscriptionCard,
  useCardRecipients,
  useReviewCardRecipient,
  useSelectCardRecipient,
  type CardRecipientForBusiness,
} from '@/hooks/useBusiness';

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

function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

export default function SubscriptionCardReview({ cardId }: { cardId: string }) {
  const router = useRouter();
  const { data: card, isLoading: cardLoading, error: cardError } = useMySubscriptionCard(cardId);
  const { data: recipients, isLoading: recipientsLoading } = useCardRecipients(cardId);
  const reviewMutation = useReviewCardRecipient(cardId);
  const selectMutation = useSelectCardRecipient(cardId);
  const [confirmSelect, setConfirmSelect] = useState<CardRecipientForBusiness | null>(null);

  const hasSelection = useMemo(() => {
    return (recipients ?? []).some((r) => r.selected_at);
  }, [recipients]);

  const forReview = useMemo(() => {
    return (recipients ?? []).filter(
      (r) => !r.business_review_status && !r.selected_at && !r.passed_over_at,
    );
  }, [recipients]);

  const shortlisted = useMemo(() => {
    return (recipients ?? []).filter(
      (r) => r.business_review_status === 'shortlisted' && !r.selected_at && !r.passed_over_at,
    );
  }, [recipients]);

  const selected = useMemo(() => {
    return (recipients ?? []).filter((r) => r.selected_at);
  }, [recipients]);

  if (cardLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-16 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (cardError || !card) {
    return (
      <div className="rounded-2xl border border-[#E8E5DE] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Card not found.</p>
        <button
          onClick={() => router.push('/business/subscription')}
          className="mt-3 text-xs font-medium text-indigo-600 hover:underline"
        >
          Back to subscriptions
        </button>
      </div>
    );
  }

  const title = card.brand_name
    ? card.subscription_name
      ? `${card.brand_name} · ${card.subscription_name}`
      : card.brand_name
    : 'Subscription card';
  const price = formatPrice(card.customer_monthly_price, card.currency);

  function handleReview(recipientId: string, action: 'shortlist' | 'reject' | 'unshortlist') {
    reviewMutation.mutate({ recipientId, action });
  }

  function handleSelect(recipient: CardRecipientForBusiness) {
    setConfirmSelect(recipient);
  }

  function confirmSelection() {
    if (!confirmSelect) return;
    selectMutation.mutate(confirmSelect.recipient_id, {
      onSuccess: () => setConfirmSelect(null),
    });
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push('/business/subscription')}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] hover:text-[#0a0a0a] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to subscriptions
      </button>

      {/* Card details */}
      <div className="rounded-2xl border border-[#E8E5DE] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              {title}
            </h1>
            {card.plan_name && (
              <p className="mt-0.5 text-sm text-[#737373]">{card.plan_name}</p>
            )}
          </div>
          {price && (
            <span className="shrink-0 rounded-full bg-[#F2FCBC] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
              {price}
            </span>
          )}
        </div>

        {card.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.categories.map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-[#E5DFFC] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {card.business_nature && (
          <p className="mt-3 text-xs text-[#737373]">
            <span className="font-medium text-[#0a0a0a]">Nature of business:</span>{' '}
            {card.business_nature}
          </p>
        )}
        {card.hours_label && (
          <p className="mt-1 text-xs text-[#737373]">
            <span className="font-medium text-[#0a0a0a]">Commitment:</span> {card.hours_label}
          </p>
        )}
        {card.working_days && card.working_days.length > 0 && (
          <p className="mt-1 text-xs text-[#737373]">
            <span className="font-medium text-[#0a0a0a]">Working days:</span>{' '}
            {card.working_days.join(', ')}
          </p>
        )}
        {card.description && (
          <p className="mt-3 whitespace-pre-line text-sm text-[#525252]">{card.description}</p>
        )}
      </div>

      {/* Selected talent */}
      {selected.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-emerald-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Selected Talent
          </h2>
          {selected.map((r) => (
            <RecipientRow key={r.recipient_id} recipient={r} variant="selected" />
          ))}
        </div>
      )}

      {/* New talents for review */}
      {recipientsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#f0f0f0]" />
          ))}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#E8E5DE] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                  New talents for review
                </h2>
                <span className="text-xs text-[#a3a3a3]">{forReview.length} total</span>
              </div>
            </div>

            {forReview.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No new talents to review.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E8E5DE]">
                {forReview.map((r) => (
                  <li key={r.recipient_id} className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-4">
                      <RecipientLink recipient={r}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} />
                      </RecipientLink>
                      {!hasSelection && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            disabled={reviewMutation.isPending}
                            onClick={() => handleReview(r.recipient_id, 'shortlist')}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Shortlist
                          </button>
                          <button
                            type="button"
                            disabled={reviewMutation.isPending}
                            onClick={() => handleReview(r.recipient_id, 'reject')}
                            className="rounded-lg border border-[#E8E5DE] px-3 py-1.5 text-xs font-semibold text-[#737373] transition-colors hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Shortlisted */}
          <div className="rounded-2xl border border-[#E8E5DE] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#E8E5DE] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                  Shortlisted
                </h2>
                <span className="text-xs text-[#a3a3a3]">{shortlisted.length} total</span>
              </div>
            </div>

            {shortlisted.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No shortlisted talents yet. Review talents above to add them here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E8E5DE]">
                {shortlisted.map((r) => (
                  <li key={r.recipient_id} className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-4">
                      <RecipientLink recipient={r}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} />
                      </RecipientLink>
                      {!hasSelection && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            disabled={reviewMutation.isPending}
                            onClick={() => handleReview(r.recipient_id, 'unshortlist')}
                            className="rounded-lg border border-[#E8E5DE] px-3 py-1.5 text-xs font-semibold text-[#737373] transition-colors hover:bg-[#F7F6F3] disabled:opacity-50"
                          >
                            Unshortlist
                          </button>
                          <button
                            type="button"
                            disabled={selectMutation.isPending}
                            onClick={() => handleSelect(r)}
                            className="rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
                          >
                            Select
                          </button>
                        </div>
                      )}
                      {hasSelection && (
                        <span className="shrink-0 rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-medium text-[#737373]">
                          Not selected
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Selection confirmation modal */}
      {confirmSelect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmSelect(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#E8E5DE] bg-white p-6 shadow-2xl">
            <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              Confirm selection
            </h3>
            <p className="mt-2 text-sm text-[#525252]">
              You are about to select <strong>{confirmSelect.talent_name || 'this talent'}</strong>.
              Only one talent can be selected per card and this action cannot be undone.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSelect(null)}
                className="rounded-lg border border-[#E8E5DE] px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F7F6F3]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectMutation.isPending}
                onClick={confirmSelection}
                className="rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                {selectMutation.isPending ? 'Selecting…' : 'Select talent'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipientAvatar({ recipient: r }: { recipient: CardRecipientForBusiness }) {
  const tint = tintFor(r.recipient_id);
  if (r.profile_photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={r.profile_photo_url}
        alt={r.talent_name ?? ''}
        className="h-11 w-11 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      className={`${tint} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-[family-name:var(--font-jakarta)] text-sm font-semibold`}
      style={{ color: 'var(--tint-icon)' }}
    >
      {initials(r.talent_name)}
    </div>
  );
}

function RecipientInfo({ recipient: r }: { recipient: CardRecipientForBusiness }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
          {r.talent_name || 'Unknown talent'}
        </p>
        {r.tier && (
          <span className="shrink-0 rounded-full bg-[#E5DFFC] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a]">
            {r.tier_custom || r.tier}
          </span>
        )}
      </div>
      <p className="mt-0.5 truncate font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
        {r.category?.name}
        {r.category?.name && r.current_location ? ' · ' : ''}
        {r.current_location}
      </p>
    </div>
  );
}

function RecipientLink({ recipient: r, children }: { recipient: CardRecipientForBusiness; children: React.ReactNode }) {
  if (r.profile_id && r.category?.id) {
    return (
      <Link
        href={`/business/dashboard/${r.category.id}/${r.profile_id}`}
        className="flex min-w-0 flex-1 items-center gap-4 transition-opacity hover:opacity-70"
      >
        {children}
      </Link>
    );
  }
  return <div className="flex min-w-0 flex-1 items-center gap-4">{children}</div>;
}

function RecipientRow({
  recipient: r,
  variant,
}: {
  recipient: CardRecipientForBusiness;
  variant: 'selected';
}) {
  return (
    <div className="flex items-center gap-4">
      <RecipientLink recipient={r}>
        <RecipientAvatar recipient={r} />
        <RecipientInfo recipient={r} />
      </RecipientLink>
      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        Selected
      </span>
    </div>
  );
}
