'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { useStartScreening } from '@/hooks/useBusinessJobs';

// Start Screening — moves every applicant into the screening stage. One-way.

export default function StartScreeningButton({
  cardId,
  applicantCount,
}: {
  cardId: string;
  applicantCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const start = useStartScreening(cardId);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#737373]">
          Move {applicantCount > 0 ? `${applicantCount} applicant${applicantCount === 1 ? '' : 's'}` : 'applicants'} to
          screening?
        </span>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          loading={start.isPending}
          onClick={() => start.mutate(undefined, { onSettled: () => setConfirming(false) })}
        >
          Yes, start
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setConfirming(true)}>
      Start screening
    </Button>
  );
}
