'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  useMySubscriptionCard,
  useCardRecipients,
  useReviewCardRecipient,
  useSelectCardRecipient,
  useUnselectCardRecipient,
  useMarkCardAcceptancesSeen,
  type CardRecipientForBusiness,
} from '@/hooks/useBusiness';
import { FirstItemTip } from '@/components/ui/FirstItemTip';
import BusinessAssignmentOffers from '@/components/subscriptions/BusinessAssignmentOffers';
import BidActions from '@/components/subscriptions/BidActions';
import OpenIntroRoomButton from '@/components/conversations/OpenIntroRoomButton';
import { isOpenBusinessOffer, useBusinessAssignmentOffers, type BusinessAssignmentOffer } from '@/hooks/useBusinessAssignmentOffers';
import { useCardPayments, useStartCardPayment, type CardPayment, type CardGateway } from '@/hooks/useCardPayments';
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

const SECTION_RANK: Record<string, number> = {
  assigned: 5,
  selected: 4,
  shortlisted: 3,
  bidding: 2,
  review: 1,
};

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
  const { data: offers } = useBusinessAssignmentOffers(cardId);
  // Razorpay sends the client back to ?payment=done. Captured once on mount so
  // the first read verifies against Razorpay rather than our own (possibly
  // not-yet-updated) row; the param is then cleaned out of the URL.
  const [returnedFromCheckout] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('payment') === 'done',
  );
  useEffect(() => {
    if (!returnedFromCheckout) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    window.history.replaceState({}, '', url.toString());
  }, [returnedFromCheckout]);
  // Live bid per recipient, so a talent's own row can carry its bid actions.
  const offerByRecipientId = useMemo(() => {
    const m = new Map<string, BusinessAssignmentOffer>();
    for (const o of offers ?? []) {
      if (!isOpenBusinessOffer(o)) continue;
      const prev = m.get(o.recipient_id);
      if (!prev || new Date(o.updated_at).getTime() > new Date(prev.updated_at).getTime()) {
        m.set(o.recipient_id, o);
      }
    }
    return m;
  }, [offers]);

  const { data: cardPayments } = useCardPayments(cardId, {
    justReturnedFromCheckout: returnedFromCheckout,
  });
  const startPayment = useStartCardPayment(cardId);
  const reviewMutation = useReviewCardRecipient(cardId);
  const selectMutation = useSelectCardRecipient(cardId);
  const unselectMutation = useUnselectCardRecipient(cardId);
  const [confirmUnselect, setConfirmUnselect] = useState<CardRecipientForBusiness | null>(null);
  const markSeenMutation = useMarkCardAcceptancesSeen(cardId);
  const [confirmSelect, setConfirmSelect] = useState<CardRecipientForBusiness | null>(null);

  // Recipients whose acceptance was still unseen when this page first loaded.
  // Captured once so the "New" markers persist for the visit even after we mark
  // them seen on the server; they clear on the next load.
  const newSnapshotRef = useRef<Set<string> | null>(null);
  const markedSeenRef = useRef(false);
  useEffect(() => {
    if (recipientsLoading || markedSeenRef.current || !recipients) return;
    markedSeenRef.current = true;
    const unseen = recipients.filter(
      (r) => !r.business_seen_at && !r.business_review_status && !r.selected_at,
    );
    newSnapshotRef.current = new Set(unseen.map((r) => r.recipient_id));
    if (unseen.length > 0) markSeenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientsLoading, recipients]);
  const isNewAcceptance = (r: CardRecipientForBusiness) =>
    newSnapshotRef.current?.has(r.recipient_id) ?? false;
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
  const isSubmitted = card?.status === 'submitted';

  // One talent → one section. Highest stage wins when the same person has
  // multiple recipient rows (e.g. a grouped brief) or also has an open bid.
  // Assigned > Selected > Shortlisted > Bidding > New review.
  const openBids = useMemo(() => {
    const recipientIds = new Set<string>();
    const talentIds = new Set<string>();
    for (const o of offers ?? []) {
      if (!isOpenBusinessOffer(o)) continue;
      recipientIds.add(o.recipient_id);
      if (o.talent_user_id) talentIds.add(o.talent_user_id);
    }
    return { recipientIds, talentIds };
  }, [offers]);

  const uniqueByTalent = useMemo(() => {
    const sectionOf = (r: CardRecipientForBusiness) => {
      if (r.selected_at && r.subscription_activated_at) return 'assigned';
      if (r.selected_at) return 'selected';
      if (r.business_review_status === 'shortlisted') return 'shortlisted';
      if (
        openBids.recipientIds.has(r.recipient_id) ||
        (!!r.talent_user_id && openBids.talentIds.has(r.talent_user_id))
      ) {
        return 'bidding';
      }
      if (!r.business_review_status) return 'review';
      return null;
    };
    const best = new Map<string, CardRecipientForBusiness>();
    for (const r of recipients ?? []) {
      const key = r.talent_user_id || `recipient:${r.recipient_id}`;
      const prev = best.get(key);
      if (!prev) {
        best.set(key, r);
        continue;
      }
      const nextRank = SECTION_RANK[sectionOf(r) ?? ''] ?? 0;
      const prevRank = SECTION_RANK[sectionOf(prev) ?? ''] ?? 0;
      if (nextRank > prevRank) best.set(key, r);
    }
    return [...best.values()].map((r) => ({ r, section: sectionOf(r) }));
  }, [recipients, openBids]);

  // Passed-over talents stay in the lists (greyed out + disabled buttons) so
  // the customer can still click through to view a profile after a selection
  // has been made — useful for reference or a side-by-side compare.
  const forReview = useMemo(
    () => uniqueByTalent.filter((x) => x.section === 'review').map((x) => x.r),
    [uniqueByTalent],
  );

  const shortlisted = useMemo(
    () => uniqueByTalent.filter((x) => x.section === 'shortlisted').map((x) => x.r),
    [uniqueByTalent],
  );

  const selected = useMemo(
    () => uniqueByTalent.filter((x) => x.section === 'selected' || x.section === 'assigned').map((x) => x.r),
    [uniqueByTalent],
  );

  // Tier sub-tab filtering applied to both review sections.
  const tierMatches = (r: CardRecipientForBusiness) =>
    activeTier === 'all' || normalizeTier(r.tier) === activeTier;
  // Newly-accepted (unseen at load) talents float to the top of the review pool.
  const forReviewView = forReview
    .filter(tierMatches)
    .sort((a, b) => (isNewAcceptance(b) ? 1 : 0) - (isNewAcceptance(a) ? 1 : 0));
  const shortlistedView = shortlisted.filter(tierMatches);
  const newAcceptedCount = forReview.filter(isNewAcceptance).length;
  // Optional skills/tools the client attached to the brief — shown under each
  // accepted talent as ✓ (they list it) / ✗ (they don't). Reference only.
  const additionalReqs = flattenAdditionalReqs(card?.additional_requirements);
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
  // Per-level prices for the brief — one row per experience level with the
  // budget the client set for it. Falls back to the card's own price for
  // single-tier cards that never carried a per-tier breakdown.
  const levelPrices: Array<{ tier: string; price: number | null }> = card.tier_prices?.length
    ? card.tier_prices.map((t) => ({ tier: t.tier, price: t.price }))
    : card.target_tiers.length === 1 && card.customer_monthly_price != null
      ? [{ tier: card.target_tiers[0], price: card.customer_monthly_price }]
      : card.target_tiers.map((t) => ({ tier: t, price: null }));
  // Assignments are one-off projects — show the level budgets without "/mo".
  const levelPrice = (n: number) => {
    const p = formatPrice(n, card.currency);
    return isAssignment && p ? p.replace(/\/mo$/, '') : p;
  };
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
            {(card.plan_name || card.categories.length > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {card.plan_name && (
                  <span className="text-sm text-[#737373]">{card.plan_name}</span>
                )}
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
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSubmitted && (
              <span className="rounded-full bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
                Submitted
              </span>
            )}
            {isClosed && (
              <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-xs font-semibold text-[#737373]">
                {card.recalled_at ? 'Recalled' : 'Closed'}
              </span>
            )}
          </div>
        </div>

        {/* === Plan & levels === one price per experience level (the budgets
            the client set) instead of a single headline budget figure. */}
        {levelPrices.length > 0 && (
          <Section title={isAssignment ? 'Levels & budget' : 'Plan & levels'}>
            <ul className="space-y-1.5">
              {levelPrices.map((l) => (
                <li key={l.tier} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-[#0a0a0a]">{l.tier}</span>
                  <span className="font-semibold text-[#0a0a0a]">
                    {l.price != null ? levelPrice(l.price) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* === Details === availability, schedule, location and languages in
            one compact grid (service/plan live in the title + subtitle). */}
        {(card.hours_label ||
          (card.working_days && card.working_days.length > 0) ||
          card.target_regions.length > 0 ||
          card.target_languages.length > 0) && (
          <Section title="Details">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {card.hours_label && (
                <DetailRow label="Availability">{card.hours_label}</DetailRow>
              )}
              {!isAssignment && card.working_days && card.working_days.length > 0 && (
                <DetailRow label="Working days">{card.working_days.join(', ')}</DetailRow>
              )}
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

        {/* === Custom deliverables === */}
        {card.custom_deliverables.length > 0 && (
          <Section title="Custom deliverables">
            <ul className="space-y-1 text-sm text-[#0a0a0a]">
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

      {isSubmitted && (
        <div className="rounded-2xl border border-amber-200 bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309]">
          Awaiting team review — this brief has been submitted and will appear with candidates once published.
        </div>
      )}

      {/* Bidding — talent bids + business offers (subscription + assignment).
          Accept locks the figure; Select is a separate action below. */}
      <BusinessAssignmentOffers
        cardId={cardId}
        currency={card.currency}
        period={isAssignment ? 'project' : 'per_month'}
        listPrice={card.customer_monthly_price}
        disabled={isClosed || isSubmitted || hasSelection}
        onSelect={(recipientId, talentName) => {
          const r = (recipients ?? []).find((x) => x.recipient_id === recipientId);
          if (r) handleSelect(r);
          else {
            // Talent may only appear via offer (not yet accepted at list price).
            setConfirmSelect({
              recipient_id: recipientId,
              talent_user_id: '',
              card_id: cardId,
              talent_name: talentName,
              profile_photo_url: null,
              current_location: null,
              languages_spoken: null,
              profile_id: null,
              category: null,
              tier: null,
              tier_custom: null,
              proposed_price: null,
              currency: card.currency,
              business_review_status: 'shortlisted',
              business_reviewed_at: null,
              selected_at: null,
              passed_over_at: null,
              responded_at: null,
              business_seen_at: null,
              subscription_activated_at: null,
            });
          }
        }}
      />

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
              <RecipientRow
                key={r.recipient_id}
                recipient={r}
                variant="assigned"
                listPrice={card.customer_monthly_price}
                isAssignment={isAssignment}
                cardId={cardId}
                payment={cardPayments?.payments[r.recipient_id] ?? null}
                gateway={cardPayments?.gateway ?? null}
                onPay={() => startPayment.mutate(r.recipient_id)}
                paying={startPayment.isPending}
              />
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
              <RecipientRow
                key={r.recipient_id}
                recipient={r}
                variant="selected"
                listPrice={card.customer_monthly_price}
                isAssignment={isAssignment}
                cardId={cardId}
                payment={cardPayments?.payments[r.recipient_id] ?? null}
                gateway={cardPayments?.gateway ?? null}
                onPay={() => startPayment.mutate(r.recipient_id)}
                paying={startPayment.isPending}
                onUnselect={() => setConfirmUnselect(r)}
              />
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
            <div className="border-b border-[#E7E7EA] px-4 py-3 sm:px-6 sm:py-4">
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
                  <li key={r.recipient_id} className="px-4 py-4 sm:px-6">
                    <div className="flex flex-col gap-3">
                      <RecipientLink recipient={r} inactive={(isClosed || hasSelection) && !r.selected_at}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} />
                      </RecipientLink>
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <RecipientPrice
                          recipient={r}
                          listPrice={card.customer_monthly_price}
                          isAssignment={isAssignment}
                        />
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap sm:items-center">
                          <OpenIntroRoomButton
                            cardId={r.card_id ?? cardId}
                            talentUserId={r.talent_user_id}
                            disabled={isClosed}
                            className="rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5"
                          />
                          {/* A shortlisted talent can still have a bid waiting on
                              you. They only appear in this one section, so the
                              Accept / Counter / Decline actions come to them. */}
                          <BidActions
                            offer={offerByRecipientId.get(r.recipient_id) ?? null}
                            cardId={cardId}
                            currency={card.currency}
                            period={isAssignment ? 'project' : 'per_month'}
                            listPrice={card.customer_monthly_price}
                            disabled={isClosed || isSubmitted || hasSelection}
                          />
                          <button
                            type="button"
                            disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                            onClick={() => handleReview(r.recipient_id, 'unshortlist')}
                            className="rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold text-[#737373] transition-colors hover:bg-[#F5F5F6] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            disabled={selectMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                            onClick={() => handleSelect(r)}
                            className="rounded-lg bg-[#0a0a0a] px-2 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                      {(hasSelection || isClosed) && !r.selected_at && (
                        <span className="self-start rounded-full bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-medium text-[#737373]">
                          Not selected
                        </span>
                      )}
                    </div>
                    <MatchChips reqs={additionalReqs} talentNames={r.skill_tool_names} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="border-b border-[#E7E7EA] px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                    New talents for review
                  </h2>
                  {newAcceptedCount > 0 && (
                    <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {newAcceptedCount} new
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[#a3a3a3]">{forReviewView.length} total</span>
              </div>
              <p className="mt-0.5 hidden text-xs text-[#a3a3a3] sm:block">
                Talents who accepted your card. Newly accepted are listed first. Bids live under Bidding above.
              </p>
            </div>

            {forReviewView.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-[#737373]">No new talents to review.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E7E7EA]">
                {forReviewView.map((r, i) => (
                  <li
                    key={r.recipient_id}
                    className={`relative px-4 py-4 sm:px-6 ${isNewAcceptance(r) ? 'bg-red-50/40' : ''}`}
                  >
                    <div className="flex flex-col gap-3">
                      <RecipientLink recipient={r} inactive={(isClosed || hasSelection) && !r.selected_at}>
                        <RecipientAvatar recipient={r} />
                        <RecipientInfo recipient={r} isNew={isNewAcceptance(r)} />
                      </RecipientLink>
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <RecipientPrice
                          recipient={r}
                          listPrice={card.customer_monthly_price}
                          isAssignment={isAssignment}
                        />
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
                          <button
                            type="button"
                            disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                            onClick={() => handleReview(r.recipient_id, 'shortlist')}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                          >
                            Shortlist
                          </button>
                          <button
                            type="button"
                            disabled={reviewMutation.isPending || hasSelection || isClosed || !!r.passed_over_at}
                            onClick={() => handleReview(r.recipient_id, 'reject')}
                            className="rounded-lg border border-[#E7E7EA] px-3 py-2 text-xs font-semibold text-[#737373] transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 sm:py-1.5"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                    <MatchChips reqs={additionalReqs} talentNames={r.skill_tool_names} />
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

      {confirmUnselect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmUnselect(null)} />
          <div className="relative mx-4 w-full max-w-md rounded-2xl border border-[#E7E7EA] bg-white p-6 shadow-2xl">
            <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              Remove this selection?
            </h3>
            <p className="mt-2 text-sm text-[#525252]">
              <strong>{confirmUnselect.talent_name || 'This talent'}</strong> will no longer be
              selected, and you can pick someone else. Their agreed price is kept, so you can
              select them again later at the same figure.
            </p>
            <p className="mt-2 text-sm text-[#525252]">
              We&rsquo;ll let them know, and any other bids this pick closed will reopen.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmUnselect(null)}
                className="rounded-lg border border-[#E7E7EA] px-4 py-2 text-sm font-semibold text-[#525252] transition-colors hover:bg-[#F5F5F6]"
              >
                Keep selection
              </button>
              <button
                type="button"
                disabled={unselectMutation.isPending}
                onClick={() =>
                  unselectMutation.mutate(undefined, {
                    onSuccess: () => setConfirmUnselect(null),
                    onError: () => setConfirmUnselect(null),
                  })
                }
                className="rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-50"
              >
                {unselectMutation.isPending ? 'Removing…' : 'Remove selection'}
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

/** Resolve the business-facing figure + whether it came from a live bid. */
function resolveRecipientPrice(r: CardRecipientForBusiness): {
  amount: number;
  currency: string | null;
  period: string | null;
  fromBid: boolean;
  offerStatus: string | null;
} | null {
  if (r.offer_amount && typeof r.offer_amount.amount === 'number' && r.offer_amount.amount > 0) {
    return {
      amount: r.offer_amount.amount,
      currency: r.offer_amount.currency ?? r.currency ?? null,
      period: r.offer_amount.period ?? 'per_month',
      fromBid: true,
      offerStatus: r.offer_status ?? null,
    };
  }
  if (r.proposed_price != null && r.proposed_price > 0) {
    return {
      amount: r.proposed_price,
      currency: r.currency ?? null,
      period: 'per_month',
      fromBid: false,
      offerStatus: null,
    };
  }
  return null;
}

function priceLabelForOffer(status: string | null, fromBid: boolean): string {
  if (!fromBid) return 'List price';
  if (status === 'accepted') return 'Agreed';
  if (status === 'pending_talent') return 'Your offer';
  if (status === 'pending_business') return 'Talent bid';
  return 'Bid';
}

/**
 * Prominent price block for talent rows — sits as its own column so the
 * figure is scannable in New / Shortlisted / Selected / Assigned lists.
 */
function RecipientPrice({
  recipient: r,
  listPrice,
  isAssignment = false,
}: {
  recipient: CardRecipientForBusiness;
  listPrice?: number | null;
  isAssignment?: boolean;
}) {
  const resolved = resolveRecipientPrice(r);
  if (!resolved) return null;

  const cur =
    resolved.currency === 'INR' || !resolved.currency ? '₹' : `${resolved.currency} `;
  const isProject =
    isAssignment || resolved.period === 'project';
  const periodSuffix = isProject ? '' : '/mo';
  const label = priceLabelForOffer(resolved.offerStatus, resolved.fromBid);
  const differsFromList =
    listPrice != null &&
    listPrice > 0 &&
    resolved.amount !== listPrice;

  // Stronger emphasis when the figure is a live bid (not plain list price).
  const isLiveBid = resolved.fromBid && resolved.offerStatus !== 'accepted';
  const isAgreed = resolved.fromBid && resolved.offerStatus === 'accepted';

  return (
    <div
      className={`w-full rounded-xl px-3.5 py-2 text-left ring-1 sm:w-auto sm:min-w-[7.5rem] sm:shrink-0 sm:text-right ${
        isAgreed
          ? 'bg-emerald-50 ring-emerald-200'
          : isLiveBid
            ? 'bg-[#FFFBEB] ring-[#FDE68A]'
            : 'bg-[#FAFAF8] ring-[#E7E7EA]'
      }`}
      title={
        differsFromList && listPrice != null
          ? `${label} · list was ${cur}${listPrice.toLocaleString()}${periodSuffix}`
          : label
      }
    >
      <p
        className={`text-[10px] font-semibold uppercase tracking-wider ${
          isAgreed
            ? 'text-emerald-700'
            : isLiveBid
              ? 'text-amber-800'
              : 'text-[#a3a3a3]'
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-0.5 font-[family-name:var(--font-jakarta)] text-[15px] font-bold tabular-nums leading-tight sm:text-base ${
          isAgreed
            ? 'text-emerald-900'
            : isLiveBid
              ? 'text-[#0a0a0a]'
              : 'text-[#0a0a0a]'
        }`}
      >
        {cur}
        {resolved.amount.toLocaleString()}
        {periodSuffix && (
          <span className="ml-0.5 text-[11px] font-semibold text-[#737373]">{periodSuffix}</span>
        )}
      </p>
      {differsFromList && listPrice != null && (
        <p className="mt-0.5 text-[10px] font-medium text-[#a3a3a3]">
          {resolved.amount > listPrice ? '↑' : '↓'} from {cur}
          {listPrice.toLocaleString()}
          {periodSuffix}
        </p>
      )}
    </div>
  );
}

function RecipientInfo({ recipient: r, isNew = false }: { recipient: CardRecipientForBusiness; isNew?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
          {r.talent_name || 'Unknown talent'}
        </p>
        {isNew && (
          <span className="shrink-0 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        )}
        {r.tier && (
          <span className="shrink-0 rounded-full bg-[#F1F1F3] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a]">
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

// ── Additional requirements (optional skills/tools) ─────────────────────────
// Presence-match the card's optional requirements against a talent's profile
// skill/tool names. Reference only for the business — never affects matching.
interface ReqItem { group: string; label: string }

function flattenAdditionalReqs(
  raw: Record<string, string[]> | null | undefined,
): ReqItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: ReqItem[] = [];
  for (const [group, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    for (const label of list) {
      const l = typeof label === 'string' ? label.trim() : '';
      if (l) out.push({ group, label: l });
    }
  }
  return out;
}

function MatchChips({ reqs, talentNames }: { reqs: ReqItem[]; talentNames?: string[] }) {
  if (reqs.length === 0) return null;
  const have = new Set((talentNames ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean));
  return (
    <div className="mt-3 sm:pl-[56px]">
      <p className="mb-1.5 font-[family-name:var(--font-inter)] text-[10.5px] font-bold uppercase tracking-wide text-[#a3a3a3]">
        Additional requirements
      </p>
      <div className="flex flex-wrap gap-1.5">
        {reqs.map((req, i) => {
          const matched = have.has(req.label.toLowerCase());
          return (
            <span
              key={`${req.group}-${req.label}-${i}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-[family-name:var(--font-inter)] text-xs font-medium ${
                matched
                  ? 'border-[#BFE6C9] bg-[#EAF7EE] text-[#1F7E36]'
                  : 'border-[#F4C9C4] bg-[#FDECEC] text-[#C13515]'
              }`}
              title={matched ? 'Talent lists this' : 'Not listed by this talent'}
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                {matched ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                )}
              </svg>
              {req.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Resolve category id from the recipient payload (object or rare array shape). */
function recipientCategoryId(r: CardRecipientForBusiness): string | null {
  const cat = r.category as { id?: string } | Array<{ id?: string }> | null | undefined;
  if (!cat) return null;
  if (Array.isArray(cat)) return cat[0]?.id ?? null;
  return cat.id ?? null;
}

function RecipientLink({ recipient: r, children, inactive = false }: { recipient: CardRecipientForBusiness; children: React.ReactNode; inactive?: boolean }) {
  if (inactive) {
    return (
      <div className="flex min-w-0 items-center gap-3 opacity-45 grayscale cursor-default select-none sm:gap-4">
        {children}
      </div>
    );
  }
  // Open profile whenever we have ids — used in Assigned / Selected / Shortlisted /
  // New talents for review. cardId+recipientId let the API authorize via the card
  // even when the profile's category isn't on the card's match_rules.
  const categoryId = recipientCategoryId(r);
  if (r.profile_id && categoryId) {
    const qs = new URLSearchParams();
    if (r.card_id) qs.set('cardId', r.card_id);
    if (r.recipient_id) qs.set('recipientId', r.recipient_id);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return (
      <Link
        href={`/business/dashboard/${categoryId}/${r.profile_id}${q}`}
        className="flex min-w-0 cursor-pointer items-center gap-3 transition-opacity hover:opacity-70 sm:gap-4"
        title="View full profile"
      >
        {children}
      </Link>
    );
  }
  return <div className="flex min-w-0 items-center gap-3 sm:gap-4">{children}</div>;
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
  // Mobile: label and value share one line (wrapping) so rows don't stack into
  // a tall column. sm+: back to the stacked label-above-value 2-col grid look.
  return (
    <div className="flex items-baseline gap-2 sm:block">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-[#0a0a0a]">{children}</dd>
    </div>
  );
}

function RecipientRow({
  recipient: r,
  variant,
  listPrice,
  isAssignment = false,
  cardId,
  payment,
  gateway,
  onPay,
  paying = false,
  onUnselect,
}: {
  recipient: CardRecipientForBusiness;
  variant: 'selected' | 'assigned';
  listPrice?: number | null;
  isAssignment?: boolean;
  cardId?: string;
  payment?: CardPayment | null;
  /** Gateway new payments will open (null when payments are switched off). */
  gateway?: CardGateway | null;
  onPay?: () => void;
  paying?: boolean;
  onUnselect?: () => void;
}) {
  const isAssigned = variant === 'assigned';
  // Undoing a pick that's been paid for needs a refund, so the server refuses it
  // — don't offer the action we know will be rejected.
  const canUnselect = !isAssigned && !!onUnselect && payment?.status !== 'paid';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <RecipientLink recipient={r}>
          <RecipientAvatar recipient={r} />
          <RecipientInfo recipient={r} />
        </RecipientLink>
        <div className="flex flex-col gap-2.5 sm:ml-auto sm:flex-row sm:items-center">
          <RecipientPrice recipient={r} listPrice={listPrice} isAssignment={isAssignment} />
          <div className="flex flex-wrap items-center gap-2">
            {!isAssigned && r.talent_user_id && (r.card_id || cardId) && (
              <OpenIntroRoomButton cardId={r.card_id ?? cardId ?? ''} talentUserId={r.talent_user_id} />
            )}
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                isAssigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {isAssigned ? 'Assigned' : 'Selected'}
            </span>
            {canUnselect && (
              <button
                type="button"
                onClick={onUnselect}
                className="rounded-full border border-[#E7E7EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#737373] transition-colors hover:border-[#d4d4d8] hover:text-[#0a0a0a]"
                title="Remove this selection and pick someone else"
              >
                Unselect
              </button>
            )}
          </div>
        </div>
      </div>
      {onPay && (
        <MakePaymentSection
          recipient={r}
          payment={payment ?? null}
          gateway={gateway}
          onPay={onPay}
          paying={paying}
          isAssignment={isAssignment}
        />
      )}
    </div>
  );
}

/**
 * "Make Payment" — sits directly under the selected talent. Three states:
 *
 *   nothing yet   → the agreed figure + a Pay button (hands off to the gateway
 *                   SQUADbooks has enabled: Razorpay, else Cashfree)
 *   paid          → a receipt line, plus the invoice number/link once SquadBooks
 *                   has raised it (a beat behind the payment, so we say so)
 *   link pending  → the client abandoned the checkout; the same link reopens
 *
 * The figure shown is whatever the price block above resolved to, so what the
 * client is asked to pay always matches what they were quoted.
 */
function MakePaymentSection({
  recipient: r,
  payment,
  gateway,
  onPay,
  paying,
  isAssignment,
}: {
  recipient: CardRecipientForBusiness;
  payment: CardPayment | null;
  gateway?: CardGateway | null;
  onPay: () => void;
  paying: boolean;
  isAssignment: boolean;
}) {
  const resolved = resolveRecipientPrice(r);
  const amount = payment?.amount ?? resolved?.amount ?? null;
  const currencyCode = payment?.currency ?? resolved?.currency ?? null;
  const isPaid = payment?.status === 'paid';
  // An existing payment knows which gateway owns its checkout; before one
  // exists, trust the server's read of SQUADbooks' Payment Gateway setting.
  const securedBy = (payment?.gateway ?? gateway) === 'cashfree' ? 'Cashfree' : 'Razorpay';

  // Nothing agreed yet — there is no figure to charge, so don't offer to.
  if (amount == null || !(amount > 0)) return null;

  const cur = currencyCode === 'INR' || !currencyCode ? '₹' : `${currencyCode} `;
  const isProject = isAssignment || (payment?.period ?? resolved?.period) === 'project';
  const amountLabel = `${cur}${amount.toLocaleString()}${isProject ? '' : '/mo'}`;

  if (isPaid) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-white p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-emerald-800">
              Payment received — {amountLabel}
            </p>
          </div>
          {payment?.invoice_number && payment.invoice_url && (
            <a
              href={payment.invoice_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-emerald-300 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
            >
              View invoice {payment.invoice_number}
            </a>
          )}
        </div>
        <p className="mt-1 text-[11.5px] text-[#737373]">
          {payment?.invoice_sent_at
            ? 'Your invoice has been sent to you on WhatsApp.'
            : payment?.invoice_number
              ? 'Your invoice is ready — it will reach you on WhatsApp shortly.'
              : "We're generating your invoice — it will reach you on WhatsApp shortly."}
        </p>
      </div>
    );
  }

  const resuming = payment?.status === 'created' && !!payment.payment_url;

  return (
    <div className="rounded-xl border border-[#E7E7EA] bg-white p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
            Make Payment
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#737373]">
            {resuming
              ? 'You have a payment in progress — pick up where you left off.'
              : `Pay ${amountLabel} to confirm ${r.talent_name || 'this talent'}. Your invoice follows on WhatsApp.`}
          </p>
        </div>
        <button
          type="button"
          onClick={onPay}
          disabled={paying}
          className="shrink-0 rounded-full bg-[#0a0a0a] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paying ? 'Opening…' : resuming ? `Continue — ${amountLabel}` : `Pay ${amountLabel}`}
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#a3a3a3]">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Secured by {securedBy}
      </p>
    </div>
  );
}
