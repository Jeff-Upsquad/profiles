'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import type { OfferAmount } from '@/hooks/useAssignmentOffers';

export const OFFER_STEP = 500;

/** Snap a starting figure down/up to the nearest valid step (≥ step). */
export function snapOfferAmount(n: number, step = OFFER_STEP): number {
  if (!Number.isFinite(n) || n <= 0) return step;
  const rounded = Math.round(n / step) * step;
  return Math.max(step, rounded);
}

/**
 * Shared ₹500 step amount picker for Bid / Send Offer / Counter.
 * Starts at `initialAmount` (snapped) and lets the user +/- by 500.
 *
 * When `referenceAmount` is set (e.g. talent's accepted bid / list price),
 * it is shown as "Original" once the stepper moves away from that figure.
 */
export default function OfferAmountStepperModal({
  open,
  title,
  submitLabel,
  currency = 'INR',
  period = 'per_month',
  initialAmount,
  referenceAmount,
  referenceLabel = 'Original',
  pending = false,
  onClose,
  onSubmit,
  hint,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  currency?: string;
  period?: OfferAmount['period'];
  /** Starting figure in the stepper (talent bid / standing offer / list price). */
  initialAmount: number;
  /**
   * Anchor figure to keep visible when the user changes the stepper
   * (talent's accepted bid, or card list price). Defaults to initialAmount.
   */
  referenceAmount?: number | null;
  /** Label for the anchor, e.g. "Talent's bid" or "Original". */
  referenceLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onSubmit: (amount: OfferAmount, note?: string) => void;
  hint?: string;
}) {
  const [amount, setAmount] = useState(() => snapOfferAmount(initialAmount));
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(snapOfferAmount(initialAmount));
      setNote('');
    }
  }, [open, initialAmount]);

  const cur = currency && currency !== 'INR' ? `${currency} ` : '₹';
  const valid = amount > 0 && amount % OFFER_STEP === 0;
  const refRaw =
    referenceAmount != null && Number.isFinite(referenceAmount) && referenceAmount > 0
      ? referenceAmount
      : initialAmount;
  const refSnapped = snapOfferAmount(refRaw);
  const showOriginal = amount !== refSnapped;

  const submit = () => {
    if (!valid) return;
    onSubmit(
      { amount, currency: currency || 'INR', period: period || 'per_month' },
      note.trim() || undefined,
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-[#525252]">
        {hint ??
          `Adjust the amount in steps of ${cur}${OFFER_STEP.toLocaleString()}. Both sides can keep negotiating until you agree.`}
      </p>
      <div className="flex items-center justify-center gap-3 py-2">
        <button
          type="button"
          disabled={amount <= OFFER_STEP || pending}
          onClick={() => setAmount((a) => Math.max(OFFER_STEP, a - OFFER_STEP))}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E7EA] text-lg font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40"
          aria-label={`Decrease by ${OFFER_STEP}`}
        >
          −
        </button>
        <div className="min-w-[9rem] text-center">
          <p className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold text-[#0a0a0a]">
            {cur}
            {amount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-[#a3a3a3]">
            {period === 'project' ? 'for the project' : period === 'per_month' ? 'per month' : period?.replace(/_/g, ' ')}
          </p>
          {showOriginal && (
            <p className="mt-1.5 text-[11px] font-medium text-[#737373]">
              {referenceLabel}: {cur}
              {refSnapped.toLocaleString()}
              {period === 'project' ? '' : period === 'per_month' ? '/mo' : ''}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => setAmount((a) => a + OFFER_STEP)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E7EA] text-lg font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40"
          aria-label={`Increase by ${OFFER_STEP}`}
        >
          +
        </button>
      </div>
      <div className="mt-3">
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any context for this figure…"
          maxLength={2000}
        />
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" loading={pending} disabled={!valid} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}
