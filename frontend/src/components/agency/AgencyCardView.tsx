'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';
import OfferAmountStepperModal, { snapOfferAmount } from '@/components/subscriptions/OfferAmountStepper';
import { formatOfferAmount, type OfferAmount } from '@/hooks/useAssignmentOffers';
import {
  useAgencyCanRespond,
  useRespondAgencyCard,
  useAgencyOffer,
  useSubmitAgencyOffer,
  useRespondAgencyOffer,
} from '@/hooks/useAgencyCardActions';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

export interface AgencyCardItem {
  id: string;
  status: string;
  responded_at: string | null;
  cancelled_at: string | null;
  card: {
    id: string;
    external_id: string | null;
    content: SubscriptionCardContentShape;
    status: string;
    published_at: string;
    expires_at: string | null;
    card_type?: string;
  };
}

const OPEN = ['pending_business', 'pending_talent', 'accepted'];

const TINTS = ['tint-purple', 'tint-blue', 'tint-orange', 'tint-green', 'tint-pink', 'tint-amber'] as const;
function tintFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash << 5) - hash + seed.charCodeAt(i);
  return TINTS[Math.abs(hash) % TINTS.length];
}

const ACTION_LABELS: Record<string, string> = {
  submitted: 'submitted an offer',
  countered: 'sent a counter-offer',
  accepted: 'accepted the offer',
  declined: 'declined the offer',
  withdrawn: 'withdrew the offer',
  expired: 'offer expired',
  question_asked: 'asked a question',
  question_answered: 'answered a question',
};

