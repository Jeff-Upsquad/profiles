'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { useRespondToOffer, type OfferCompensation } from '@/hooks/useJobOffers';
import { COMP_COMPONENT_KEYS, COMP_ROW_LABELS, currencySymbol } from '@/components/jobs/shared';

// Negotiate modal — the talent can ask for a figure on EACH compensation
// component (training / probation / after-probation) independently, prefilled
// from the current package. The business can accept, decline, or make one FINAL
// counteroffer (after which negotiating is locked).

const CADENCE_OPTIONS = [
  { value: 'per_month', label: 'Per month' },
  { value: 'per_annum', label: 'Per annum' },
];

type DraftRow = { amount: string; cadence: string };

export default function NegotiateModal({
  offerId,
  compensation,
  open,
  onClose,
}: {
  offerId: string;
  compensation?: OfferCompensation | null;
  open: boolean;
  onClose: () => void;
}) {
  const currency =
    compensation && typeof compensation.currency === 'string' ? compensation.currency : 'INR';
  const sym = currencySymbol(currency);

  const initial = useMemo(() => {
    const draft: Record<string, DraftRow> = {};
    for (const key of COMP_COMPONENT_KEYS) {
      const slot = compensation?.[key] as { amount?: number | null; cadence?: string | null } | undefined;
      draft[key] = {
        amount: slot?.amount != null ? String(slot.amount) : '',
        cadence: typeof slot?.cadence === 'string' ? slot.cadence : 'per_month',
      };
    }
    return draft;
  }, [compensation]);

  const [rows, setRows] = useState<Record<string, DraftRow>>(initial);
  const [note, setNote] = useState('');
  const respond = useRespondToOffer(offerId);

  // Reset the draft to the current package each time the modal opens.
  useEffect(() => {
    if (open) setRows(initial);
  }, [open, initial]);

  const setAmount = (key: string, value: string) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], amount: value } }));
  const setCadence = (key: string, value: string) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], cadence: value } }));

  const populated = COMP_COMPONENT_KEYS.filter((key) => {
    const n = Number(rows[key]?.amount);
    return rows[key]?.amount.trim() !== '' && Number.isFinite(n) && n > 0;
  });
  const valid = populated.length > 0;

  const submit = () => {
    if (!valid) return;
    const amount: Record<string, unknown> = { currency };
    for (const key of populated) {
      amount[key] = { amount: Number(rows[key].amount), cadence: rows[key].cadence };
    }
    respond.mutate(
      { action: 'negotiate', amount, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          setNote('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Negotiate the offer">
      <p className="mb-3 text-sm text-[#525252]">
        Ask for a different figure on any part of the package. Leave a row blank to keep the offered
        amount. The business can accept your ask, decline it (the original offer stands), or make one
        final counteroffer.
      </p>
      <div className="space-y-3">
        {COMP_COMPONENT_KEYS.map((key) => {
          const offered = compensation?.[key] as
            | { amount?: number | null; cadence?: string | null }
            | undefined;
          return (
            <div key={key} className="rounded-xl border border-[#E7E7EA] p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[#0a0a0a]">{COMP_ROW_LABELS[key]}</p>
                {offered?.amount != null && (
                  <p className="text-xs text-[#a3a3a3]">
                    Offered: {sym}
                    {Number(offered.amount).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label="Your ask"
                    type="number"
                    min={1}
                    placeholder={offered?.amount != null ? String(offered.amount) : 'e.g. 30000'}
                    value={rows[key]?.amount ?? ''}
                    onChange={(e) => setAmount(key, e.target.value)}
                  />
                </div>
                <select
                  aria-label={`${COMP_ROW_LABELS[key]} cadence`}
                  value={rows[key]?.cadence ?? 'per_month'}
                  onChange={(e) => setCadence(key, e.target.value)}
                  className="h-[42px] rounded-lg border border-[#E7E7EA] bg-white px-2.5 text-sm text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                >
                  {CADENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any context for your ask…"
          maxLength={2000}
        />
      </div>
      {!valid && (
        <p className="mt-2 text-xs text-[#a3a3a3]">Enter an amount on at least one component.</p>
      )}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={respond.isPending} disabled={!valid} onClick={submit}>
          Send negotiation request
        </Button>
      </div>
    </Modal>
  );
}
