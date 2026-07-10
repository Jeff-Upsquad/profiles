'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { fmtDateTime } from '@/components/jobs/shared';
import { formatOfferAmount, type OfferAmount, type AssignmentOfferEvent } from '@/hooks/useAssignmentOffers';
import {
  useBusinessAssignmentOffers,
  useBusinessCounterOffer,
  useBusinessAcceptOffer,
  useBusinessDeclineOffer,
  type BusinessAssignmentOffer,
} from '@/hooks/useBusinessAssignmentOffers';

const ACTION_LABELS: Record<string, string> = {
  submitted: 'submitted an offer',
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
  accepted: { label: 'Accepted — selected', cls: 'bg-emerald-100 text-emerald-700' },
  declined: { label: 'Declined', cls: 'bg-[#f0f0f0] text-[#737373]' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-[#f0f0f0] text-[#737373]' },
  expired: { label: 'Expired', cls: 'bg-[#f0f0f0] text-[#737373]' },
};

export default function BusinessAssignmentOffers({
  cardId,
  currency,
  disabled = false,
}: {
  cardId: string;
  currency?: string | null;
  disabled?: boolean;
}) {
  const { data: offers, isLoading } = useBusinessAssignmentOffers(cardId);
  const counter = useBusinessCounterOffer(cardId);
  const accept = useBusinessAcceptOffer(cardId);
  const decline = useBusinessDeclineOffer(cardId);

  const [counterFor, setCounterFor] = useState<BusinessAssignmentOffer | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const list = offers ?? [];
  const busy = counter.isPending || accept.isPending || decline.isPending;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            Offers &amp; negotiations
          </h2>
          <span className="text-xs text-[#a3a3a3]">{list.length} total</span>
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
            No offers yet. When a talent submits or counters an offer, it&apos;ll appear here for you to review.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {list.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, cls: 'bg-[#f0f0f0] text-[#737373]' };
            const canAct = o.status === 'pending_business' && !disabled;
            return (
              <li key={o.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                        {o.talent_name}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#0a0a0a]">
                      <span className="text-[#737373]">
                        {o.status === 'pending_business' ? 'Talent asks' : o.status === 'pending_talent' ? 'You offered' : 'Latest'}:
                      </span>{' '}
                      <span className="font-semibold">{formatOfferAmount(o.current_amount) ?? '—'}</span>
                    </p>
                    {o.events.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenThread((t) => (t === o.id ? null : o.id))}
                        className="mt-1 text-xs font-semibold text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
                      >
                        {openThread === o.id ? 'Hide' : 'View'} activity ({o.events.length})
                      </button>
                    )}
                  </div>

                  {canAct && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        loading={decline.isPending && decline.variables?.offerId === o.id}
                        onClick={() => decline.mutate({ offerId: o.id })}
                      >
                        Decline
                      </Button>
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setCounterFor(o)}>
                        Counter
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        loading={accept.isPending && accept.variables?.offerId === o.id}
                        onClick={() => accept.mutate({ offerId: o.id })}
                      >
                        Accept &amp; select
                      </Button>
                    </div>
                  )}
                  {o.status === 'pending_talent' && (
                    <span className="shrink-0 self-center text-xs text-[#737373]">Waiting for the talent to respond…</span>
                  )}
                </div>

                {openThread === o.id && o.events.length > 0 && (
                  <ul className="mt-3 divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
                    {o.events.map((e: AssignmentOfferEvent) => {
                      const amt = formatOfferAmount(e.amount);
                      const who = e.actor_type === 'business' ? 'You' : e.actor_type === 'talent' ? o.talent_name : e.actor_type === 'admin' ? 'UpSquad' : 'System';
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
              </li>
            );
          })}
        </ul>
      )}

      {(counter.isError || accept.isError || decline.isError) && (
        <p className="px-5 pb-3 text-xs text-red-600">Could not save. Please try again.</p>
      )}

      <CounterModal
        offer={counterFor}
        currency={currency}
        pending={counter.isPending}
        onClose={() => setCounterFor(null)}
        onSubmit={(amount, note) =>
          counterFor &&
          counter.mutate(
            { offerId: counterFor.id, amount, ...(note ? { note } : {}) },
            { onSuccess: () => setCounterFor(null) },
          )
        }
      />
    </div>
  );
}

function CounterModal({
  offer,
  currency,
  pending,
  onClose,
  onSubmit,
}: {
  offer: BusinessAssignmentOffer | null;
  currency?: string | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (amount: OfferAmount, note?: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const parsed = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
  const cur = currency || 'INR';

  const submit = () => {
    if (!valid) return;
    onSubmit({ amount: Math.round(parsed), currency: cur, period: 'project' }, note.trim() || undefined);
    setAmount('');
    setNote('');
  };

  return (
    <Modal open={offer !== null} onClose={onClose} title={`Counter ${offer?.talent_name ?? 'the talent'}`}>
      <p className="mb-3 text-sm text-[#525252]">
        Propose your figure. The talent can accept it, counter again, or decline — you can keep negotiating until you agree.
      </p>
      <div className="space-y-3">
        <Input
          label={`Your figure (${cur})`}
          type="number"
          min={1}
          placeholder="e.g. 45000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any context for your counter…"
          maxLength={2000}
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={pending} disabled={!valid} onClick={submit}>
          Send counter
        </Button>
      </div>
    </Modal>
  );
}
