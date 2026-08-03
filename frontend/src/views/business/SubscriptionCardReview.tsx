'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMySubscriptionCard,
  useCardRecipients,
  useReviewCardRecipient,
  useSelectCardRecipient,
  type CardRecipientForBusiness,
} from '@/hooks/useBusiness';
import { FirstItemTip } from '@/components/ui/FirstItemTip';
import BusinessAssignmentOffers from '@/components/subscriptions/BusinessAssignmentOffers';
import { formatDate as formatLongDate } from '@/lib/formatDate';

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

// Format an ISO date ("2026-07-15") as "15 July 2026". Parsed as local midnight
// so the day doesn't shift by timezone.
function fmtDate(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return formatLongDate(d);
}

// Map a talent/plan tier to one of the three standard review buckets. Mixed
// case folds onto the canonical name. Custom/unknown tiers return null —
// they only show under the "All" tab.
function normalizeTier(tier: string | null | undefined): string | null {
  const t = (tier ?? '').toLowerCase().trim();
  if (t === 'junior') return 'Junior';
  if (t === 'pro') return 'Pro';
  if (t === 'top talents') return 'Top Talents';
  return null;
}

// Highest tier first, matching the requested All · Top talents · Pro · Junior order.
const TIER_TAB_ORDER = ['Top Talents', 'Pro', 'Junior'];

