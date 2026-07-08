'use client';

import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import InterviewQueuePanel from './InterviewQueuePanel';
import { useInviteQueue, useMyInterviewInvites, useRespondToInvite } from '@/hooks/useJobInterviews';
import { fmtDateTime, fmtTime } from '@/components/jobs/shared';

// One interview invite: RSVP while 'invited', then the live queue panel.

export default function InterviewInviteView({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useInviteQueue(inviteId);
  const { data: allInvites } = useMyInterviewInvites();
  const respond = useRespondToInvite();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Interview invite not found.</p>
        <button
          onClick={() => router.push('/talent/job-openings')}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to job openings
        </button>
      </div>
    );
  }

  const { invite, round } = data;
  const job = (allInvites ?? []).find((i) => i.invite.id === inviteId)?.job ?? null;
  const cancelled = round.status === 'cancelled';

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Invite header */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              Interview call{job ? ` — ${job.title}` : ''}
            </h1>
            <p className="mt-0.5 text-sm text-[#737373]">
              {job?.business_name ?? ''}
              {job?.business_name ? ' · ' : ''}Round {round.round_no}
              {round.title ? ` · ${round.title}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cancelled && <Badge variant="gray">Cancelled</Badge>}
            <Badge variant={round.mode === 'virtual' ? 'blue' : 'indigo'}>
              {round.mode === 'virtual' ? 'Virtual' : 'In person'}
            </Badge>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-[#E7E7EA] pt-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Starts</dt>
            <dd className="text-sm text-[#0a0a0a]">{fmtDateTime(round.window_start)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Ends</dt>
            <dd className="text-sm text-[#0a0a0a]">{fmtTime(round.window_end)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Per interview
            </dt>
            <dd className="text-sm text-[#0a0a0a]">~{round.minutes_per_interview} min</dd>
          </div>
        </dl>

        {/* RSVP */}
        {!cancelled && invite.rsvp === 'invited' && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E7EA] pt-4">
            <p className="text-sm text-[#525252]">Can you make it?</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => respond.mutate({ inviteId, action: 'decline' })}
                loading={respond.isPending && respond.variables?.action === 'decline'}
                disabled={respond.isPending}
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => respond.mutate({ inviteId, action: 'accept' })}
                loading={respond.isPending && respond.variables?.action === 'accept'}
                disabled={respond.isPending}
              >
                Accept interview
              </Button>
            </div>
          </div>
        )}

        {invite.rsvp === 'declined' && (
          <p className="mt-4 border-t border-[#E7E7EA] pt-4 text-sm text-[#737373]">
            You declined this interview call. The business can invite you to a later round.
          </p>
        )}
      </div>

      {/* Queue panel once accepted */}
      {!cancelled && invite.rsvp === 'accepted' && <InterviewQueuePanel inviteId={inviteId} />}
    </div>
  );
}
