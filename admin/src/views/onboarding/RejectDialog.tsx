'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { REJECTION_REASONS } from './hubTypes';

const OTHER = '__other__';

/**
 * Reject / disqualify with a reason: pick a preset or type one. The reason is
 * shared with the talent (in-app, SquadHub partner app and WhatsApp), so the
 * copy here says so.
 */
export default function RejectDialog({
  open,
  talentName,
  programLabel,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  talentName: string;
  programLabel: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (open) {
      setChoice('');
      setCustom('');
    }
  }, [open]);

  const reason = choice === OTHER ? custom.trim() : choice;

  return (
    <Modal isOpen={open} onClose={pending ? () => {} : onClose} title={`Reject ${talentName}`} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (reason && !pending) onConfirm(reason);
        }}
        className="space-y-4"
      >
        <p className="text-sm text-gray-600">
          They move to <span className="font-medium text-gray-900">Rejected / Disqualified</span> for the{' '}
          {programLabel} here and in SquadHire CRM. The reason is shared with them.
        </p>
        <fieldset className="space-y-1.5">
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Reason</legend>
          {[...REJECTION_REASONS, OTHER].map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                choice === r ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reject-reason"
                value={r}
                checked={choice === r}
                onChange={() => setChoice(r)}
                className="text-red-600 focus:ring-red-500"
              />
              {r === OTHER ? 'Other — type a reason' : r}
            </label>
          ))}
        </fieldset>
        {choice === OTHER && (
          <textarea
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Tell them why, in a sentence or two"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
          />
        )}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!reason || pending}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