export default function SubscriptionCardReview({
  cardId,
  variant = 'subscription',
}: {
  cardId: string;
  variant?: 'subscription' | 'assignment';
}) {
  const router = useRouter();
  // Assignments reuse this review view but live under their own route, so the
  // back-nav + labels read "assignments" instead of "subscription".
  const isAssignment = variant === 'assignment';
  const backHref = '/business/hire';
  const backLabel = 'Back to Find talent';
  const { user } = useAuth();
  const { data: card, isLoading: cardLoading, error: cardError } = useMySubscriptionCard(cardId);
  const { data: recipients, isLoading: recipientsLoading } = useCardRecipients(cardId);
  const reviewMutation = useReviewCardRecipient(cardId);
  const selectMutation = useSelectCardRecipient(cardId);
  const [confirmSelect, setConfirmSelect] = useState<CardRecipientForBusiness | null>(null);
  // Active tier sub-tab ('all' or a normalized tier). Only shown for multi-tier
  // briefs, where the review sections split into All · Top talents · Pro · Junior.
  const [activeTier, setActiveTier] = useState<string>('all');

  const hasSelection = useMemo(() => {
    return (recipients ?? []).some((r) => r.selected_at);
  }, [recipients]);

  // Tiers this brief spans, ordered highest-first, used to build the sub-tabs.
  const groupTiers = useMemo(() => {
    const present = new Set<string>();
    for (const t of card?.target_tiers ?? []) {
      const n = normalizeTier(t);
      if (n) present.add(n);
    }
    return TIER_TAB_ORDER.filter((t) => present.has(t));
  }, [card?.target_tiers]);

  const isClosed = card?.status === 'archived' || !!card?.recalled_at;

  // Passed-over talents stay in the lists (greyed out + disabled buttons) so
  // the customer can still click through to view a profile after a selection
  // has been made — useful for reference or a side-by-side compare.
  const forReview = useMemo(() => {
    return (recipients ?? []).filter(
      (r) => !r.business_review_status && !r.selected_at,
    );
  }, [recipients]);

  const shortlisted = useMemo(() => {
    return (recipients ?? []).filter(
      (r) => r.business_review_status === 'shortlisted' && !r.selected_at,
    );
  }, [recipients]);

  const selected = useMemo(() => {
    return (recipients ?? []).filter((r) => r.selected_at);
  }, [recipients]);

  // Tier sub-tab filtering applied to both review sections.
  const tierMatches = (r: CardRecipientForBusiness) =>
    activeTier === 'all' || normalizeTier(r.tier) === activeTier;
  const forReviewView = forReview.filter(tierMatches);
  const shortlistedView = shortlisted.filter(tierMatches);
  const tierCount = (key: string) => {
    const pool = [...forReview, ...shortlisted];
    return key === 'all' ? pool.length : pool.filter((r) => normalizeTier(r.tier) === key).length;
  };

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
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Card not found.</p>
        <button
          onClick={() => router.push(backHref)}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  // Prefer the company over the brand for the title — the brand is often the
  // brand the talent will work *on*, not the customer's name. Fall back to
  // brand, then subscription_name.
  const titleLead = card.customer_company || card.brand_name || card.subscription_name || (isAssignment ? 'Assignment card' : 'Subscription card');
  const title = card.subscription_name && titleLead !== card.subscription_name
    ? `${titleLead} · ${card.subscription_name}`
    : titleLead;
  const price = formatPrice(card.customer_monthly_price, card.currency);
  // Assignments are one-off projects — show the budget without the "/mo" suffix.
  const priceDisplay = isAssignment && price ? price.replace(/\/mo$/, '') : price;
  const timeline = card.assignment_details ?? null;
  // Assignment is per tier sibling (grouped briefs assign each tier
  // independently), so read activation per selected recipient — their own tier
  // card's subscription_activated_at — not the fetched card's. Activated =
  // Assigned; not yet = Selected (pending admin approval).
  const selectedAssigned = selected.filter((r) => r.subscription_activated_at);
  const selectedPending = selected.filter((r) => !r.subscription_activated_at);

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
    <div className="space-y-4">
      {/* Back */}
      <button
        onClick={() => router.push(backHref)}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] hover:text-[#0a0a0a] transition-colors"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </button>

      {/* Card details */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              {title}
            </h1>
            {card.plan_name && (
              <p className="mt-0.5 text-sm text-[#737373]">{card.plan_name}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isClosed && (
              <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-xs font-semibold text-[#737373]">
                {card.recalled_at ? 'Recalled' : 'Closed'}
              </span>
            )}
            {price && (
              <span className="rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
                {priceDisplay}
              </span>
            )}
          </div>
        </div>

        {card.categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {card.categories.map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}

        {/* === Subscription / Assignment === plan, tier, hours, working days, deliverables */}
        <Section title={isAssignment ? 'Assignment' : 'Subscription'}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {card.subscription_name && (
              <DetailRow label="Service">{card.subscription_name}</DetailRow>
            )}
            {card.plan_name && (
              <DetailRow label="Plan">{card.plan_name}</DetailRow>
            )}
            {card.target_tiers.length > 0 && (
              <DetailRow label={card.target_tiers.length === 1 ? 'Tier' : 'Tiers'}>
                {card.target_tiers.join(', ')}
              </DetailRow>
            )}
            {card.hours_label && (
              <DetailRow label="Availability">{card.hours_label}</DetailRow>
            )}
            {!isAssignment && card.working_days && card.working_days.length > 0 && (
              <DetailRow label="Working days">{card.working_days.join(', ')}</DetailRow>
            )}
          </dl>
          {card.custom_deliverables.length > 0 && (
            <div className="mt-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                Custom deliverables
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-[#0a0a0a]">
                {card.custom_deliverables.map((d, i) => {
                  const cadence = [
                    d.per_day ? `${d.per_day}/day` : null,
                    d.per_week ? `${d.per_week}/week` : null,
                    d.per_month ? `${d.per_month}/month` : null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <li key={d.id ?? i} className="flex items-baseline gap-2">
                      <span className="font-medium">{d.name || '—'}</span>
                      {cadence && <span className="text-xs text-[#737373]">{cadence}</span>}
                      {d.kind && <span className="text-[10px] text-[#a3a3a3] uppercase">{d.kind}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Section>

        {/* === Location & languages === */}
        {(card.target_regions.length > 0 || card.target_languages.length > 0) && (
          <Section title="Location & languages">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {card.target_regions.length > 0 && (
                <DetailRow label={card.target_regions.length === 1 ? 'Region' : 'Regions'}>
                  {card.target_regions.map((r) => r.region).join(', ')}
                </DetailRow>
              )}
              {card.target_languages.length > 0 && (
                <DetailRow label={card.target_languages.length === 1 ? 'Language' : 'Languages'}>
                  {card.target_languages.join(', ')}
                </DetailRow>
              )}
            </dl>
          </Section>
        )}

        {/* === Budget === */}
        {price && (
          <Section title={isAssignment ? 'Project budget' : 'Budget'}>
            <p className="text-lg font-semibold text-[#0a0a0a]">{priceDisplay}</p>
          </Section>
        )}

        {/* === Timeline (assignments only) === */}
        {isAssignment && timeline && (timeline.duration || timeline.start_date || timeline.deadline) && (
          <Section title="Timeline">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {timeline.duration && <DetailRow label="Duration">{timeline.duration}</DetailRow>}
              {timeline.start_date && <DetailRow label="Start date">{fmtDate(timeline.start_date)}</DetailRow>}
              {timeline.deadline && <DetailRow label="Deadline">{fmtDate(timeline.deadline)}</DetailRow>}
            </dl>
          </Section>
        )}

        {/* === Scope & deliverables (assignments) — the client's project brief === */}
        {isAssignment && card.description && (
          <Section title="Scope & deliverables">
            <p className="whitespace-pre-line text-sm text-[#525252]">{card.description}</p>
          </Section>
        )}

        {/* === About the brand === customer's own brief */}
        {(card.brand_name || card.business_nature || card.customer_location || (!isAssignment && card.description)) && (
          <Section title="About the brand">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {card.brand_name && card.brand_name !== card.customer_company && (
                <DetailRow label="Brand">{card.brand_name}</DetailRow>
              )}
              {card.business_nature && (
                <DetailRow label="Nature of business">{card.business_nature}</DetailRow>
              )}
              {card.customer_location && (
                <DetailRow label="Location of business">{card.customer_location}</DetailRow>
              )}
            </dl>
            {!isAssignment && card.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-[#525252]">
                {card.description}
              </p>
            )}
          </Section>
        )}
      </div>

      {/* Offers & negotiations (assignments) — talents submit/counter figures;
          the business counters, or accepts (which selects that talent). */}
      {isAssignment && (
        <BusinessAssignmentOffers cardId={cardId} currency={card.currency} disabled={isClosed || hasSelection} />
      )}

      {/* Assigned talent(s) — a SquadHub admin approved the pick (this talent's
          tier card is activated). The confirmed emerald design. */}
      {selectedAssigned.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-5 sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-emerald-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {selectedAssigned.length === 1 ? 'Assigned Talent' : 'Assigned Talents'}
          </h2>
          <div className="space-y-3">
            {selectedAssigned.map((r) => (
              <RecipientRow key={r.recipient_id} recipient={r} variant="assigned" />
            ))}
          </div>
        </div>
      )}

      {/* Selected — pending admin confirmation (this talent's tier card is not
          activated yet). Amber, distinct from the confirmed Assigned design. */}
      {selectedPending.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-5 sm:p-6">
          <h2 className="mb-1 flex items-center gap-2 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-amber-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Selected — pending confirmation
          </h2>
          <p className="mb-3 text-xs text-amber-700">
            We&rsquo;re finalising this assignment. You&rsquo;ll see it confirmed here shortly.
          </p>
          <div className="space-y-3">
            {selectedPending.map((r) => (
              <RecipientRow key={r.recipient_id} recipient={r} variant="selected" />
            ))}
          </div>
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
          {/* Tier sub-tabs — only for multi-tier briefs. Filters both the
              "New talents for review" and "Shortlisted" sections below. */}
          {groupTiers.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E7E7EA] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              {[{ key: 'all', label: 'All' }, ...groupTiers.map((t) => ({ key: t, label: t }))].map((tab) => {
                const isActive = activeTier === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTier(tab.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      isActive ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F6] text-[#525252] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1 ${isActive ? 'opacity-80' : 'text-[#a3a3a3]'}`}>{tierCount(tab.key)}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Shortlisted — shown above the raw review pool so the customer's
              curated picks (and the Select action) sit near the top, right
              under any Selected talent, following the review funnel order. */}
          <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#E7E7EA] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                  Shortlisted
                </h2>
                <span className="text-xs text-[#a3a3a3]">{shortlistedView.length} total</span>
              </div>
            </div>

            {shortlistedView.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No shortlisted talents yet. Review talents below to add them here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E7E7EA]">
                {shortlistedView.map((r) => (
                  <li key={r.recipient_id} className="px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-4">
                      <RecipientLink recipient={r} inactive={(isClosed || hasSelection) && !r.selected_at}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} />
                      </RecipientLink>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                          onClick={() => handleReview(r.recipient_id, 'unshortlist')}
                          className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#737373] transition-colors hover:bg-[#F5F5F6] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Unshortlist
                        </button>
                        <button
                          type="button"
                          disabled={selectMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                          onClick={() => handleSelect(r)}
                          className="rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Select
                        </button>
                      </div>
                      {(hasSelection || isClosed) && !r.selected_at && (
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

          <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#E7E7EA] px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                  New talents for review
                </h2>
                <span className="text-xs text-[#a3a3a3]">{forReviewView.length} total</span>
              </div>
            </div>

            {forReviewView.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No new talents to review.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E7E7EA]">
                {forReviewView.map((r, i) => (
                  <li key={r.recipient_id} className="relative px-5 py-3 sm:px-6">
                    <div className="flex items-center gap-4">
                      <RecipientLink recipient={r} inactive={(isClosed || hasSelection) && !r.selected_at}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} />
                      </RecipientLink>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                          onClick={() => handleReview(r.recipient_id, 'shortlist')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Shortlist
                        </button>
                        <button
                          type="button"
                          disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                          onClick={() => handleReview(r.recipient_id, 'reject')}
                          className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#737373] transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    {i === 0 && !isClosed && !hasSelection && r.profile_id && r.category?.id && user?.id && (
                      <FirstItemTip
                        storageKey={`squadhire:tip:open-profile:${user.id}`}
                        message="Tap a talent's name or photo to open their full profile."
                      />
                    )}
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
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-2xl">
            <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              Confirm selection
            </h3>
            <p className="mt-2 text-sm text-[#525252]">
              You are about to select <strong>{confirmSelect.talent_name || 'this talent'}</strong>.
              Only one talent can be selected per card.
            </p>
            <p className="mt-2 text-sm text-amber-700">
              ⓘ Your pick goes to the Squad team for confirmation. Once approved it&rsquo;ll show as Assigned and the subscription starts.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSelect(null)}
                className="rounded-lg border border-[#E7E7EA] px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F5F5F6]"
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
          <span className="shrink-0 rounded-full bg-[#F1F1F3] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a]">
            {r.tier_custom || r.tier}
          </span>
        )}
        {r.proposed_price != null && (
          <span
            className="shrink-0 rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a]"
            title="Proposed monthly price for this tier"
          >
            {formatPrice(r.proposed_price, r.currency ?? null)}
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

function RecipientLink({ recipient: r, children, inactive = false }: { recipient: CardRecipientForBusiness; children: React.ReactNode; inactive?: boolean }) {
  if (inactive) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-4 opacity-45 grayscale cursor-default select-none">
        {children}
      </div>
    );
  }
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-[#E7E7EA] pt-3">
      <h2 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">{label}</dt>
      <dd className="text-sm text-[#0a0a0a]">{children}</dd>
    </div>
  );
}

function RecipientRow({
  recipient: r,
  variant,
}: {
  recipient: CardRecipientForBusiness;
  variant: 'selected' | 'assigned';
}) {
  const isAssigned = variant === 'assigned';
  return (
    <div className="flex items-center gap-4">
      <RecipientLink recipient={r}>
        <RecipientAvatar recipient={r} />
        <RecipientInfo recipient={r} />
      </RecipientLink>
      <span
        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
          isAssigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}
      >
        {isAssigned ? 'Assigned' : 'Selected'}
      </span>
    </div>
  );
}