export default function AgencyCardView({ item }: { item: AgencyCardItem }) {
  const content = (item.card.content ?? {}) as Record<string, unknown>;
  const ad = (content.assignment_details ?? {}) as Record<string, unknown>;
  const cardType = item.card.card_type || (content.card_type as string) || 'subscription';
  const isAssignment = cardType === 'assignment';
  const pricingMode = isAssignment && ad.pricing_mode === 'unpriced' ? 'unpriced' : 'priced';
  const period = isAssignment ? 'project' : 'per_month';

  const isPending = item.status === 'pending';
  const isCancelled = item.cancelled_at != null;
  const showActions = isPending && !isCancelled;

  const brandName = (content.brand_name as string)?.trim() || (content.title as string)?.trim() || 'Subscription';
  const tint = tintFor(brandName);
  const typeLabel = isAssignment ? 'Assignment' : 'Subscription';

  const { data: gate } = useAgencyCanRespond();
  const canRespond = gate?.canRespond === true;

  const { data: offerData } = useAgencyOffer(item.id, showActions && canRespond);
  const offer = (offerData as any)?.offer ?? null;
  const events = ((offerData as any)?.events ?? []) as any[];
  const bidsLeft = (offerData as any)?.agency_bids_remaining ?? 3;
  const openOffer = offer && OPEN.includes(offer.status) ? offer : null;

  const respondCard = useRespondAgencyCard();
  const submitOffer = useSubmitAgencyOffer(item.id);
  const respondOffer = useRespondAgencyOffer(item.id);

  const [modal, setModal] = useState<null | 'submit' | 'counter'>(null);
  const [showThread, setShowThread] = useState(false);
  const busy = respondCard.isPending || submitOffer.isPending || respondOffer.isPending;

  const listPrice =
    typeof content.monthly_price === 'number'
      ? content.monthly_price
      : typeof content.customer_monthly_price === 'number'
        ? content.customer_monthly_price
        : typeof content.proposed_price === 'number'
          ? content.proposed_price
          : 0;
  const standingAmount =
    (typeof openOffer?.current_amount?.amount === 'number' ? openOffer.current_amount.amount : null) ??
    listPrice;

  return (
    <article className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 ${isCancelled ? 'opacity-70' : ''}`}>
      {/* Tinted top strip with brand */}
      <div className={`${tint} relative h-20 px-5 flex items-center overflow-hidden`}>
        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/40 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm" style={{ color: 'var(--tint-icon)' }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tint-icon)' }}>
              {isPending ? 'New offer' : 'Offer'}
            </p>
            <p className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a] truncate" style={{ maxWidth: '14rem' }}>
              {brandName}
            </p>
          </div>
          <span className="relative ml-auto shrink-0 self-start rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm" style={{ color: 'var(--tint-icon)' }}>
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <SubscriptionCardContent content={item.card.content} />

        {/* Actions */}
        {!canRespond ? (
          <div className="rounded-xl bg-[#FFFAC2] px-4 py-3 text-sm text-[#0a0a0a]">
            <p className="font-semibold">Complete your agency profile to respond</p>
            <p className="mt-0.5 text-xs text-[#525252]">
              Add your services in <Link href="/agency/profile" className="font-semibold underline">Profile</Link> to start accepting, declining, or bidding on cards.
            </p>
          </div>
        ) : showActions ? (
          <>
            {openOffer && (
              <div className="rounded-xl bg-[#F5F5F6] px-3.5 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  {openOffer.status === 'pending_talent' ? 'Business offer' : openOffer.status === 'accepted' ? 'Agreed' : 'Your bid'}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#0a0a0a]">{formatOfferAmount(openOffer.current_amount) ?? '—'}</p>
                <p className="mt-1 text-[11px] text-[#a3a3a3]">Bids left: {bidsLeft}/3</p>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {openOffer?.status === 'accepted' ? (
                <Badge variant="green">Accepted</Badge>
              ) : openOffer?.status === 'pending_business' ? (
                <>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => respondOffer.mutate({ action: 'withdraw' })}>Withdraw</Button>
                  <Button size="sm" variant="outline" disabled={busy || bidsLeft <= 0} onClick={() => setModal('counter')}>Revise bid{bidsLeft > 0 ? ` (${bidsLeft} left)` : ''}</Button>
                </>
              ) : openOffer?.status === 'pending_talent' ? (
                <>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => respondOffer.mutate({ action: 'decline' })}>Decline</Button>
                  <Button size="sm" variant="outline" disabled={busy || bidsLeft <= 0} onClick={() => setModal('counter')}>Counter{bidsLeft > 0 ? ` (${bidsLeft} left)` : ''}</Button>
                  <Button size="sm" disabled={busy} onClick={() => respondOffer.mutate({ action: 'accept' })}>Accept</Button>
                </>
              ) : pricingMode === 'priced' ? (
                <>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => respondCard.mutate({ recipientId: item.id, action: 'reject' })}>Decline</Button>
                  <Button size="sm" variant="outline" disabled={busy || bidsLeft <= 0} onClick={() => setModal('counter')}>Bid{bidsLeft > 0 ? ` (${bidsLeft} left)` : ''}</Button>
                  <Button size="sm" disabled={busy} onClick={() => respondCard.mutate({ recipientId: item.id, action: 'accept' })}>Accept</Button>
                </>
              ) : (
                <Button size="sm" disabled={busy || bidsLeft <= 0} onClick={() => setModal('submit')}>Submit an offer{bidsLeft > 0 ? ` (${bidsLeft} left)` : ''}</Button>
              )}
            </div>
          </>
        ) : (
          <div className="mt-auto flex items-center justify-end gap-2 border-t border-[#E7E7EA] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
              {item.status === 'rejected' && <Badge variant="red">Declined</Badge>}
              {isCancelled && <Badge variant="gray">Cancelled</Badge>}
            </div>
          </div>
        )}

        {/* Activity thread */}
        {events.length > 0 && (
          <>
            <button type="button" onClick={() => setShowThread((s) => !s)} className="text-xs font-semibold text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a] self-start">
              {showThread ? 'Hide' : 'View'} activity ({events.length})
            </button>
            {showThread && (
              <ul className="divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
                {events.map((e: any) => {
                  const amt = formatOfferAmount(e.amount);
                  const who = e.actor_type === 'agency' ? 'You' : e.actor_type === 'business' ? 'Business' : e.actor_type === 'admin' ? 'UpSquad' : 'System';
                  return (
                    <li key={e.id} className="px-3.5 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-xs text-[#0a0a0a]">
                          <span className="font-semibold">{who}</span>{' '}
                          <span className="text-[#525252]">{ACTION_LABELS[e.action] ?? e.action.replace(/_/g, ' ')}</span>
                        </p>
                        <span className="shrink-0 text-[10px] text-[#a3a3a3]">{new Date(e.created_at).toLocaleDateString()}</span>
                      </div>
                      {amt && <p className="mt-0.5 text-[11px] text-[#525252]">Figure: <span className="font-semibold">{amt}</span></p>}
                      {e.note && <p className="mt-1 whitespace-pre-line rounded-lg bg-[#F5F5F6] px-2.5 py-1.5 text-[11px] text-[#525252]">{e.note}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      <OfferAmountStepperModal
        open={modal !== null}
        title={modal === 'submit' ? 'Submit your offer' : 'Place your bid'}
        submitLabel={modal === 'submit' ? 'Submit offer' : 'Submit bid'}
        currency={(content.currency as string) || undefined}
        period={period}
        initialAmount={snapOfferAmount(standingAmount || 500)}
        referenceAmount={standingAmount || listPrice || 500}
        referenceLabel="List price"
        pending={submitOffer.isPending}
        onClose={() => setModal(null)}
        onSubmit={(amount: OfferAmount, note?: string) =>
          submitOffer.mutate({ amount, ...(note ? { note } : {}) }, { onSuccess: () => setModal(null) })
        }
      />
    </article>
  );
}
