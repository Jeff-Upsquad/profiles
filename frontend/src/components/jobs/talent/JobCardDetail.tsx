'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  useJobProfileView,
  useReapplyToJob,
  useRespondToJob,
  useTalentJobDetail,
  useWithdrawApplication,
} from '@/hooks/useJobs';
import { useMyInterviewInvites } from '@/hooks/useJobInterviews';
import { useMyJobOffers } from '@/hooks/useJobOffers';
import { useConversations } from '@/hooks/useConversations';
import BusinessBrandSection from './BusinessBrandSection';
import InterviewInviteCard from './InterviewInviteCard';
import OfferHighlightCard from './OfferHighlightCard';
import JobProfileSections from './JobProfileSections';
import JobQnASection from './JobQnASection';
import {
  FUNNEL_STAGE_LABELS,
  fmtDate,
  funnelStageBadgeVariant,
  jobBusinessName,
  jobLocationLabel,
  jobTitle,
  packageLabel,
} from '@/components/jobs/shared';

// Job detail for one recipient — Apply/Decline while pending, the stage
// timeline once applied, plus cross-links to the full job profile, interview
// invites and offers for this card.

const MESSAGEABLE_STAGES = new Set([
  'shortlisted',
  'interview_invited',
  'interview',
  'on_hold',
  'selected',
  'offer',
  'hired',
]);

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
  // Full job + business profile, shown inline (recipient-gated server-side).
  const { data: profileData, isLoading: profileLoading } = useJobProfileView(
    data?.job_profile_id ?? undefined,
  );
  const canMessage = !!candidateStage && MESSAGEABLE_STAGES.has(candidateStage);
  const { data: conversations } = useConversations('talent', canMessage);
  const existingRoom = (conversations ?? []).find((c) => c.card_id === data?.card?.id);

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

      {/* Offer(s) — the most important thing in this phase, surfaced first as a
          prominent, clearly-clickable card that opens the full offer letter. */}
      {cardOffers.length > 0 && (
        <div className="space-y-4">
          {cardOffers.map((offer) => (
            <OfferHighlightCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Interview call(s) — shown in full at the top so the talent can respond
          inline without opening a separate page. */}
      {cardInvites.length > 0 && (
        <div className="space-y-4">
          {cardInvites.map(({ invite, job }) => (
            <InterviewInviteCard key={invite.id} inviteId={invite.id} job={job} />
          ))}
        </div>
      )}

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

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#E7E7EA] pt-4">
          {canMessage && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (existingRoom) {
                  router.push(`/talent/messages/${existingRoom.id}`);
                  return;
                }
                toast('The business has not opened a chatroom yet.');
              }}
            >
              Chatroom
            </Button>
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

      {/* Full job + business profile — the complete opening details, inline. */}
      {data.job_profile_id &&
        (profileLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        ) : profileData ? (
          <>
            <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
              <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                Job details
              </h2>
              <JobProfileSections profile={profileData.profile} />
            </div>
            <BusinessBrandSection
              business={profileData.profile.business_snapshot}
              brand={profileData.profile.brand_snapshot}
            />
            <JobQnASection
              jobProfileId={profileData.profile.id}
              cardId={data.card.id}
              questions={profileData.questions}
            />
          </>
        ) : null)}
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
