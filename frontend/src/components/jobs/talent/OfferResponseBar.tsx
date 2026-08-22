'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import NegotiateModal from './NegotiateModal';
import { useRespondToOffer, type JobOffer } from '@/hooks/useJobOffers';

// Accept / Decline / Negotiate. Negotiate disappears once the business has
// made its FINAL counteroffer (is_final_counter / status 'countered') and
// while a negotiation is already pending.

export default function OfferResponseBar({ offer }: { offer: JobOffer }) {
  const [negotiateOpen, setNegotiateOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);
  const respond = useRespondToOffer(offer.id);

  const responded = ['declined', 'withdrawn', 'expired'].includes(offer.status);
  if (responded) return null;

  const isAccepted = offer.status === 'accepted';
  const canRespond = ['sent', 'negotiating', 'countered'].includes(offer.status);
  const canNegotiate = offer.status === 'sent' && !offer.is_final_counter;
  const isFinal = offer.is_final_counter || offer.status === 'countered';

  if (!canRespond && !isAccepted) return null;

  if (isAccepted && confirmAction !== 'decline') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-sm font-medium text-emerald-700">You accepted this offer.</p>
        <Button variant="ghost" size="sm" onClick={() => setConfirmAction('decline')}>
          Decline
        </Button>
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#0a0a0a]">
            Decline this offer?{' '}
            <span className="text-[#737373]">This can&apos;t be undone.</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
              Back
            </Button>
            <Button size="sm" variant="danger" loading={respond.isPending} onClick={() => respond.mutate({ action: 'decline' }, { onSuccess: () => setConfirmAction(null) })}>
              Yes, decline offer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {isFinal && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          This is the business&apos;s <strong>final counteroffer</strong> — you can accept, decline,
          or ask a question below.
        </p>
      )}
      {offer.status === 'negotiating' && (
        <p className="mb-3 rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] px-3.5 py-2.5 text-sm text-[#525252]">
          Your negotiation request is with the business. You can still accept or decline the current
          offer while you wait.
        </p>
      )}

      {confirmAction ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#0a0a0a]">
            {confirmAction === 'accept' ? 'Accept this offer?' : 'Decline this offer?'}{' '}
            <span className="text-[#737373]">This can&apos;t be undone.</span>
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmAction(null)}>
              Back
            </Button>
            <Button
              size="sm"
              variant={confirmAction === 'decline' ? 'danger' : 'primary'}
              loading={respond.isPending}
              onClick={() =>
                respond.mutate(
                  { action: confirmAction },
                  { onSuccess: () => setConfirmAction(null) },
                )
              }
            >
              {confirmAction === 'accept' ? 'Yes, accept offer' : 'Yes, decline offer'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canNegotiate && (
            <Button variant="outline" size="sm" onClick={() => setNegotiateOpen(true)}>
              Negotiate
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmAction('decline')}>
            Decline
          </Button>
          <Button size="sm" onClick={() => setConfirmAction('accept')}>
            Accept offer
          </Button>
        </div>
      )}

      <NegotiateModal
        offerId={offer.id}
        compensation={offer.compensation}
        open={negotiateOpen}
        onClose={() => setNegotiateOpen(false)}
      />
    </div>
  );
}
