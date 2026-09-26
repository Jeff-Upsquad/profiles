'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import type { OfferAmount } from '@/hooks/useAssignmentOffers';
import { periodLabel, periodSuffix, pluralizeUnit } from '@/lib/assignmentPricing';

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
 * `entry="input"` swaps the read-only figure for a typed amount box that
 * starts empty — used when the business sent no price, so the talent names
 * their own figure instead of clicking + up from ₹500. It snaps to the
 * nearest step on blur (the backend only accepts multiples of the step).
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
  quantity,
  unit,
  entry = 'stepper',
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
  /** Per-work request metadata. Amount remains the unit rate; total is derived. */
  quantity?: number | null;
  unit?: 'design' | 'video';
  /** 'input' = typed amount box starting empty (first quote on an unpriced card). */
  entry?: 'stepper' | 'input';
}) {
  const typed = entry === 'input';
  const [amount, setAmount] = useState(() => (typed ? 0 : snapOfferAmount(initialAmount)));
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(typed ? 0 : snapOfferAmount(initialAmount));
      setDraft('');
      setNote('');
    }
  }, [open, initialAmount, typed]);

  const cur = currency && currency !== 'INR' ? `${currency} ` : '₹';
  const valid = amount > 0 && amount % OFFER_STEP === 0;
  const snapDraft = () => {
    if (!draft) return;
    const snapped = snapOfferAmount(Number(draft));
    setAmount(snapped);
    setDraft(String(snapped));
  };
  const step = (delta: number) => {
    const next = Math.max(OFFER_STEP, (amount || 0) + delta);
    setAmount(next);
    setDraft(String(next));
  };
  const refRaw =
    referenceAmount != null && Number.isFinite(referenceAmount) && referenceAmount > 0
      ? referenceAmount
      : initialAmount;
  const refSnapped = snapOfferAmount(refRaw);
  const showOriginal = amount !== refSnapped;
  const safeQuantity = Number.isInteger(quantity) && Number(quantity) > 0 ? Number(quantity) : null;
  const isPerUnit = period === 'per_design' || period === 'per_video';

  const submit = () => {
    // Typed entries snap on submit too, in case the box still has focus.
    const final = typed ? (amount > 0 ? snapOfferAmount(amount) : 0) : amount;
    if (!(final > 0 && final % OFFER_STEP === 0)) return;
    onSubmit(
      {
        amount: final,
        currency: currency || 'INR',
        period: period || 'per_month',
        ...(isPerUnit
          ? {
              pricing_basis: 'per_unit' as const,
              unit: unit ?? (period === 'per_video' ? 'video' : 'design'),
              ...(safeQuantity ? { quantity: safeQuantity } : {}),
            }
          : {}),
      },
      note.trim() || undefined,
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-3 text-sm text-[#525252]">
        {hint ??
          (typed
            ? `Enter your price in ${currency || 'INR'}. Amounts round to the nearest ${cur}${OFFER_STEP.toLocaleString()}.`
            : `Adjust the amount in steps of ${cur}${OFFER_STEP.toLocaleString()}. Both sides can keep negotiating until you agree.`)}
      </p>
      <div className="flex items-center justify-center gap-3 py-2">
        <button
          type="button"
          disabled={amount <= OFFER_STEP || pending}
          onClick={() => step(-OFFER_STEP)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E7EA] text-lg font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40"
          aria-label={`Decrease by ${OFFER_STEP}`}
        >
          −
        </button>
        <div className="min-w-[9rem] text-center">
          {typed ? (
            <label className="flex items-baseline justify-center gap-1 rounded-xl border border-[#E7E7EA] px-3 py-1.5 focus-within:border-[#0a0a0a]">
              <span className="font-[family-name:var(--font-jakarta)] text-xl font-semibold text-[#737373]">{cur.trim()}</span>
              <input
                autoFocus
                inputMode="numeric"
                aria-label={`Amount in ${currency || 'INR'}`}
                placeholder="Enter amount"
                value={draft ? Number(draft).toLocaleString() : ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 9);
                  setDraft(digits);
                  setAmount(digits ? Number(digits) : 0);
                }}
                onBlur={snapDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') snapDraft();
                }}
                disabled={pending}
                className="w-32 bg-transparent text-center font-[family-name:var(--font-jakarta)] text-2xl font-semibold text-[#0a0a0a] outline-none placeholder:text-base placeholder:font-normal placeholder:text-[#a3a3a3]"
              />
            </label>
          ) : (
            <p className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold text-[#0a0a0a]">
              {cur}
              {amount.toLocaleString()}
            </p>
          )}
          <p className="mt-0.5 text-[11px] text-[#a3a3a3]">
            {periodLabel(period)}
          </p>
          {typed && draft && !valid && (
            <p className="mt-1.5 text-[11px] font-medium text-[#B45309]">
              Rounds to {cur}{snapOfferAmount(amount).toLocaleString()}
            </p>
          )}
          {showOriginal && !typed && (
            <p className="mt-1.5 text-[11px] font-medium text-[#737373]">
              {referenceLabel}: {cur}
              {refSnapped.toLocaleString()}
              {periodSuffix(period)}
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => step(OFFER_STEP)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E7EA] text-lg font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6] disabled:opacity-40"
          aria-label={`Increase by ${OFFER_STEP}`}
        >
          +
        </button>
      </div>
      {isPerUnit && safeQuantity && amount > 0 && (
        <div className="mt-3 rounded-xl bg-[#F5F5F6] px-3.5 py-3 text-sm text-[#525252]">
          <div className="flex items-center justify-between gap-3">
            <span>{safeQuantity} {pluralizeUnit(unit ?? (period === 'per_video' ? 'video' : 'design'), safeQuantity)}</span>
            <span className="font-semibold text-[#0a0a0a]">
              {cur}{(amount * safeQuantity).toLocaleString()} total
            </span>
          </div>
        </div>
      )}
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
        <Button size="sm" loading={pending} disabled={typed ? amount <= 0 : !valid} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </Modal>
  );
}
