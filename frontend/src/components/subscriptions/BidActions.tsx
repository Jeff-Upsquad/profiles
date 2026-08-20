'use client';

import { useState } from 'react';
import {
  useBusinessCounterOffer,
  useBusinessAcceptOffer,
  useBusinessDeclineOffer,
  type BusinessAssignmentOffer,
} from '@/hooks/useBusinessAssignmentOffers';
import type { OfferAmount } from '@/hooks/useAssignmentOffers';
import OfferAmountStepperModal, { snapOfferAmount } from './OfferAmountStepper';

/**
 * Decline / Counter / Accept for one live bid, plus the counter-offer modal.
 *
 * Pulled out of the Bidding section so the actions can sit wherever the talent
 * currently is. A talent appears in exactly one section — Bidding, Shortlisted,
 * or Selected — and shortlisting used to move them away from the only place
 * these buttons existed, stranding the negotiation. The buttons follow the
 * person now, rather than the person having to stay where the buttons are.
 *
 * Renders nothing unless the next move is actually the business's.
 */
export default function BidActions({
  offer,
  cardId,
  currency,
  period = 'per_month',
  listPrice,
  disabled = false,
  buttonClassName = 'rounded-lg border border-[#E7E7EA] px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-1.5',
}: {
  offer: BusinessAssignmentOffer | null | undefined;
  cardId: string;
  currency?: string | null;
  period?: OfferAmount['period'];
  listPrice?: number | null;
  disabled?: boolean;
  buttonClassName?: string;
}) {
  const counter = useBusinessCounterOffer(cardId);
  const accept = useBusinessAcceptOffer(cardId);
  const decline = useBusinessDeclineOffer(cardId);
  const [counterOpen, setCounterOpen] = useState(false);

  const busy = counter.isPending || accept.isPending || decline.isPending;
  const canAct = !!offer && offer.status === 'pending_business' && !disabled;
  if (!offer || !canAct) return null;

  const offersLeft = offer.business_offers_remaining ?? 0;
  const canCounter = offersLeft > 0;
  const baseline = listPrice && listPrice > 0 ? listPrice : 500;
  const current =
    typeof offer.current_amount?.amount === 'number' ? offer.current_amount.amount : baseline;

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => decline.mutate({ offerId: offer.id })}
        className={`${buttonClassName} text-[#737373] hover:text-red-600`}
      >
        Decline
      </button>
      <button
        type="button"
        disabled={busy || !canCounter}
        onClick={() => setCounterOpen(true)}
        title={!canCounter ? 'No offers remaining on this card' : undefined}
        className={`${buttonClassName} text-[#0a0a0a] hover:bg-[#F5F5F6]`}
      >
        Counter{canCounter ? ` (${offersLeft})` : ''}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => accept.mutate({ offerId: offer.id })}
        className={`${buttonClassName} border-transparent bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]`}
      >
        Accept<span className="hidden lg:inline"> bid</span>
      </button>

      <OfferAmountStepperModal
        open={counterOpen}
        title="Send a counter-offer"
        submitLabel="Send counter"
        currency={currency || 'INR'}
        period={period}
        initialAmount={snapOfferAmount(current || 500)}
        referenceAmount={current}
        referenceLabel="Talent's bid"
        pending={counter.isPending}
        onClose={() => setCounterOpen(false)}
        onSubmit={(amount, note) => {
          counter.mutate(
            { offerId: offer.id, amount, ...(note ? { note } : {}) },
            { onSuccess: () => setCounterOpen(false) },
          );
        }}
      />
    </>
  );
}
