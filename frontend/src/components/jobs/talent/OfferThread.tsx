'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useAskOfferQuestion, type OfferEvent } from '@/hooks/useJobOffers';
import { compensationSummary, fmtDateTime } from '@/components/jobs/shared';

// Chronological offer thread (offer_events) + the ask-a-question box.

const ACTION_LABELS: Record<string, string> = {
  created: 'Offer drafted',
  package_updated: 'Package updated',
  sent: 'Offer sent',
  marked_sent_manually: 'Offer sent via email',
  viewed: 'Offer viewed',
  accepted: 'Offer accepted',
  declined: 'Offer declined',
  negotiation_requested: 'Negotiation requested',
  negotiation_accepted: 'Negotiation accepted',
  negotiation_declined: 'Negotiation declined — original offer stands',
  counter_offered: 'Final counteroffer made',
  withdrawn: 'Offer withdrawn',
  expired: 'Offer expired',
  question_asked: 'Question asked',
  question_answered: 'Question answered',
};

const ACTOR_LABELS: Record<string, string> = {
  talent: 'You',
  business: 'Business',
  admin: 'UpSquad',
  system: 'System',
};

function formatAmount(amount: unknown): string | null {
  if (amount == null) return null;
  if (typeof amount === 'number') return amount.toLocaleString();
  if (typeof amount === 'object') {
    // Per-component ask/counter ({currency, training, probation, confirmed}).
    return compensationSummary(amount);
  }
  return String(amount);
}

export default function OfferThread({
  offerId,
  events,
  perspective = 'talent',
  allowAsk = true,
}: {
  offerId: string;
  events: OfferEvent[];
  perspective?: 'talent' | 'business';
  allowAsk?: boolean;
}) {
  const [question, setQuestion] = useState('');
  const ask = useAskOfferQuestion(offerId);
  const actorLabel = (actor: string) =>
    perspective === 'business' && actor === 'business'
      ? 'You'
      : perspective === 'business' && actor === 'talent'
        ? 'Candidate'
        : (ACTOR_LABELS[actor] ?? actor);

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-5 py-4">
        <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          Offer activity
        </h2>
      </div>

      {events.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-[#737373]">No activity yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {events.map((e) => {
            const amount = formatAmount(e.amount);
            return (
              <li key={e.id} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-[#0a0a0a]">
                    <span className="font-semibold">{actorLabel(e.actor_type)}</span>{' '}
                    <span className="text-[#525252]">
                      {ACTION_LABELS[e.action]?.toLowerCase() ?? e.action.replace(/_/g, ' ')}
                    </span>
                  </p>
                  <span className="shrink-0 text-[11px] text-[#a3a3a3]">{fmtDateTime(e.created_at)}</span>
                </div>
                {amount && (
                  <p className="mt-1 text-xs font-medium text-[#525252]">{amount}</p>
                )}
                {e.note && (
                  <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-3 py-2 text-xs text-[#525252]">
                    {e.note}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {allowAsk && perspective === 'talent' && (
        <div className="border-t border-[#E7E7EA] p-4">
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the business a question about this offer…"
            maxLength={2000}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              loading={ask.isPending}
              disabled={question.trim().length === 0}
              onClick={() =>
                ask.mutate(question.trim(), {
                  onSuccess: () => setQuestion(''),
                })
              }
            >
              Ask question
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
