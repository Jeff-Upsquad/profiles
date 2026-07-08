'use client';

import Button from '@/components/ui/Button';
import { useConfirmAttendance, useInviteQueue } from '@/hooks/useJobInterviews';
import { fmtTime } from '@/components/jobs/shared';

// Live FIFO queue panel for an accepted invite. Polls every 20s:
//  - before T-10: countdown copy + disabled confirm
//  - T-10 open: "I'm available" confirm button (atomic ticket via RPC)
//  - queued: live position + approx time
//  - waitlisted: waitlist position (promoted on no-shows)
//  - started: the meeting link finally appears (link_locked flips server-side)

export default function InterviewQueuePanel({ inviteId }: { inviteId: string }) {
  const { data, isLoading } = useInviteQueue(inviteId);
  const confirm = useConfirmAttendance();

  if (isLoading || !data) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />;
  }

  const { invite, round, queue } = data;
  const windowOpen =
    round.confirm_opened_at != null ||
    Date.now() >= new Date(round.window_start).getTime() - 10 * 60_000;
  const canConfirm = invite.rsvp === 'accepted' && invite.queue_status === 'none' && round.status !== 'cancelled' && round.status !== 'completed';
  const inQueue = invite.queue_status === 'queued';
  const waitlisted = invite.queue_status === 'waitlisted';
  const inProgress = invite.queue_status === 'in_progress';
  const done = invite.queue_status === 'done';
  const absent = invite.queue_status === 'no_show' || invite.queue_status === 'not_joined';
  const linkRevealed = !round.link_locked;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
        Interview day
      </h2>

      {/* Confirm availability (T-10) */}
      {canConfirm && (
        <div className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4">
          {windowOpen ? (
            <>
              <p className="text-sm text-[#0a0a0a]">
                The interview window is opening — confirm you&apos;re available to join the queue.
                Spots are first-come-first-served.
              </p>
              <Button
                size="sm"
                className="mt-3"
                loading={confirm.isPending}
                onClick={() => confirm.mutate(inviteId)}
              >
                I&apos;m available — join the queue
              </Button>
            </>
          ) : (
            <p className="text-sm text-[#525252]">
              Confirmation opens <strong>10 minutes before</strong> your interview window starts (
              {fmtTime(round.window_start)}). You&apos;ll get a notification — come back then and tap
              &ldquo;I&apos;m available&rdquo; to claim your spot in the queue.
            </p>
          )}
        </div>
      )}

      {/* Queue position */}
      {(inQueue || inProgress) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          {inProgress ? (
            <p className="text-sm font-semibold text-emerald-800">Your interview is in progress.</p>
          ) : (
            <>
              <p className="text-sm text-emerald-800">
                You&apos;re <strong>#{queue.position}</strong> in the queue
                {queue.approx_time ? (
                  <>
                    {' '}
                    — approximate time <strong>{fmtTime(queue.approx_time)}</strong>
                  </>
                ) : null}
                .
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {queue.queued_count} in queue · capacity {queue.capacity}. This updates live — keep
                this page open.
              </p>
            </>
          )}
        </div>
      )}

      {waitlisted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            The queue is full — you&apos;re <strong>#{queue.waitlist_position}</strong> on the waiting
            list. If a spot opens up (no-shows happen!), you&apos;ll be promoted automatically and
            notified.
          </p>
        </div>
      )}

      {done && (
        <div className="rounded-xl border border-[#E7E7EA] bg-[#F5F5F6] p-4">
          <p className="text-sm text-[#0a0a0a]">
            Your interview is done{invite.outcome ? ` — outcome: ${invite.outcome.replace('_', ' ')}` : ''}.
            You&apos;ll be notified about next steps.
          </p>
        </div>
      )}

      {absent && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            You were marked {invite.queue_status === 'no_show' ? 'as a no-show' : "as didn't join"} for
            this round.
          </p>
        </div>
      )}

      {/* Meeting link / location — revealed only when the business starts YOUR interview */}
      <div className="mt-3">
        {linkRevealed ? (
          round.mode === 'virtual' && round.meeting_link ? (
            <a
              href={round.meeting_link}
              target="_blank"
              rel="noreferrer"
              className="btn-iridescent inline-flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              Join your interview now
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
          ) : round.location ? (
            <div className="rounded-xl border border-[#E7E7EA] p-4">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Venue</p>
              <p className="mt-1 text-sm text-[#0a0a0a]">
                {[round.location.label, round.location.address].filter(Boolean).join(' · ')}
              </p>
              {round.location.google_maps_url && (
                <a
                  href={round.location.google_maps_url as string}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
                >
                  Open in Google Maps
                </a>
              )}
            </div>
          ) : null
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#D4D4D4] px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-[#737373]">
              {round.mode === 'virtual'
                ? 'The meeting link unlocks here the moment the business starts your interview.'
                : 'The venue details unlock here when the business starts your interview.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
