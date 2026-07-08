'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useHireCandidate } from '@/hooks/useBusinessJobs';

// Hire popup for an offer-accepted candidate: joining date + the keep-open vs
// close decision, with the consequences spelled out (closing withdraws every
// remaining un-accepted offer and notifies those candidates).

export default function HireDialog({
  cardId,
  candidateId,
  candidateName,
  openingsLeftHint,
  open,
  onClose,
}: {
  cardId: string;
  candidateId: string;
  candidateName: string | null;
  /** Openings minus hires so far — purely informational copy. */
  openingsLeftHint?: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const [joiningDate, setJoiningDate] = useState('');
  const [keepOpen, setKeepOpen] = useState<boolean>(true);
  const hire = useHireCandidate(cardId);

  const submit = () => {
    if (!joiningDate) return;
    hire.mutate(
      { candidateId, keep_open: keepOpen, joining_date: joiningDate },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title={`Hire ${candidateName || 'candidate'}`}>
      <div className="space-y-4">
        <Input
          label="Joining date"
          type="date"
          value={joiningDate}
          onChange={(e) => setJoiningDate(e.target.value)}
          required
          helperText="The candidate is notified with this date; on the day you mark them joined."
        />

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">After this hire</p>
          <div className="space-y-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                keepOpen ? 'border-[#0a0a0a] bg-[#FAFAFA]' : 'border-[#E7E7EA]'
              }`}
            >
              <input
                type="radio"
                name="keep-open"
                checked={keepOpen}
                onChange={() => setKeepOpen(true)}
                className="mt-0.5 h-4 w-4 accent-[#0a0a0a]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#0a0a0a]">
                  Keep the position open
                </span>
                <span className="mt-0.5 block text-xs text-[#737373]">
                  Keep hiring for the remaining opening
                  {openingsLeftHint != null && openingsLeftHint > 0 ? `s (${openingsLeftHint} left)` : 's'} —
                  other candidates and offers stay live.
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                !keepOpen ? 'border-[#0a0a0a] bg-[#FAFAFA]' : 'border-[#E7E7EA]'
              }`}
            >
              <input
                type="radio"
                name="keep-open"
                checked={!keepOpen}
                onChange={() => setKeepOpen(false)}
                className="mt-0.5 h-4 w-4 accent-[#0a0a0a]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#0a0a0a]">
                  Close the position
                </span>
                <span className="mt-0.5 block text-xs text-[#737373]">
                  This withdraws <strong>every remaining un-accepted offer</strong> and notifies those
                  candidates that the position has been filled. This can&apos;t be undone.
                </span>
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant={keepOpen ? 'primary' : 'danger'}
          loading={hire.isPending}
          disabled={!joiningDate}
          onClick={submit}
        >
          {keepOpen ? 'Hire & keep open' : 'Hire & close position'}
        </Button>
      </div>
    </Modal>
  );
}
