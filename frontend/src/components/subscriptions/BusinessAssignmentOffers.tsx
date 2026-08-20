'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { fmtDateTime } from '@/components/jobs/shared';
import { formatOfferAmount, type OfferAmount, type AssignmentOfferEvent } from '@/hooks/useAssignmentOffers';
import { useCardRecipients } from '@/hooks/useBusiness';
import {
  isOpenBusinessOffer,
  useBusinessAssignmentOffers,
  useBusinessCounterOffer,
  useBusinessAcceptOffer,
  useBusinessDeclineOffer,
  useBusinessSendOffer,
  type BusinessAssignmentOffer,
} from '@/hooks/useBusinessAssignmentOffers';
import OfferAmountStepperModal, { snapOfferAmount } from './OfferAmountStepper';
import OpenIntroRoomButton from '@/components/conversations/OpenIntroRoomButton';

const ACTION_LABELS: Record<string, string> = {
  submitted: 'submitted a bid',
  countered: 'countered',
  accepted: 'accepted',
  declined: 'declined',
  withdrawn: 'withdrew',
  expired: 'expired',
  question_asked: 'asked a question',
  question_answered: 'answered a question',
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending_business: { label: 'Your move', cls: 'bg-[#FFFAC2] text-[#0a0a0a]' },
  pending_talent: { label: 'Awaiting talent', cls: 'bg-[#F1F1F3] text-[#525252]' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Declined', cls: 'bg-[#f0f0f0] text-[#737373]' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-[#f0f0f0] text-[#737373]' },
  expired: { label: 'Expired', cls: 'bg-[#f0f0f0] text-[#737373]' },
};

function formatListPrice(amount: number | null | undefined, currency?: string | null, period?: string): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const cur = !currency || currency === 'INR' ? '₹' : `${currency} `;
  const suffix = period === 'project' ? '' : '/mo';
  return `${cur}${amount.toLocaleString()}${suffix}`;
}

/**
 * Bidding section for business card review (subscription + assignment).
 * Accept locks the figure and shortlists; Select is a separate action.
 */
export default function BusinessAssignmentOffers({
  cardId,
  currency,
  period = 'per_month',
  disabled = false,
  listPrice,
  onSelect,
  sendOfferRecipientId,
  sendOfferTalentName,
}: {
  cardId: string;
  currency?: string | null;
  period?: OfferAmount['period'];
  disabled?: boolean;
  listPrice?: number | null;
  onSelect?: (recipientId: string, talentName: string | null) => void;
  sendOfferRecipientId?: string | null;
  sendOfferTalentName?: string | null;
}) {
  const { data: offers, isLoading } = useBusinessAssignmentOffers(cardId);
  const { data: recipients } = useCardRecipients(cardId);
  const counter = useBusinessCounterOffer(cardId);
  const accept = useBusinessAcceptOffer(cardId);
  const decline = useBusinessDeclineOffer(cardId);
  const send = useBusinessSendOffer(cardId);

  const [counterFor, setCounterFor] = useState<BusinessAssignmentOffer | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);

  // Talent who already have their own row below. Split, because the two cases
  // behave differently once a bid is live: a SELECTED talent's negotiation is
  // over, but a SHORTLISTED one's may still be waiting on the business.
  const taken = useMemo(() => {
    const shortlistedRecipients = new Set<string>();
    const shortlistedTalents = new Set<string>();
    const selectedRecipients = new Set<string>();
    const selectedTalents = new Set<string>();
    for (const r of recipients ?? []) {
      const target = r.selected_at
        ? ([selectedRecipients, selectedTalents] as const)
        : r.business_review_status === 'shortlisted'
          ? ([shortlistedRecipients, shortlistedTalents] as const)
          : null;
      if (!target) continue;
      target[0].add(r.recipient_id);
      if (r.talent_user_id) target[1].add(r.talent_user_id);
    }
    return { shortlistedRecipients, shortlistedTalents, selectedRecipients, selectedTalents };
  }, [recipients]);

  // Open bids only. One row per talent — if they have more than one open offer,
  // keep the newest.
  //
  // Shortlisted talent normally show only in their own section below, but
  // Accept / Counter live ONLY here: countering auto-shortlists, so hiding
  // every shortlisted talent stranded any negotiation the moment the business
  // made its first move. They stay listed while the next move is theirs.
  const list = useMemo(() => {
    const open = (offers ?? []).filter((o) => {
      if (!isOpenBusinessOffer(o)) return false;
      if (
        taken.selectedRecipients.has(o.recipient_id) ||
        (o.talent_user_id && taken.selectedTalents.has(o.talent_user_id))
      ) {
        return false;
      }
      const shortlisted =
        taken.shortlistedRecipients.has(o.recipient_id) ||
        (!!o.talent_user_id && taken.shortlistedTalents.has(o.talent_user_id));
      if (shortlisted && o.status !== 'pending_business') return false;
      return true;
    });
    const best = new Map<string, BusinessAssignmentOffer>();
    for (const o of open) {
      const key = o.talent_user_id || o.recipient_id;
      const prev = best.get(key);
      if (!prev || new Date(o.updated_at).getTime() > new Date(prev.updated_at).getTime()) {
        best.set(key, o);
      }
    }
    return [...best.values()];
  }, [offers, taken]);
  const busy = counter.isPending || accept.isPending || decline.isPending || send.isPending;
  const baseline = listPrice && listPrice > 0 ? listPrice : 500;

  // Prefer the talent's existing bid when opening "Send an Offer" for a recipient.
  const sendOfferStanding = (() => {
    if (!sendOfferRecipientId) return null;
    const match = (offers ?? []).find((o) => o.recipient_id === sendOfferRecipientId);
    const amt =
      match && typeof match.current_amount?.amount === 'number' && match.current_amount.amount > 0
        ? match.current_amount.amount
        : null;
    return amt;
  })();
  const sendInitial = sendOfferStanding ?? baseline;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Bidding
            </h2>
            <p className="mt-0.5 hidden text-xs text-[#a3a3a3] sm:block">
              Talent bids show the price you would pay. Accept locks the figure, Counter to negotiate (3 moves each side), then Select.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-[#a3a3a3]">{list.length} total</span>
            {sendOfferRecipientId && !disabled && (
              <Button size="sm" disabled={busy} onClick={() => setSendOpen(true)}>
                Send an Offer
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[#f0f0f0]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-[#737373]">
            No active bids yet. When a talent bids above the list price, their ask appears here so you can Accept or Counter.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {list.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, cls: 'bg-[#f0f0f0] text-[#737373]' };
            const offersLeft = o.business_offers_remaining ?? 0;
            const canAct = o.status === 'pending_business' && !disabled;
            const canCounter = canAct && offersLeft > 0;
            const canSelect = o.status === 'accepted' && !disabled && !!onSelect;
            const original =
              formatListPrice(o.list_price ?? listPrice, o.list_currency ?? currency, period) ?? null;
            const bid = formatOfferAmount(o.current_amount);
            const profileHref =
              o.profile_id && o.category_id
                ? `/business/dashboard/${o.category_id}/${o.profile_id}?cardId=${encodeURIComponent(cardId)}&recipientId=${encodeURIComponent(o.recipient_id)}`
                : null;

            const priceLabel =
              o.status === 'pending_business'
                ? 'Talent bid'
                : o.status === 'pending_talent'
                  ? 'Your offer'
                  : o.status === 'accepted'
                    ? 'Agreed'
                    : 'Latest';
            const amountNum =
              typeof o.current_amount?.amount === 'number' ? o.current_amount.amount : null;
            const listNum = o.list_price ?? listPrice ?? null;
            const differsFromList =
              amountNum != null && listNum != null && listNum > 0 && amountNum !== listNum;
            const isLiveBid = o.status === 'pending_business' || o.status === 'pending_talent';
            const isAgreed = o.status === 'accepted';
            const curSym =
              !currency || currency === 'INR' || o.list_currency === 'INR' ? '₹' : `${currency || o.list_currency} `;
            const periodSuffix = period === 'project' ? '' : '/mo';

            const nameBlock = (
              <div className="flex min-w-0 items-center gap-3">
                {o.profile_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.profile_photo_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F1F3] text-xs font-semibold text-[#525252]">
                    {(o.talent_name || 'T')
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase() ?? '')
                      .join('') || 'T'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                      {o.talent_name}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[#F5F5F6] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#737373]">
                      Offers {offersLeft}/3
                    </span>
                    <span className="rounded-md bg-[#F5F5F6] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[#737373]">
                      Bids {o.talent_bids_remaining ?? 0}/3
                    </span>
                  </div>
                </div>
              </div>
            );

            const priceBlock = amountNum != null ? (
              <div
                className={`w-full rounded-xl px-3.5 py-2 text-left ring-1 sm:w-auto sm:min-w-[7.5rem] sm:shrink-0 sm:text-right ${
                  isAgreed
                    ? 'bg-emerald-50 ring-emerald-200'
                    : isLiveBid
                      ? 'bg-[#FFFBEB] ring-[#FDE68A]'
                      : 'bg-[#FAFAF8] ring-[#E7E7EA]'
                }`}
                title={original ? `${priceLabel} · original ${original}` : priceLabel}
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
                  {priceLabel}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-jakarta)] text-[15px] font-bold tabular-nums leading-tight text-[#0a0a0a] sm:text-base">
                  {curSym}
                  {amountNum.toLocaleString()}
                  {periodSuffix && (
                    <span className="ml-0.5 text-[11px] font-semibold text-[#737373]">{periodSuffix}</span>
                  )}
                </p>
                {differsFromList && listNum != null && (
                  <p className="mt-0.5 text-[10px] font-medium text-[#a3a3a3]">
                    {amountNum > listNum ? '↑' : '↓'} from {curSym}
                    {listNum.toLocaleString()}
                    {periodSuffix}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full rounded-xl bg-[#FAFAF8] px-3.5 py-2 text-left ring-1 ring-[#E7E7EA] sm:w-auto sm:min-w-[7.5rem] sm:shrink-0 sm:text-right">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                  {priceLabel}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#a3a3a3]">{bid ?? '—'}</p>
              </div>
            );

            return (
              <li key={o.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      {profileHref ? (
                        <Link
                          href={profileHref}
                          className="min-w-0 rounded-lg transition-opacity hover:opacity-75 sm:flex-1"
                        >
                          {nameBlock}
                        </Link>
                      ) : (
                        <div className="min-w-0 sm:flex-1">{nameBlock}</div>
                      )}
                      {priceBlock}
                    </div>
                    {o.events.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenThread((t) => (t === o.id ? null : o.id))}
                        className="mt-2 text-xs font-semibold text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
                      >
                        {openThread === o.id ? 'Hide' : 'View'} activity ({o.events.length})
                      </button>
                    )}
                  </div>

                  <div className={`grid w-full gap-2 lg:flex lg:w-auto lg:shrink-0 lg:items-center ${canAct ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                    {o.talent_user_id && (
                      <OpenIntroRoomButton
                        cardId={o.card_id || cardId}
                        talentUserId={o.talent_user_id}
                        disabled={disabled}
                        className="rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40 sm:px-3 sm:py-1.5"
                      />
                    )}
                    {canAct && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decline.mutate({ offerId: o.id })}
                          className="rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold text-[#737373] transition-colors hover:text-red-600 disabled:opacity-40 sm:px-3 sm:py-1.5"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canCounter}
                          onClick={() => setCounterFor(o)}
                          title={!canCounter ? 'No offers remaining on this card' : undefined}
                          className="rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40 sm:px-3 sm:py-1.5"
                        >
                          Counter{canCounter ? ` (${offersLeft})` : ''}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => accept.mutate({ offerId: o.id })}
                          className="rounded-lg bg-[#0a0a0a] px-2 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40 sm:px-3 sm:py-1.5"
                        >
                          Accept<span className="hidden lg:inline"> bid</span>
                        </button>
                      </>
                    )}
                    {o.status === 'pending_talent' && (
                      <span className="self-center text-xs text-[#737373] lg:shrink-0">Awaiting the talent…</span>
                    )}
                    {canSelect && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSelect?.(o.recipient_id, o.talent_name)}
                        className="rounded-lg bg-[#0a0a0a] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40 lg:py-1.5"
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>

                {openThread === o.id && o.events.length > 0 && (
                  <ul className="mt-3 divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
                    {o.events.map((e: AssignmentOfferEvent) => {
                      const amt = formatOfferAmount(e.amount);
                      const who =
                        e.actor_type === 'business'
                          ? 'You'
                          : e.actor_type === 'talent'
                            ? o.talent_name
                            : e.actor_type === 'admin'
                              ? 'UpSquad'
                              : 'System';
                      return (
                        <li key={e.id} className="px-3.5 py-2.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-xs text-[#0a0a0a]">
                              <span className="font-semibold">{who}</span>{' '}
                              <span className="text-[#525252]">
                                {ACTION_LABELS[e.action] ?? e.action.replace(/_/g, ' ')}
                              </span>
                            </p>
                            <span className="shrink-0 text-[10px] text-[#a3a3a3]">{fmtDateTime(e.created_at)}</span>
                          </div>
                          {amt && (
                            <p className="mt-0.5 text-[11px] text-[#525252]">
                              Figure: <span className="font-semibold">{amt}</span>
                            </p>
                          )}
                          {e.note && (
                            <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-2.5 py-1.5 text-[11px] text-[#525252]">
                              {e.note}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <OfferAmountStepperModal
        open={!!counterFor}
        title="Send a counter-offer"
        submitLabel="Send counter"
        currency={currency || 'INR'}
        period={period}
        initialAmount={snapOfferAmount(
          (typeof counterFor?.current_amount?.amount === 'number'
            ? counterFor.current_amount.amount
            : baseline) || 500,
        )}
        referenceAmount={
          typeof counterFor?.current_amount?.amount === 'number'
            ? counterFor.current_amount.amount
            : baseline
        }
        referenceLabel="Talent's bid"
        pending={counter.isPending}
        onClose={() => setCounterFor(null)}
        onSubmit={(amount, note) => {
          if (!counterFor) return;
          counter.mutate(
            { offerId: counterFor.id, amount, ...(note ? { note } : {}) },
            { onSuccess: () => setCounterFor(null) },
          );
        }}
      />

      <OfferAmountStepperModal
        open={sendOpen}
        title={sendOfferTalentName ? `Offer to ${sendOfferTalentName}` : 'Send an Offer'}
        submitLabel="Send offer"
        currency={currency || 'INR'}
        period={period}
        initialAmount={snapOfferAmount(sendInitial)}
        referenceAmount={sendInitial}
        referenceLabel={sendOfferStanding != null ? "Talent's bid" : 'List price'}
        pending={send.isPending}
        onClose={() => setSendOpen(false)}
        onSubmit={(amount, note) => {
          if (!sendOfferRecipientId) return;
          send.mutate(
            { recipientId: sendOfferRecipientId, amount, ...(note ? { note } : {}) },
            { onSuccess: () => setSendOpen(false) },
          );
        }}
        hint="Starts at this talent's accepted price. Increase or decrease in steps of ₹500. They will be shortlisted automatically."
      />
    </div>
  );
}
