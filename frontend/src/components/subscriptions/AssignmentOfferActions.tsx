'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { fmtDateTime } from '@/components/jobs/shared';
import {
  useAssignmentOffer,
  useSubmitAssignmentOffer,
  useRespondAssignmentOffer,
  formatOfferAmount,
  type OfferAmount,
  type AssignmentOfferEvent,
} from '@/hooks/useAssignmentOffers';
import { useRespondToSubscriptionCard, type SubscriptionCardItem } from '@/hooks/useSubscriptionCards';
import OfferAmountStepperModal, { snapOfferAmount } from './OfferAmountStepper';
import {
  assignmentOfferPeriod,
  optionalAssignmentQuantity,
  singularUnit,
  type AssignmentPricingDetails,
} from '@/lib/assignmentPricing';

const OPEN = ['pending_business', 'pending_talent', 'accepted'];

/** Prefer the backend's rejection reason over a generic save error. */
function serverError(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  const message = data?.error ?? data?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}

const ACTION_LABELS: Record<string, string> = {  submitted: 'submitted an offer',
  countered: 'sent a counter-offer',
  accepted: 'accepted the offer',
  declined: 'declined the offer',
  withdrawn: 'withdrew the offer',
  expired: 'offer expired',
  question_asked: 'asked a question',
  question_answered: 'answered a question',
};

