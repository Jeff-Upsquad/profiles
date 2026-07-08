'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useCancelInterviewRound, type InterviewRoundWithCounts } from '@/hooks/useBusinessJobs';
import { fmtDateTime, fmtTime, type BadgeVariantName } from '@/components/jobs/shared';

// Interview rounds for a job card — each links to its live day console.

const STATUS_BADGE: Record<string, { label: string; variant: BadgeVariantName }> = {
  scheduled: { label: 'Scheduled', variant: 'blue' },
  in_progress: { label: 'In progress', variant: 'indigo' },
  completed: { label: 'Completed', variant: 'green' },
  cancelled: { label: 'Cancelled', variant: 'gray' },
};

export function RoundCard({ cardId, round }: { cardId: string; round: InterviewRoundWithCounts }) {
  const cancelRound = useCancelInterviewRound();
  const badge = STATUS_BADGE[round.status] ?? { label: round.status, variant: 'gray' as const };
  const counts = round.invite_counts ?? {};
  const accepted = counts.rsvp_accepted ?? 0;
  const invited = (counts.rsvp_invited ?? 0) + accepted + (counts.rsvp_declined ?? 0);
  const done = counts.done ?? 0;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
              Round {round.round_no}
              {round.title ? ` · ${round.title}` : ''}
            </p>
            <Badge variant={badge.variant}>{badge.label}</Badge>
            <Badge variant="blue">{round.mode === 'virtual' ? 'Virtual' : 'In person'}</Badge>
          </div>
          <p className="mt-1 text-xs text-[#737373]">
            {fmtDateTime(round.window_start)} – {fmtTime(round.window_end)} · ~
            {round.minutes_per_interview} min each · capacity {round.capacity}
          </p>
          <p className="mt-0.5 text-xs text-[#a3a3a3]">
            {invited} invited · {accepted} accepted · {done} done
            {round.mode === 'physical' && round.location_snapshot?.label
              ? ` · ${round.location_snapshot.label}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {round.status === 'scheduled' && (
            <Button
              variant="ghost"
              size="sm"
              loading={cancelRound.isPending}
              onClick={() => {
                if (window.confirm('Cancel this interview round? Invited candidates will be notified.')) {
                  cancelRound.mutate(round.id);
                }
              }}
            >
              Cancel
            </Button>
          )}
          {round.status !== 'cancelled' && (
            <Link
              href={`/business/job-posts/${cardId}/rounds/${round.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0a0a0a] px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
            >
              Day console
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InterviewRoundsList({
  cardId,
  rounds,
}: {
  cardId: string;
  rounds: InterviewRoundWithCounts[];
}) {
  if (rounds.length === 0) {
    return (
      <p className="rounded-2xl border border-[#E7E7EA] bg-white px-5 py-8 text-center text-sm text-[#737373]">
        No interview rounds scheduled yet. Shortlist candidates, then call them for an interview.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {rounds.map((r) => (
        <RoundCard key={r.id} cardId={cardId} round={r} />
      ))}
    </div>
  );
}
