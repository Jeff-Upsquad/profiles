'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { fmtDateTime } from '@/components/jobs/shared';
import { formatOfferAmount, type OfferAmount, type AssignmentOfferEvent } from '@/hooks/useAssignmentOffers';
import {
  useBusinessAssignmentOffers,
  useBusinessCounterOffer,
  useBusinessAcceptOffer,
  useBusinessDeclineOffer,
  useBusinessSendOffer,
  type BusinessAssignmentOffer,
} from '@/hooks/useBusinessAssignmentOffers';
import OfferAmountStepperModal, { snapOfferAmount } from './OfferAmountStepper';

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
  const counter = useBusinessCounterOffer(cardId);
  const accept = useBusinessAcceptOffer(cardId);
  const decline = useBusinessDeclineOffer(cardId);
  const send = useBusinessSendOffer(cardId);

  const [counterFor, setCounterFor] = useState<BusinessAssignmentOffer | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [openThread, setOpenThread] = useState<string | null>(null);

  const list = offers ?? [];
  const busy = counter.isPending || accept.isPending || decline.isPending || send.isPending;
  const baseline = listPrice && listPrice > 0 ? listPrice : 500;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Bidding
            </h2>
            <p className="mt-0.5 text-xs text-[#a3a3a3]">
              Talent bids and your offers. Accept locks the figure; then Select to proceed.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
            No bids yet. When a talent bids or you send an offer, it&apos;ll appear here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {list.map((o) => {
            const meta = STATUS_META[o.status] ?? { label: o.status, cls: 'bg-[#f0f0f0] text-[#737373]' };
            const canAct = o.status === 'pending_business' && !disabled;
            const canSelect = o.status === 'accepted' && !disabled && !!onSelect;
            const original =
              formatListPrice(o.list_price ?? listPrice, o.list_currency ?? currency, period) ?? null;
            const bid = formatOfferAmount(o.current_amount);
            const profileHref =
              o.profile_id && o.category_id
                ? `/business/dashboard/${o.category_id}/${o.profile_id}?cardId=${encodeURIComponent(cardId)}&recipientId=${encodeURIComponent(o.recipient_id)}`
                : null;

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
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                      {o.talent_name}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[#0a0a0a]">
                    <span className="text-[#737373]">
                      {o.status === 'pending_business'
                        ? 'Talent bid'
                        : o.status === 'pending_talent'
                          ? 'You offered'
                          : 'Latest'}
                      :
                    </span>{' '}
                    <span className="font-semibold">{bid ?? '—'}</span>
                    {original && (
                      <span className="ml-1.5 text-xs text-[#a3a3a3]">
                        (original {original})
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );

            return (
              <li key={o.id} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {profileHref ? (
                      <Link
                        href={profileHref}
                        className="block rounded-lg transition-opacity hover:opacity-75"
                      >
                        {nameBlock}
                      </Link>
                    ) : (
                      nameBlock
                    )}
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

                  {canAct && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => decline.mutate({ offerId: o.id })}
                        className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#737373] transition-colors hover:text-red-600 disabled:opacity-40"
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setCounterFor(o)}
                        className="rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40"
                      >
                        Counter
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => accept.mutate({ offerId: o.id })}
                        className="rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40"
                      >
                        Accept bid
                      </button>
                    </div>
                  )}
                  {o.status === 'pending_talent' && (
                    <span className="shrink-0 self-center text-xs text-[#737373]">Awaiting the talent…</span>
                  )}
                  {canSelect && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSelect?.(o.recipient_id, o.talent_name)}
                      className="shrink-0 rounded-lg bg-[#0a0a0a] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1a1a1a] disabled:opacity-40"
                    >
                      Select
                    </button>
                  )}
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
        initialAmount={snapOfferAmount(baseline)}
        pending={send.isPending}
        onClose={() => setSendOpen(false)}
        onSubmit={(amount, note) => {
          if (!sendOfferRecipientId) return;
          send.mutate(
            { recipientId: sendOfferRecipientId, amount, ...(note ? { note } : {}) },
            { onSuccess: () => setSendOpen(false) },
          );
        }}
        hint="Increase or decrease in steps of ₹500. The talent will be shortlisted automatically."
      />
    </div>
  );
}
