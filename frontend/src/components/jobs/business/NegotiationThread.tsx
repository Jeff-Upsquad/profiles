'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import OfferThread from '@/components/jobs/talent/OfferThread';
import { compensationSummary } from '@/components/jobs/shared';
import type { OfferCompensation } from '@/hooks/useJobOffers';
import {
  useAcceptNegotiation,
  useAnswerOfferQuestion,
  useCounterOffer,
  useDeclineNegotiation,
  useOfferEvents,
  type BusinessOffer,
} from '@/hooks/useBusinessJobs';

// Business-side negotiation controls + the shared offer-events thread.
// Counteroffer is ALWAYS FINAL — after it the candidate can only accept,
// decline or ask a question. Made unmissable in the counter modal.

export default function NegotiationThread({
  cardId,
  offer,
  open,
  onClose,
}: {
  cardId: string;
  offer: BusinessOffer;
  open: boolean;
  onClose: () => void;
}) {
  const { data: events } = useOfferEvents(open ? offer.id : undefined);
  const acceptNegotiation = useAcceptNegotiation(cardId);
  const declineNegotiation = useDeclineNegotiation(cardId);
  const counterOffer = useCounterOffer(cardId);
  const answerQuestion = useAnswerOfferQuestion(cardId);

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [answer, setAnswer] = useState('');

  const negotiating = offer.status === 'negotiating';
  const askedEvent = [...(events ?? [])].reverse().find((e) => e.action === 'negotiation_requested');
  const askedFigure =
    askedEvent && askedEvent.amount != null
      ? typeof askedEvent.amount === 'number'
        ? askedEvent.amount.toLocaleString()
        : compensationSummary(askedEvent.amount)
      : null;
  // The asked package, merged over the current offer so untouched components keep
  // their offered value — passed to acceptNegotiation so "accept their figure"
  // actually applies what the candidate asked for (per-component or single).
  const askedCompensation: OfferCompensation | null = (() => {
    if (!askedEvent || askedEvent.amount == null) return null;
    const base = (offer.compensation ?? {}) as OfferCompensation;
    if (typeof askedEvent.amount === 'number') {
      return { ...base, confirmed: { amount: askedEvent.amount, cadence: 'per_month' } };
    }
    if (typeof askedEvent.amount === 'object') {
      return { ...base, ...(askedEvent.amount as Record<string, unknown>) } as OfferCompensation;
    }
    return null;
  })();
  const hasOpenQuestion = (() => {
    const list = events ?? [];
    const lastAsked = list.map((e) => e.action).lastIndexOf('question_asked');
    const lastAnswered = list.map((e) => e.action).lastIndexOf('question_answered');
    return lastAsked >= 0 && lastAsked > lastAnswered;
  })();

  const counterValid = counterAmount.trim() !== '' && Number.isFinite(Number(counterAmount)) && Number(counterAmount) > 0;

  const submitCounter = () => {
    if (!counterValid) return;
    counterOffer.mutate(
      {
        offerId: offer.id,
        compensation: {
          ...(offer.compensation ?? {}),
          confirmed: { amount: Number(counterAmount), cadence: 'per_month' },
        },
        ...(counterNote.trim() ? { note: counterNote.trim() } : {}),
      },
      {
        onSuccess: () => {
          setCounterOpen(false);
          setCounterAmount('');
          setCounterNote('');
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Offer — ${offer.talent_name || 'candidate'} (${offer.status.replace('_', ' ')})`}
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {/* Negotiation controls */}
        {negotiating && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>{offer.talent_name || 'The candidate'}</strong> wants to negotiate
              {askedFigure ? (
                <>
                  {' '}
                  — asked figure: <strong>{askedFigure}</strong>
                </>
              ) : null}
              .
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                loading={acceptNegotiation.isPending}
                onClick={() =>
                  acceptNegotiation.mutate({
                    offerId: offer.id,
                    ...(askedCompensation ? { compensation: askedCompensation } : {}),
                  })
                }
              >
                Accept their figure
              </Button>
              <Button
                variant="outline"
                size="sm"
                loading={declineNegotiation.isPending}
                onClick={() => declineNegotiation.mutate({ offerId: offer.id })}
              >
                Decline — original stands
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setCounterOpen(true)}>
                Counteroffer (final)
              </Button>
            </div>
          </div>
        )}

        {offer.status === 'countered' && (
          <p className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] px-3.5 py-2.5 text-sm text-[#525252]">
            Your <strong className="text-[#0a0a0a]">final counteroffer</strong> is with the candidate
            — they can accept, decline or ask a question.
          </p>
        )}

        {/* Thread */}
        <OfferThread offerId={offer.id} events={events ?? []} perspective="business" allowAsk={false} />

        {/* Answer the candidate's question */}
        {hasOpenQuestion && (
          <div className="rounded-xl border border-[#E7E7EA] p-3">
            <p className="mb-2 text-xs font-semibold text-[#0a0a0a]">
              The candidate asked a question — reply below:
            </p>
            <Textarea
              rows={2}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer…"
              maxLength={2000}
            />
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                loading={answerQuestion.isPending}
                disabled={answer.trim().length === 0}
                onClick={() =>
                  answerQuestion.mutate(
                    { offerId: offer.id, answer: answer.trim() },
                    { onSuccess: () => setAnswer('') },
                  )
                }
              >
                Send reply
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* FINAL counteroffer warning modal */}
      <Modal open={counterOpen} onClose={() => setCounterOpen(false)} title="Final counteroffer">
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
          <p className="text-sm font-semibold text-red-700">This counteroffer is FINAL.</p>
          <p className="mt-0.5 text-xs text-red-700">
            After you send it the candidate can only accept, decline or ask a question — no further
            negotiation on either side.
          </p>
        </div>
        <div className="space-y-3">
          <Input
            label="Counter figure (monthly, after probation)"
            type="number"
            min={1}
            value={counterAmount}
            onChange={(e) => setCounterAmount(e.target.value)}
            required
          />
          <Textarea
            label="Note (optional)"
            rows={2}
            value={counterNote}
            onChange={(e) => setCounterNote(e.target.value)}
            maxLength={2000}
          />
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCounterOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            loading={counterOffer.isPending}
            disabled={!counterValid}
            onClick={submitCounter}
          >
            Send final counteroffer
          </Button>
        </div>
      </Modal>
    </Modal>
  );
}
