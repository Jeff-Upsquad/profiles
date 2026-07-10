'use client';

import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import InterviewQueuePanel from './InterviewQueuePanel';
import { useInviteQueue, useRespondToInvite } from '@/hooks/useJobInterviews';
import { fmtDate, fmtTime } from '@/components/jobs/shared';

// One interview invite rendered in full — round details, RSVP (accept/decline)
// while invited, then the live queue panel once accepted. Shared by the
// standalone invite page and the inline block on the job-openings detail so a
// talent can respond without clicking through.

export default function InterviewInviteCard({
  inviteId,
  job,
}: {
  inviteId: string;
  /** Optional job context for the heading (omit inline where the page already shows it). */
  job?: { title?: string | null; business_name?: string | null } | null;
}) {
  const { data, isLoading, isError } = useInviteQueue(inviteId);
  const respond = useRespondToInvite();

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />;
  }
  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 text-sm text-[#737373]">
        This interview invite is no longer available.
      </div>
    );
  }

  const { invite, round } = data;
  const cancelled = round.status === 'cancelled';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
              Interview call{job?.title ? ` — ${job.title}` : ''}
            </h2>
            <p className="mt-0.5 text-sm text-[#737373]">
              {job?.business_name ? `${job.business_name} · ` : ''}Round {round.round_no}
              {round.title ? ` · ${round.title}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {cancelled && <Badge variant="gray">Cancelled</Badge>}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                round.mode === 'virtual' ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#E0E7FF] text-[#4338CA]'
              }`}
            >
              {round.mode === 'virtual' ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {round.mode === 'virtual' ? 'Virtual' : 'In person'}
            </span>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-[#E7E7EA] pt-3 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Date</dt>
            <dd className="text-sm text-[#0a0a0a]">{fmtDate(round.window_start)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Time</dt>
            <dd className="text-sm text-[#0a0a0a]">
              {fmtTime(round.window_start)} – {fmtTime(round.window_end)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Per interview</dt>
            <dd className="text-sm text-[#0a0a0a]">~{round.minutes_per_interview} min</dd>
          </div>
        </dl>

        {/* In-person venue — shown up front so the candidate can plan travel. */}
        {round.mode === 'physical' && round.location && (
          <div className="mt-3 border-t border-[#E7E7EA] pt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Location</p>
            <p className="mt-0.5 text-sm text-[#0a0a0a]">
              {[round.location.label, round.location.address, round.location.city, round.location.region]
                .filter(Boolean)
                .join(', ') || 'Venue to be shared'}
            </p>
            {round.location.google_maps_url && (
              <a
                href={round.location.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
              >
                Open in Google Maps
              </a>
            )}
          </div>
        )}

        {/* RSVP inline — no click-through needed */}
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

      {/* Queue panel once accepted — live position + confirm + link/venue reveal */}
      {!cancelled && invite.rsvp === 'accepted' && <InterviewQueuePanel inviteId={inviteId} />}
    </div>
  );
}
