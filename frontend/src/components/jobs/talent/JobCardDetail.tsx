'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useReapplyToJob, useRespondToJob, useTalentJobDetail, useWithdrawApplication } from '@/hooks/useJobs';
import { useMyInterviewInvites } from '@/hooks/useJobInterviews';
import { useMyJobOffers } from '@/hooks/useJobOffers';
import {
  FUNNEL_STAGE_LABELS,
  fmtDate,
  fmtDateTime,
  funnelStageBadgeVariant,
  jobBusinessName,
  jobLocationLabel,
  jobTitle,
  packageLabel,
} from '@/components/jobs/shared';

// Job detail for one recipient — Apply/Decline while pending, the stage
// timeline once applied, plus cross-links to the full job profile, interview
// invites and offers for this card.

const TIMELINE_STAGES = [
  'applied',
  'screening',
  'shortlisted',
  'interview_invited',
  'interview',
  'selected',
  'offer',
  'hired',
  'placed',
] as const;

function StageTimeline({ stage }: { stage: string }) {
  const currentIdx = TIMELINE_STAGES.indexOf(stage as (typeof TIMELINE_STAGES)[number]);
  const isTerminalBad = stage === 'rejected' || stage === 'withdrawn';
  const isOnHold = stage === 'on_hold';

  return (
    <div>
      {(isTerminalBad || isOnHold) && (
        <div
          className={`mb-3 rounded-xl border px-4 py-3 text-sm ${
            isOnHold
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {isOnHold
            ? 'Your application is on hold — the business will get back to you.'
            : stage === 'withdrawn'
              ? 'You withdrew from this opening.'
              : 'This application was not taken forward.'}
        </div>
      )}
      <ol className="space-y-0">
        {TIMELINE_STAGES.map((s, i) => {
          const reached = currentIdx >= 0 && i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <li key={s} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    reached ? 'border-[#0a0a0a] bg-[#0a0a0a]' : 'border-[#D4D4D4] bg-white'
                  }`}
                >
                  {reached && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {i < TIMELINE_STAGES.length - 1 && (
                  <div className={`w-0.5 flex-1 ${reached && i < currentIdx ? 'bg-[#0a0a0a]' : 'bg-[#E7E7EA]'}`} style={{ minHeight: '1rem' }} />
                )}
              </div>
              <p
                className={`pb-4 text-sm ${
                  isCurrent
                    ? 'font-semibold text-[#0a0a0a]'
                    : reached
                      ? 'text-[#525252]'
                      : 'text-[#a3a3a3]'
                }`}
              >
                {FUNNEL_STAGE_LABELS[s]}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default function JobCardDetail({ recipientId }: { recipientId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useTalentJobDetail(recipientId);
  const respond = useRespondToJob();
  const withdraw = useWithdrawApplication();
  const reapply = useReapplyToJob();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const candidateStage = data?.candidate?.funnel_stage ?? null;
  // Withdraw is available after accepting, up until hired/placed.
  const canWithdraw =
    data?.recipient?.status === 'accepted' &&
    candidateStage !== 'hired' &&
    candidateStage !== 'placed' &&
    candidateStage !== 'withdrawn' &&
    candidateStage !== 'rejected';
  // Re-apply after a talent-initiated exit while the card is live —
  // a business rejection can't be self-reversed. status covers archival
  // (ingest maps closed/cancelled/archived cards to a non-active status);
  // the backend re-validates liveness authoritatively on reapply.
  const cardLive = data?.card?.status === 'active';
  const canReapply =
    data?.recipient?.status === 'rejected' &&
    (candidateStage === null || candidateStage === 'withdrawn') &&
    cardLive;
  const inInterviewPhase =
    candidateStage === 'interview_invited' || candidateStage === 'interview' || candidateStage === 'on_hold';
  const inOfferPhase =
    candidateStage === 'offer' || candidateStage === 'hired' || candidateStage === 'placed';
  const { data: invites } = useMyInterviewInvites({ enabled: inInterviewPhase });
  const { data: offers } = useMyJobOffers({ enabled: inOfferPhase });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-56 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !data || !data.card) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Job not found.</p>
        <button
          onClick={() => router.push('/talent/job-openings')}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to job openings
        </button>
      </div>
    );
  }

  const content = data.card.content;
  const title = jobTitle(content);
  const businessName = jobBusinessName(content);
  const pkg = packageLabel(content);
  const location = jobLocationLabel(content);
  const isPending = data.recipient.status === 'pending' && !data.recipient.cancelled_at;
  const cardInvites = (invites ?? []).filter((i) => i.round.card_id === data.card!.id);
  const cardOffers = (offers ?? []).filter((o) => o.card_id === data.card!.id);

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.push('/talent/job-openings')}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to job openings
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-[#737373]">
              {businessName}
              {location ? ` · ${location}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {candidateStage && (
              <Badge variant={funnelStageBadgeVariant(candidateStage)}>
                {FUNNEL_STAGE_LABELS[candidateStage] ?? candidateStage}
              </Badge>
            )}
            {data.recipient.status === 'rejected' && <Badge variant="red">Declined</Badge>}
            {pkg && (
              <span className="rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">
                {pkg}
              </span>
            )}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-[#E7E7EA] pt-3 sm:grid-cols-2">
          {content.job_profile?.employment_type && (
            <DetailRow label="Employment type">{content.job_profile.employment_type}</DetailRow>
          )}
          {content.job_profile?.work_mode && (
            <DetailRow label="Work mode">{content.job_profile.work_mode}</DetailRow>
          )}
          {content.expected_joining_date && (
            <DetailRow label="Expected joining">{fmtDate(content.expected_joining_date)}</DetailRow>
          )}
          {content.openings_count != null && (
            <DetailRow label="Openings">{content.openings_count}</DetailRow>
          )}
          {content.package_notes && <DetailRow label="Package notes">{content.package_notes}</DetailRow>}
        </dl>

        {typeof content.description === 'string' && content.description && (
          <p className="mt-3 whitespace-pre-line border-t border-[#E7E7EA] pt-3 text-sm text-[#525252]">
            {content.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7E7EA] pt-4">
          {data.job_profile_id ? (
            <Link
              href={`/talent/job-openings/profiles/${data.job_profile_id}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0a0a0a] underline-offset-2 hover:underline"
            >
              View full job &amp; business profile
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <span />
          )}

          {isPending && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => respond.mutate({ recipientId, action: 'reject' })}
                loading={respond.isPending && respond.variables?.action === 'reject'}
                disabled={respond.isPending}
              >
                Decline
              </Button>
              <Button
                size="sm"
                onClick={() => respond.mutate({ recipientId, action: 'accept' })}
                loading={respond.isPending && respond.variables?.action === 'accept'}
                disabled={respond.isPending}
              >
                Apply
              </Button>
            </div>
          )}
          {canWithdraw && (
            <Button
              size="sm"
              variant="outline"
              className="!border-[#FCA5A5] !text-[#B91C1C]"
              disabled={withdraw.isPending}
              onClick={() => {
                if (!confirmWithdraw) {
                  setConfirmWithdraw(true);
                  setTimeout(() => setConfirmWithdraw(false), 4000);
                  return;
                }
                withdraw.mutate({ recipientId });
              }}
            >
              {withdraw.isPending ? 'Withdrawing…' : confirmWithdraw ? 'Confirm withdraw?' : 'Withdraw application'}
            </Button>
          )}
          {canReapply && (
            <Button
              size="sm"
              onClick={() => reapply.mutate({ recipientId })}
              disabled={reapply.isPending}
            >
              {reapply.isPending ? 'Applying…' : 'Apply again'}
            </Button>
          )}
        </div>
      </div>

      {/* Interview invites for this opening */}
      {cardInvites.length > 0 && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#E7E7EA] px-5 py-4">
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Interview calls
            </h2>
          </div>
          <ul className="divide-y divide-[#E7E7EA]">
            {cardInvites.map(({ invite, round }) => (
              <li key={invite.id}>
                <Link
                  href={`/talent/job-openings/interviews/${invite.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#F5F5F6]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a0a0a]">
                      Round {round.round_no}
                      {round.title ? ` · ${round.title}` : ''} ({round.mode})
                    </p>
                    <p className="mt-0.5 text-xs text-[#737373]">{fmtDateTime(round.window_start)}</p>
                  </div>
                  <Badge
                    variant={
                      invite.rsvp === 'accepted' ? 'green' : invite.rsvp === 'declined' ? 'red' : 'yellow'
                    }
                  >
                    {invite.rsvp === 'invited' ? 'Respond' : invite.rsvp}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Offers for this opening */}
      {cardOffers.length > 0 && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="border-b border-[#E7E7EA] px-5 py-4">
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Offers
            </h2>
          </div>
          <ul className="divide-y divide-[#E7E7EA]">
            {cardOffers.map((offer) => (
              <li key={offer.id}>
                <Link
                  href={`/talent/job-openings/offers/${offer.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[#F5F5F6]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a0a0a]">{offer.position_title}</p>
                    <p className="mt-0.5 text-xs text-[#737373]">
                      {offer.sent_at ? `Sent ${fmtDate(offer.sent_at)}` : 'Pending'}
                    </p>
                  </div>
                  <Badge
                    variant={
                      offer.status === 'accepted'
                        ? 'green'
                        : ['declined', 'withdrawn', 'expired'].includes(offer.status)
                          ? 'red'
                          : 'indigo'
                    }
                  >
                    {offer.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stage timeline */}
      {data.candidate && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            Your progress
          </h2>
          <StageTimeline stage={data.candidate.funnel_stage} />
          {data.candidate.joining_date && (
            <p className="mt-2 text-sm text-[#525252]">
              Joining date: <strong>{fmtDate(data.candidate.joining_date)}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">{label}</dt>
      <dd className="text-sm text-[#0a0a0a]">{children}</dd>
    </div>
  );
}