export default function AssignmentOfferActions({
  item,
  currency,
  /** When true, priced path labels the middle action "Bid" (subscriptions). */
  bidLabel = false,
  /** Hide the current-figure summary (e.g. Bidding cards already show it on top). */
  hideAmountSummary = false,
  /** Keep detail-page actions in one compact horizontal row. */
  compactActions = false,
  /** Hide card-level Decline/Accept (e.g. Bidding rows are already-responded cards where only offer actions are valid). */
  hideCardResponse = false,
  /** Bidding-list card: original price + latest bid with by-whom pill, and a
   *  single Bid button (plus Accept when the business countered). No
   *  Withdraw/Decline — a standing own bid can only be revised. */
  layout = 'default',
}: {
  item: SubscriptionCardItem;
  currency?: string;
  bidLabel?: boolean;
  hideAmountSummary?: boolean;
  compactActions?: boolean;
  hideCardResponse?: boolean;
  layout?: 'default' | 'bidding-card';
}) {
  const recipientId = item.id;
  const content = item.card.content as Record<string, unknown>;
  const ad = (content.assignment_details ?? {}) as AssignmentPricingDetails;
  const cardType =
    item.card.card_type || (content.card_type as string) || 'subscription';
  const isAssignment = cardType === 'assignment';
  const pricingMode = isAssignment && ad.pricing_mode === 'unpriced' ? 'unpriced' : 'priced';
  const period = isAssignment ? assignmentOfferPeriod(ad) : 'per_month';
  const quantity = isAssignment ? optionalAssignmentQuantity(ad) ?? undefined : undefined;
  const unit = isAssignment ? singularUnit(ad) ?? undefined : undefined;

  // List / standing price for the stepper baseline.
  const listPrice =
    typeof content.monthly_price === 'number'
      ? content.monthly_price
      : typeof content.customer_monthly_price === 'number'
        ? content.customer_monthly_price
        : typeof content.proposed_price === 'number'
          ? content.proposed_price
          : 0;

  const { data, isLoading: offerLoading, isError: offerFailed, refetch: refetchOffer } = useAssignmentOffer(recipientId);
  const offer = data?.offer ?? null;
  const events = data?.events ?? [];
  const openOffer = offer && OPEN.includes(offer.status) ? offer : null;
  const bidsLeft = data?.talent_bids_remaining ?? 3;
  const canBid = bidsLeft > 0;

  const respondCard = useRespondToSubscriptionCard();
  const submitOffer = useSubmitAssignmentOffer(recipientId);
  const respondOffer = useRespondAssignmentOffer(recipientId);

  const [modal, setModal] = useState<null | 'submit' | 'counter'>(null);
  const [showThread, setShowThread] = useState(false);

  const busy = respondCard.isPending || submitOffer.isPending || respondOffer.isPending;
  const mutationError =
    serverError(respondOffer.error) ?? serverError(submitOffer.error) ?? serverError(respondCard.error);

  const standingAmount =
    (typeof openOffer?.current_amount?.amount === 'number' ? openOffer.current_amount.amount : null) ??
    listPrice;

  const doSubmit = (amount: OfferAmount, note?: string) =>
    submitOffer.mutate({ amount, ...(note ? { note } : {}) }, { onSuccess: () => setModal(null) });

  const bidOrCounterLabel = bidLabel ? 'Bid' : 'Counter-offer';
  const reviseLabel = bidLabel ? 'Revise bid' : 'Revise offer';

  const isBiddingCard = layout === 'bidding-card';
  const isBusinessCounter = openOffer?.status === 'pending_talent';
  const isYourBid = openOffer?.status === 'pending_business';
  const originalPriceLabel =
    listPrice > 0
      ? (formatOfferAmount({ amount: listPrice, currency: currency || 'INR', period }) ?? '—')
      : '—';
  const latestBidLabel = offer ? (formatOfferAmount(offer.current_amount) ?? '—') : null;
  const openBidModal = () => setModal(pricingMode === 'priced' ? 'counter' : 'submit');
  const bidButtonLabel = `${pricingMode === 'priced' ? (bidLabel ? 'Bid' : 'Counter') : 'Bid'}${canBid ? ` (${bidsLeft} left)` : ''}`;

  if (isBiddingCard) {
    return (
      <div>
        {offerLoading ? (
          <div aria-label="Loading bidding details">
            <div className="flex items-baseline justify-between gap-2">
              <span className="h-3 w-24 animate-pulse rounded bg-[#f0f0f0]" />
              <span className="h-4 w-28 animate-pulse rounded bg-[#f0f0f0]" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E7E7EA] pt-2">
              <span className="h-5 w-28 animate-pulse rounded-full bg-[#f0f0f0]" />
              <span className="h-4 w-28 animate-pulse rounded bg-[#f0f0f0]" />
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <span className="h-8 w-24 animate-pulse rounded-lg bg-[#f0f0f0]" />
            </div>
          </div>
        ) : offerFailed ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-red-600">Offer status couldn&apos;t be loaded.</p>
            <button
              type="button"
              onClick={() => refetchOffer()}
              className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a]"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-[#737373]">Original price</span>
              <strong className="text-sm font-semibold text-[#0a0a0a]">{originalPriceLabel}</strong>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-[#E7E7EA] pt-2.5">
              <span className="min-w-0">
                {openOffer?.status === 'accepted' ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Agreed</span>
                ) : isBusinessCounter ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Business counter — review</span>
                ) : isYourBid ? (
                  <span className="rounded-full bg-[#ECECFE] px-2 py-0.5 text-[10px] font-bold text-[#5B5BF2]">Your bid — waiting on business</span>
                ) : offer ? (
                  <span className="text-xs text-[#737373]">
                    {offer.status === 'declined'
                      ? 'Previous offer declined — you can try again.'
                      : offer.status === 'withdrawn'
                        ? 'Offer withdrawn.'
                        : 'Previous offer closed.'}
                  </span>
                ) : (
                  <span className="text-xs text-[#737373]">No bids yet</span>
                )}
              </span>
              {latestBidLabel && <strong className="shrink-0 text-sm font-semibold text-[#0a0a0a]">{latestBidLabel}</strong>}
            </div>
            <p className="mt-1.5 text-[11px] text-[#a3a3a3]">Bids left on this card: {bidsLeft}/3</p>
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              {events.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowThread((s) => !s)}
                  className="mr-auto text-xs font-semibold text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
                >
                  {showThread ? 'Hide' : 'View'} activity ({events.length})
                </button>
              )}
              {openOffer?.status === 'accepted' ? (
                <Badge variant="green">Accepted</Badge>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !canBid}
                    title={!canBid ? 'No bids remaining on this card' : undefined}
                    onClick={openBidModal}
                  >
                    {bidButtonLabel}
                  </Button>
                  {isBusinessCounter && (
                    <Button
                      size="sm"
                      disabled={busy}
                      loading={respondOffer.isPending && respondOffer.variables?.action === 'accept'}
                      onClick={() => respondOffer.mutate({ action: 'accept' })}
                    >
                      Accept
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {(respondCard.isError || submitOffer.isError || respondOffer.isError) && (
          <p className="mt-2 text-xs text-red-600">{mutationError ?? 'Could not save. Please try again.'}</p>
        )}

        {showThread && events.length > 0 && (
          <ul className="mt-3 divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
            {events.map((e: AssignmentOfferEvent) => {
              const amt = formatOfferAmount(e.amount);
              const who = e.actor_type === 'talent' ? 'You' : e.actor_type === 'business' ? 'Business' : e.actor_type === 'admin' ? 'UpSquad' : 'System';
              return (
                <li key={e.id} className="px-3.5 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-[#0a0a0a]">
                      <span className="font-semibold">{who}</span>{' '}
                      <span className="text-[#525252]">{ACTION_LABELS[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                    </p>
                    <span className="shrink-0 text-[10px] text-[#a3a3a3]">{fmtDateTime(e.created_at)}</span>
                  </div>
                  {amt && (
                    <p className="mt-0.5 text-[11px] text-[#525252]">
                      Figure: <span className="font-semibold">{amt}</span>
                    </p>
                  )}
                  {e.note && (
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-2.5 py-1.5 text-[11px] text-[#525252]">{e.note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <OfferAmountStepperModal
          open={modal !== null}
          title={
            modal === 'submit'
              ? 'Submit your offer'
              : bidLabel
                ? 'Place your bid'
                : 'Send a counter-offer'
          }
          submitLabel={
            modal === 'submit' ? 'Submit offer' : bidLabel ? 'Submit bid' : 'Send counter'
          }
          currency={currency}
          period={period}
          quantity={quantity}
          unit={unit}
          initialAmount={snapOfferAmount(standingAmount || 500)}
          referenceAmount={standingAmount || listPrice || 500}
          referenceLabel={
            openOffer
              ? openOffer.last_actor_side === 'business' || openOffer.last_actor_side === 'admin'
                ? 'Business offer'
                : 'Your last bid'
              : 'List price'
          }
          pending={submitOffer.isPending}
          onClose={() => setModal(null)}
          onSubmit={doSubmit}
          hint={
            bidLabel
              ? `Increase or decrease the ${unit ? `price per ${unit}` : 'set price'} in steps of ₹500, then submit your bid.`
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={hideAmountSummary ? '' : 'mt-auto border-t border-[#E7E7EA] pt-4'}>
      {/* Current negotiation figure — skip when parent already surfaces it. */}
      {!hideAmountSummary && openOffer && (
        <div className="mb-3 rounded-xl bg-[#F5F5F6] px-3.5 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
            {openOffer.status === 'pending_talent'
              ? 'Business offer'
              : openOffer.status === 'accepted'
                ? 'Agreed'
                : bidLabel
                  ? 'Your bid'
                  : 'Your offer'}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#0a0a0a]">
            {formatOfferAmount(openOffer.current_amount) ?? '—'}
          </p>
          {openOffer.status === 'pending_business' && (
            <p className="mt-0.5 text-xs text-[#737373]">Waiting for the business to respond.</p>
          )}
          <p className="mt-1 text-[11px] text-[#a3a3a3]">
            Bids left on this card: {bidsLeft}/3
          </p>
        </div>
      )}
      {hideAmountSummary && openOffer && (
        <p className="mb-2 text-[11px] text-[#a3a3a3]">Bids left on this card: {bidsLeft}/3</p>
      )}
      {!hideAmountSummary && !openOffer && (
        <p className="mb-2 text-[11px] text-[#a3a3a3]">Bids left on this card: {bidsLeft}/3</p>
      )}

      {/* Action row — gated on the live offer snapshot so a stale/loading
          state can never show card-level Decline/Accept for an already-open
          (or already-responded) negotiation. */}
      {offerLoading ? (
        <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Loading actions">
          <span className="h-8 w-20 animate-pulse rounded-lg bg-[#f0f0f0]" />
          <span className="h-8 w-24 animate-pulse rounded-lg bg-[#f0f0f0]" />
          <span className="h-8 w-20 animate-pulse rounded-lg bg-[#f0f0f0]" />
        </div>
      ) : offerFailed ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-red-600">Offer status couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={() => refetchOffer()}
            className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a]"
          >
            Retry
          </button>
        </div>
      ) : (
      <div className={compactActions
        ? 'flex flex-nowrap items-center justify-end gap-1.5 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:px-2 [&>button]:text-[12px]'
        : 'flex flex-wrap items-center justify-end gap-2'}>
        {offer && !OPEN.includes(offer.status) && (
          <span className="mr-auto text-xs text-[#737373]">
            {offer.status === 'declined'
              ? 'Previous offer declined — you can try again.'
              : offer.status === 'withdrawn'
                ? 'Offer withdrawn.'
                : 'Previous offer closed.'}
          </span>
        )}

        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setShowThread((s) => !s)}
            className="mr-auto text-xs font-semibold text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
          >
            {showThread ? 'Hide' : 'View'} activity ({events.length})
          </button>
        )}

        {openOffer?.status === 'accepted' ? (
          <Badge variant="green">Accepted</Badge>
        ) : openOffer?.status === 'pending_business' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              loading={respondOffer.isPending && respondOffer.variables?.action === 'withdraw'}
              onClick={() => respondOffer.mutate({ action: 'withdraw' })}
            >
              Withdraw
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !canBid}
              title={!canBid ? 'No bids remaining on this card' : undefined}
              onClick={() => setModal('counter')}
            >
              {reviseLabel}{canBid ? ` (${bidsLeft} left)` : ''}
            </Button>
          </>
        ) : openOffer?.status === 'pending_talent' ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              loading={respondOffer.isPending && respondOffer.variables?.action === 'decline'}
              onClick={() => respondOffer.mutate({ action: 'decline' })}
            >
              Decline
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !canBid}
              title={!canBid ? 'No bids remaining — you can still accept or decline' : undefined}
              onClick={() => setModal('counter')}
            >
              Counter{canBid ? ` (${bidsLeft} left)` : ''}
            </Button>
            <Button
              size="sm"
              disabled={busy}
              loading={respondOffer.isPending && respondOffer.variables?.action === 'accept'}
              onClick={() => respondOffer.mutate({ action: 'accept' })}
            >
              Accept
            </Button>
          </>
        ) : (
          // No open offer — the initial state.
          <>
            {!hideCardResponse && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              loading={respondCard.isPending && respondCard.variables?.action === 'reject'}
              onClick={() => respondCard.mutate({ recipientId, action: 'reject' })}
            >
              Decline
            </Button>
            )}
            {pricingMode === 'priced' ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !canBid}
                  title={!canBid ? 'No bids remaining on this card' : undefined}
                  onClick={() => setModal('counter')}
                >
                  {bidOrCounterLabel}{canBid ? ` (${bidsLeft} left)` : ''}
                </Button>
                {!hideCardResponse && (
                <Button
                  size="sm"
                  disabled={busy}
                  loading={respondCard.isPending && respondCard.variables?.action === 'accept'}
                  onClick={() => respondCard.mutate({ recipientId, action: 'accept' })}
                >
                  Accept
                </Button>
                )}
              </>
            ) : (
              <Button size="sm" disabled={busy || !canBid} onClick={() => setModal('submit')}>
                Submit an offer{canBid ? ` (${bidsLeft} left)` : ''}
              </Button>
            )}
          </>
        )}
      </div>
      )}

      {(respondCard.isError || submitOffer.isError || respondOffer.isError) && (
        <p className="mt-2 text-xs text-red-600">{mutationError ?? 'Could not save. Please try again.'}</p>
      )}

      {/* Activity thread */}
      {showThread && events.length > 0 && (
        <ul className="mt-3 divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
          {events.map((e: AssignmentOfferEvent) => {
            const amt = formatOfferAmount(e.amount);
            const who = e.actor_type === 'talent' ? 'You' : e.actor_type === 'business' ? 'Business' : e.actor_type === 'admin' ? 'UpSquad' : 'System';
            return (
              <li key={e.id} className="px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs text-[#0a0a0a]">
                    <span className="font-semibold">{who}</span>{' '}
                    <span className="text-[#525252]">{ACTION_LABELS[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                  </p>
                  <span className="shrink-0 text-[10px] text-[#a3a3a3]">{fmtDateTime(e.created_at)}</span>
                </div>
                {amt && (
                  <p className="mt-0.5 text-[11px] text-[#525252]">
                    Figure: <span className="font-semibold">{amt}</span>
                  </p>
                )}
                {e.note && (
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-2.5 py-1.5 text-[11px] text-[#525252]">{e.note}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <OfferAmountStepperModal
        open={modal !== null}
        title={
          modal === 'submit'
            ? 'Submit your offer'
            : bidLabel
              ? 'Place your bid'
              : 'Send a counter-offer'
        }
        submitLabel={
          modal === 'submit' ? 'Submit offer' : bidLabel ? 'Submit bid' : 'Send counter'
        }
        currency={currency}
        period={period}
        quantity={quantity}
        unit={unit}
        initialAmount={snapOfferAmount(standingAmount || 500)}
        referenceAmount={standingAmount || listPrice || 500}
        referenceLabel={
          openOffer
            ? openOffer.last_actor_side === 'business' || openOffer.last_actor_side === 'admin'
              ? 'Business offer'
              : 'Your last bid'
            : 'List price'
        }
        pending={submitOffer.isPending}
        onClose={() => setModal(null)}
        onSubmit={doSubmit}
        hint={
          bidLabel
            ? `Increase or decrease the ${unit ? `price per ${unit}` : 'set price'} in steps of ₹500, then submit your bid.`
            : undefined
        }
      />
    </div>
  );
}
