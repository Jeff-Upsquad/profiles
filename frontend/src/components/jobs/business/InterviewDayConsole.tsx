'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import QueueColumn from './QueueColumn';
import CandidateInterviewCard from './CandidateInterviewCard';
import {
  useDayConsole,
  useInterviewOutcome,
  useMarkAbsent,
  useMarkShowedUp,
  useStartInterview,
  type DayConsoleInvite,
} from '@/hooks/useBusinessJobs';
import { fmtDateTime, fmtTime } from '@/components/jobs/shared';

// Live interview-day console — Confirmed-FIFO queue / Showed up (in progress)
// / Done / Absent columns, auto-refreshing every 15s. "Start Interview"
// reveals the meeting link to THAT candidate only, so it confirms first.

function smallBtn(extra = ''): string {
  return `rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${extra}`;
}

export default function InterviewDayConsole({
  cardId,
  roundId,
}: {
  cardId: string;
  roundId: string;
}) {
  const router = useRouter();
  const { data, isLoading, isError } = useDayConsole(roundId);
  const markShowedUp = useMarkShowedUp(roundId);
  const startInterview = useStartInterview(roundId);
  const markAbsent = useMarkAbsent(roundId);
  const outcome = useInterviewOutcome(roundId);
  const [startConfirm, setStartConfirm] = useState<DayConsoleInvite | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-80 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Interview round not found.</p>
        <button
          onClick={() => router.push(`/business/job-posts/${cardId}`)}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to the job post
        </button>
      </div>
    );
  }

  const { round, buckets } = data;
  const queueAll = [...buckets.queue, ...buckets.waitlist];
  const waiting = [...buckets.invited, ...buckets.accepted_unconfirmed];

  const outcomeButtons = (invite: DayConsoleInvite) => (
    <>
      <button
        type="button"
        disabled={outcome.isPending}
        onClick={() => outcome.mutate({ inviteId: invite.id, body: { outcome: 'selected' } })}
        className={smallBtn('bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40')}
      >
        Select
      </button>
      <button
        type="button"
        disabled={outcome.isPending}
        onClick={() => outcome.mutate({ inviteId: invite.id, body: { outcome: 'on_hold' } })}
        className={smallBtn('bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-40')}
      >
        On hold
      </button>
      <button
        type="button"
        disabled={outcome.isPending}
        onClick={() => outcome.mutate({ inviteId: invite.id, body: { outcome: 'rejected' } })}
        className={smallBtn('border border-[#E7E7EA] text-[#737373] hover:border-red-200 hover:text-red-600 disabled:opacity-40')}
      >
        Reject
      </button>
    </>
  );

  return (
    <div className="space-y-4">
      <Link
        href={`/business/job-posts/${cardId}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to the job post
      </Link>

      {/* Round header — the business always sees the link/venue */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
                Round {round.round_no}
                {round.title ? ` · ${round.title}` : ''}
              </h1>
              <Badge variant={round.status === 'in_progress' ? 'indigo' : round.status === 'completed' ? 'green' : 'blue'}>
                {round.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-[#737373]">
              {fmtDateTime(round.window_start)} – {fmtTime(round.window_end)} · ~
              {round.minutes_per_interview} min each · capacity {round.capacity}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {round.mode === 'virtual' ? (
              round.meeting_link ? (
                <a
                  href={round.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7E7EA] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a] hover:bg-[#F5F5F6]"
                >
                  Open meeting link
                </a>
              ) : (
                <span className="text-xs text-[#a3a3a3]">No meeting link set</span>
              )
            ) : (
              <div className="max-w-[16rem] text-xs text-[#525252]">
                <p className="font-semibold text-[#0a0a0a]">{round.location_snapshot?.label}</p>
                <p>{round.location_snapshot?.address}</p>
              </div>
            )}
            <p className="mt-1 text-[10px] text-[#a3a3a3]">Auto-refreshes every 15s</p>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <QueueColumn title="Confirmed — FIFO queue" count={queueAll.length}>
          {buckets.queue.map((invite) => (
            <CandidateInterviewCard
              key={invite.id}
              invite={invite}
              actions={
                <>
                  {!invite.showed_up_at && (
                    <button
                      type="button"
                      disabled={markShowedUp.isPending}
                      onClick={() => markShowedUp.mutate({ inviteId: invite.id })}
                      className={smallBtn('bg-[#F1F1F3] text-[#0a0a0a] hover:bg-[#E7E7EA] disabled:opacity-40')}
                    >
                      Showed up
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={startInterview.isPending}
                    onClick={() => setStartConfirm(invite)}
                    className={smallBtn('bg-[#0a0a0a] text-white hover:bg-[#1a1a1a] disabled:opacity-40')}
                  >
                    Start interview
                  </button>
                  <button
                    type="button"
                    disabled={markAbsent.isPending}
                    onClick={() => markAbsent.mutate({ inviteId: invite.id, body: { kind: 'no_show' } })}
                    className={smallBtn('border border-[#E7E7EA] text-[#737373] hover:border-red-200 hover:text-red-600 disabled:opacity-40')}
                  >
                    No-show
                  </button>
                </>
              }
            />
          ))}
          {buckets.waitlist.length > 0 && (
            <>
              <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
                Waiting list (promoted on no-shows)
              </p>
              {buckets.waitlist.map((invite) => (
                <CandidateInterviewCard key={invite.id} invite={invite} note="Waitlisted — promoted automatically when a spot opens." />
              ))}
            </>
          )}
        </QueueColumn>

        <QueueColumn title="Showed up / In progress" count={buckets.in_progress.length} accent="green">
          {buckets.in_progress.map((invite) => (
            <CandidateInterviewCard
              key={invite.id}
              invite={invite}
              actions={
                <>
                  {outcomeButtons(invite)}
                  <button
                    type="button"
                    disabled={markAbsent.isPending}
                    onClick={() => markAbsent.mutate({ inviteId: invite.id, body: { kind: 'not_joined' } })}
                    className={smallBtn('border border-[#E7E7EA] text-[#737373] hover:border-red-200 hover:text-red-600 disabled:opacity-40')}
                  >
                    Didn&apos;t join
                  </button>
                </>
              }
            />
          ))}
        </QueueColumn>

        <QueueColumn title="Done" count={buckets.done.length}>
          {buckets.done.map((invite) => (
            <CandidateInterviewCard
              key={invite.id}
              invite={invite}
              actions={!invite.outcome ? outcomeButtons(invite) : undefined}
            />
          ))}
        </QueueColumn>

        <QueueColumn title="Absent" count={buckets.absent.length} accent="red">
          {buckets.absent.map((invite) => (
            <CandidateInterviewCard
              key={invite.id}
              invite={invite}
              note={invite.queue_status === 'no_show' ? 'No-show' : "Showed up but didn't join"}
            />
          ))}
        </QueueColumn>
      </div>

      {/* Not-yet-confirmed side list */}
      {(waiting.length > 0 || buckets.declined.length > 0) && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#E7E7EA] px-5 py-3.5">
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Not in the queue
            </h2>
          </div>
          <ul className="divide-y divide-[#E7E7EA]">
            {waiting.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-sm text-[#0a0a0a]">{invite.talent_name || 'Unknown talent'}</span>
                <Badge variant={invite.rsvp === 'accepted' ? 'yellow' : 'gray'}>
                  {invite.rsvp === 'accepted' ? 'Accepted — not confirmed yet' : 'No response'}
                </Badge>
              </li>
            ))}
            {buckets.declined.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <span className="text-sm text-[#737373]">{invite.talent_name || 'Unknown talent'}</span>
                <Badge variant="red">Declined</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Link-reveal warning before Start Interview */}
      <Modal open={!!startConfirm} onClose={() => setStartConfirm(null)} title="Start this interview?">
        {startConfirm && (
          <>
            <p className="text-sm text-[#525252]">
              Starting the interview{' '}
              {round.mode === 'virtual' ? (
                <>
                  <strong className="text-[#0a0a0a]">
                    reveals the meeting link to {startConfirm.talent_name || 'this candidate'} only
                  </strong>{' '}
                  and notifies them to join now.
                </>
              ) : (
                <>
                  <strong className="text-[#0a0a0a]">
                    reveals the venue details to {startConfirm.talent_name || 'this candidate'}
                  </strong>{' '}
                  and notifies them it&apos;s their turn.
                </>
              )}{' '}
              Other candidates keep seeing a locked link.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStartConfirm(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                loading={startInterview.isPending}
                onClick={() =>
                  startInterview.mutate(
                    { inviteId: startConfirm.id },
                    { onSuccess: () => setStartConfirm(null) },
                  )
                }
              >
                Start interview
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
