'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { useRespondToOffer } from '@/hooks/useJobOffers';

// Negotiate modal — the talent asks for a figure. The business can accept,
// decline, or make a FINAL counteroffer (after which negotiating is locked).

export default function NegotiateModal({
  offerId,
  open,
  onClose,
}: {
  offerId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const respond = useRespondToOffer(offerId);

  const parsed = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(parsed) && parsed > 0;

  const submit = () => {
    if (!valid) return;
    respond.mutate(
      { action: 'negotiate', amount: parsed, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Negotiate the offer">
      <p className="mb-3 text-sm text-[#525252]">
        Tell the business the monthly figure you&apos;re looking for. They can accept it, decline it
        (the original offer stands), or make one final counteroffer.
      </p>
      <div className="space-y-3">
        <Input
          label="Asked figure (monthly)"
          type="number"
          min={1}
          placeholder="e.g. 30000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Textarea
          label="Note (optional)"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any context for your ask…"
          maxLength={2000}
        />
      </div>
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
