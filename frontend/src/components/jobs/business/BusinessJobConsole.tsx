'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import CandidateFunnelTabs, { type FunnelTab } from './CandidateFunnelTabs';
import CandidateRow from './CandidateRow';
import StartScreeningButton from './StartScreeningButton';
import InterviewSchedulerModal from './InterviewSchedulerModal';
import InterviewRoundsList from './InterviewRoundsList';
import OfferComposer from './OfferComposer';
import NegotiationThread from './NegotiationThread';
import OfferDetailModal from './OfferDetailModal';
import HireDialog from './HireDialog';
import QnAManagerTab from './QnAManagerTab';
import {
  useBusinessJobCard,
  useBusinessJobCards,
  useCardOffers,
  useCloseJobCard,
  useInterviewRounds,
  useJobCandidates,
  useMarkJoined,
  useReviewCandidate,
  useWithdrawOffer,
  type BusinessOffer,
  type JobCandidateForBusiness,
} from '@/hooks/useBusinessJobs';
import {
  fmtDate,
  fmtDateTime,
  jobBusinessName,
  jobTitle,
  packageLabel,
  type BadgeVariantName,
} from '@/components/jobs/shared';

// Per-card hiring console: funnel tabs over the candidate pipeline, interview
// rounds, the offer engine, Q&A and an activity feed.

type ConsoleTab =
  | 'pending'
  | 'accepted'
  | 'shortlisted'
  | 'interviews'
  | 'selected'
  | 'offers'
  | 'hired'
  | 'rejected'
  | 'qa'
  | 'activity';

const OFFER_STATUS_BADGE: Record<string, { label: string; variant: BadgeVariantName }> = {
  draft: { label: 'Draft', variant: 'gray' },
  sent: { label: 'Sent', variant: 'blue' },
  negotiating: { label: 'Negotiating', variant: 'yellow' },
  countered: { label: 'Final counter out', variant: 'yellow' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

function actionBtn(kind: 'primary' | 'positive' | 'muted' | 'danger'): string {
  const base = 'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  switch (kind) {
    case 'primary':
      return `${base} bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]`;
    case 'positive':
      return `${base} bg-emerald-600 text-white hover:bg-emerald-700`;
    case 'danger':
      return `${base} border border-[#E7E7EA] text-[#737373] hover:border-red-200 hover:text-red-600`;
    default:
      return `${base} border border-[#E7E7EA] text-[#737373] hover:bg-[#F5F5F6]`;
  }
}

export default function BusinessJobConsole({ cardId }: { cardId: string }) {
  const router = useRouter();
  const { data: detail, isLoading, isError } = useBusinessJobCard(cardId);
  const { data: allCards } = useBusinessJobCards();
  const { data: candidates } = useJobCandidates(cardId);
  const { data: rounds } = useInterviewRounds(cardId);
  const { data: offers } = useCardOffers(cardId);
  const review = useReviewCandidate(cardId);
  const markJoined = useMarkJoined(cardId);
  const closeCard = useCloseJobCard(cardId);
  const withdrawOffer = useWithdrawOffer(cardId);

  const [tab, setTab] = useState<ConsoleTab>('accepted');
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [schedulerPreselect, setSchedulerPreselect] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerPreselect, setComposerPreselect] = useState<string[]>([]);
  const [editingOffer, setEditingOffer] = useState<BusinessOffer | null>(null);
  const [threadOffer, setThreadOffer] = useState<BusinessOffer | null>(null);
  const [detailOffer, setDetailOffer] = useState<BusinessOffer | null>(null);
  const [hireTarget, setHireTarget] = useState<{ candidateId: string; name: string | null } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const listEntry = (allCards ?? []).find((c) => c.id === cardId) ?? null;
  const pool = candidates ?? [];

  const byStage = useMemo(() => {
    const buckets: Record<string, JobCandidateForBusiness[]> = {};
    for (const c of pool) {
      (buckets[c.funnel_stage] ??= []).push(c);
    }
    return buckets;
  }, [pool]);

  const accepted = [...(byStage.applied ?? []), ...(byStage.screening ?? [])];
  const shortlisted = byStage.shortlisted ?? [];
  const inInterviews = [...(byStage.interview_invited ?? []), ...(byStage.interview ?? [])];
  const selectedPool = [...(byStage.selected ?? []), ...(byStage.on_hold ?? [])];
  const hiredPool = [...(byStage.hired ?? []), ...(byStage.placed ?? [])];
  const rejectedPool = [...(byStage.rejected ?? []), ...(byStage.withdrawn ?? [])];
  const offersList = offers ?? [];
  const openQuestions = null; // Q&A count comes from its own tab fetch.

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-72 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Job post not found.</p>
        <button
          onClick={() => router.push('/business/job-posts')}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to job posts
        </button>
      </div>
    );
  }

  const content = detail.card.content;
  const jc = detail.job_card;
  const title = jobTitle(content);
  const businessName = jobBusinessName(content);
  const pkg = packageLabel(content);
  const isClosed = !!jc?.closed_at;
  const screeningStarted = !!jc?.screening_started_at;
  const hiredCount = hiredPool.length;
  const openingsLeft = Math.max((jc?.openings ?? 1) - hiredCount, 0);

  const tabs: FunnelTab<ConsoleTab>[] = [
    { key: 'pending', label: 'Pending', count: listEntry?.pending_recipients ?? 0 },
    { key: 'accepted', label: 'Accepted', count: accepted.length },
    { key: 'shortlisted', label: 'Shortlisted', count: shortlisted.length },
    { key: 'interviews', label: 'Interviews', count: inInterviews.length },
    { key: 'selected', label: 'Finalists', count: selectedPool.length },
    { key: 'offers', label: 'Offers', count: offersList.filter((o) => o.status !== 'withdrawn').length },
    { key: 'hired', label: 'Hired', count: hiredPool.length },
    { key: 'rejected', label: 'Rejected', count: rejectedPool.length },
    { key: 'qa', label: 'Q&A', count: openQuestions },
    { key: 'activity', label: 'Activity' },
  ];

  const listShell = (children: React.ReactNode) => (
    <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  );

  const emptyState = (msg: string) => (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-[#737373]">{msg}</p>
    </div>
  );

  const divided = (rows: React.ReactNode[]) => (
    <ul className="divide-y divide-[#E7E7EA]">
      {rows.map((r, i) => (
        <li key={i}>{r}</li>
      ))}
    </ul>
  );

  // Synthesized activity feed: candidate stage changes + offers + rounds.
  const activity = [
    ...pool.map((c) => ({
      at: c.stage_changed_at,
      text: `${c.talent_name ?? 'A candidate'} → ${c.funnel_stage.replace(/_/g, ' ')}`,
    })),
    ...offersList.map((o) => ({
      at: o.sent_at ?? o.created_at,
      text: `Offer for ${o.talent_name ?? 'a candidate'} — ${o.status.replace(/_/g, ' ')}`,
    })),
    ...(rounds ?? []).map((r) => ({
      at: r.created_at,
      text: `Interview round ${r.round_no} scheduled (${r.mode}, ${fmtDateTime(r.window_start)})`,
    })),
  ].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  return (
    <div className="space-y-4">
      <Link
        href="/business/job-posts"
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to job posts
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
                {title}
              </h1>
              {isClosed ? (
                <Badge variant={jc?.close_mode === 'filled' ? 'green' : 'gray'}>
                  {jc?.close_mode === 'filled' ? 'Filled' : 'Closed'}
                </Badge>
              ) : (
                <Badge variant="indigo">{(jc?.hiring_stage ?? 'sourcing').replace('_', ' ')}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[#737373]">
              {businessName}
              {pkg ? ` · ${pkg}` : ''} · {jc?.openings ?? 1} opening{(jc?.openings ?? 1) === 1 ? '' : 's'}
              {hiredCount > 0 ? ` · ${hiredCount} hired` : ''}
              {screeningStarted ? ` · Screening since ${fmtDate(jc!.screening_started_at)}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isClosed && !screeningStarted && (
              <StartScreeningButton cardId={cardId} applicantCount={accepted.length} />
            )}
            {!isClosed &&
              (confirmClose ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#737373]">
                    Close &amp; withdraw open offers?
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={closeCard.isPending}
                    onClick={() =>
                      closeCard.mutate(undefined, { onSettled: () => setConfirmClose(false) })
                    }
                  >
                    Close post
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirmClose(true)}>
                  Close post
                </Button>
              ))}
          </div>
        </div>
      </div>

      {/* Funnel tabs */}
      <CandidateFunnelTabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ─── Pending ─── */}
      {tab === 'pending' &&
        listShell(
          emptyState(
            (listEntry?.pending_recipients ?? 0) > 0
              ? `${listEntry!.pending_recipients} matched talent${listEntry!.pending_recipients === 1 ? ' hasn’t' : 's haven’t'} responded to the opening yet. They appear in the funnel the moment they accept.`
              : 'No pending invitations — every matched talent has responded.',
          ),
        )}

      {/* ─── Accepted (applied + screening) ─── */}
      {tab === 'accepted' &&
        listShell(
          accepted.length === 0
            ? emptyState('No applicants yet — accepted talents land here.')
            : divided(
                accepted.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`}
                    actions={
                      !isClosed && (
                        <>
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'shortlist' })}
                            className={actionBtn('positive')}
                          >
                            Shortlist
                          </button>
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'on_hold' })}
                            className={actionBtn('muted')}
                          >
                            On hold
                          </button>
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'reject' })}
                            className={actionBtn('danger')}
                          >
                            Reject
                          </button>
                        </>
                      )
                    }
                  />
                )),
              ),
        )}

      {/* ─── Shortlisted ─── */}
      {tab === 'shortlisted' &&
        listShell(
          shortlisted.length === 0
            ? emptyState('Nobody shortlisted yet — review the accepted applicants first.')
            : divided(
                shortlisted.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`}
                    actions={
                      !isClosed && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSchedulerPreselect([c.id]);
                              setSchedulerOpen(true);
                            }}
                            className={actionBtn('primary')}
                          >
                            Call for interview
                          </button>
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'select' })}
                            className={actionBtn('positive')}
                          >
                            Select
                          </button>
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'reject' })}
                            className={actionBtn('danger')}
                          >
                            Reject
                          </button>
                        </>
                      )
                    }
                  />
                )),
              ),
        )}

      {/* ─── Interviews ─── */}
      {tab === 'interviews' && (
        <div className="space-y-3">
          {!isClosed && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setSchedulerPreselect(shortlisted.map((c) => c.id));
                  setSchedulerOpen(true);
                }}
              >
                Schedule interview round
              </Button>
            </div>
          )}
          <InterviewRoundsList cardId={cardId} rounds={rounds ?? []} />
          {inInterviews.length > 0 &&
            listShell(
              divided(
                inInterviews.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`}
                    subtitle={
                      c.funnel_stage === 'interview_invited'
                        ? 'Invited — waiting for their RSVP'
                        : 'Accepted the interview call'
                    }
                  />
                )),
              ),
            )}
        </div>
      )}

      {/* ─── Selected (+ on hold) ─── */}
      {tab === 'selected' &&
        listShell(
          selectedPool.length === 0
            ? emptyState('No finalists yet — record interview outcomes to fill this list.')
            : divided(
                selectedPool.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`}
                    actions={
                      !isClosed && (
                        <>
                          {c.funnel_stage === 'selected' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setComposerPreselect([c.id]);
                                setEditingOffer(null);
                                setComposerOpen(true);
                              }}
                              className={actionBtn('primary')}
                            >
                              Compose offer
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={review.isPending}
                              onClick={() => review.mutate({ candidateId: c.id, action: 'select' })}
                              className={actionBtn('positive')}
                            >
                              Select
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={review.isPending}
                            onClick={() => review.mutate({ candidateId: c.id, action: 'reject' })}
                            className={actionBtn('danger')}
                          >
                            {c.funnel_stage === 'selected' ? 'Decline' : 'Reject'}
                          </button>
                        </>
                      )
                    }
                  />
                )),
              ),
        )}

      {/* ─── Offers ─── */}
      {tab === 'offers' && (
        <div className="space-y-3">
          {!isClosed && (byStage.selected ?? []).length > 0 && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => {
                  setComposerPreselect([]);
                  setEditingOffer(null);
                  setComposerOpen(true);
                }}
              >
                New offer
              </Button>
            </div>
          )}
          {listShell(
            offersList.length === 0
              ? emptyState('No offers yet — select candidates, then compose an offer.')
              : divided(
                  offersList.map((o) => {
                    const badge = OFFER_STATUS_BADGE[o.status] ?? { label: o.status, variant: 'gray' as const };
                    return (
                      <div key={o.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                              {o.talent_name || 'Unknown talent'}
                            </p>
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            {o.is_final_counter && <Badge variant="yellow">FINAL</Badge>}
                            {o.delivery_mode === 'manual_email' && <Badge variant="gray">Own email</Badge>}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[#a3a3a3]">
                            {o.position_title}
                            {o.sent_at ? ` · Sent ${fmtDate(o.sent_at)}` : ` · Drafted ${fmtDate(o.created_at)}`}
                            {o.expires_on ? ` · Expires ${fmtDate(o.expires_on)}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {o.status === 'draft' && !isClosed && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOffer(o);
                                setComposerOpen(true);
                              }}
                              className={actionBtn('primary')}
                            >
                              Edit &amp; send
                            </button>
                          )}
                          {o.status === 'negotiating' && (
                            <button type="button" onClick={() => setThreadOffer(o)} className={actionBtn('primary')}>
                              Review negotiation
                            </button>
                          )}
                          {o.status === 'accepted' && !isClosed && (
                            <button
                              type="button"
                              onClick={() => setHireTarget({ candidateId: o.candidate_id, name: o.talent_name })}
                              className={actionBtn('positive')}
                            >
                              Hire
                            </button>
                          )}
                          <button type="button" onClick={() => setDetailOffer(o)} className={actionBtn('muted')}>
                            View
                          </button>
                          {!['negotiating'].includes(o.status) && (
                            <button type="button" onClick={() => setThreadOffer(o)} className={actionBtn('muted')}>
                              Thread
                            </button>
                          )}
                          {['sent', 'negotiating', 'countered'].includes(o.status) && !isClosed && (
                            <button
                              type="button"
                              disabled={withdrawOffer.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Recall this offer? The candidate will be notified it was withdrawn.',
                                  )
                                ) {
                                  withdrawOffer.mutate(o.id);
                                }
                              }}
                              className={actionBtn('danger')}
                            >
                              Recall
                            </button>
                          )}
                          <Link
                            href={`/business/job-posts/${cardId}/candidates/${o.candidate_id}`}
                            className={actionBtn('muted')}
                          >
                            View profile
                          </Link>
                        </div>
                      </div>
                    );
                  }),
                ),
          )}
        </div>
      )}

      {/* ─── Hired (+ placed) ─── */}
      {tab === 'hired' &&
        listShell(
          hiredPool.length === 0
            ? emptyState('Nobody hired yet — hire an offer-accepted candidate from the Offers tab.')
            : divided(
                hiredPool.map((c) => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`}
                    subtitle={
                      c.funnel_stage === 'placed'
                        ? `Joined ${fmtDate(c.joined_at)}`
                        : c.joining_date
                          ? `Joining ${fmtDate(c.joining_date)}`
                          : null
                    }
                    actions={
                      c.funnel_stage === 'hired' && (
                        <button
                          type="button"
                          disabled={markJoined.isPending}
                          onClick={() => markJoined.mutate(c.id)}
                          className={actionBtn('positive')}
                        >
                          Mark joined
                        </button>
                      )
                    }
                  />
                )),
              ),
        )}

      {/* ─── Rejected ─── */}
      {tab === 'rejected' &&
        listShell(
          rejectedPool.length === 0
            ? emptyState('Nobody rejected yet.')
            : divided(rejectedPool.map((c) => <CandidateRow key={c.id} candidate={c} profileHref={`/business/job-posts/${cardId}/candidates/${c.id}`} />)),
        )}

      {/* ─── Q&A ─── */}
      {tab === 'qa' && <QnAManagerTab cardId={cardId} />}

      {/* ─── Activity ─── */}
      {tab === 'activity' &&
        listShell(
          activity.length === 0
            ? emptyState('No activity yet.')
            : divided(
                activity.map((a, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 px-5 py-3">
                    <p className="text-sm text-[#0a0a0a]">{a.text}</p>
                    <span className="shrink-0 text-[11px] text-[#a3a3a3]">{fmtDateTime(a.at)}</span>
                  </div>
                )),
              ),
        )}

      {/* Modals */}
      <InterviewSchedulerModal
        key={`sched-${schedulerPreselect.join(',')}-${schedulerOpen}`}
        cardId={cardId}
        candidates={[...shortlisted, ...inInterviews.filter((c) => c.funnel_stage === 'interview')]}
        preselected={schedulerPreselect}
        open={schedulerOpen}
        onClose={() => setSchedulerOpen(false)}
      />
      <OfferComposer
        key={`offer-${editingOffer?.id ?? composerPreselect.join(',')}-${composerOpen}`}
        cardId={cardId}
        candidates={byStage.selected ?? []}
        preselected={composerPreselect}
        editOffer={editingOffer}
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          setEditingOffer(null);
        }}
      />
      {threadOffer && (
        <NegotiationThread
          cardId={cardId}
          offer={threadOffer}
          open={!!threadOffer}
          onClose={() => setThreadOffer(null)}
        />
      )}
      <OfferDetailModal
        offer={detailOffer}
        open={!!detailOffer}
        onClose={() => setDetailOffer(null)}
      />
      {hireTarget && (
        <HireDialog
          cardId={cardId}
          candidateId={hireTarget.candidateId}
          candidateName={hireTarget.name}
          openingsLeftHint={openingsLeft > 0 ? openingsLeft - 1 : 0}
          open={!!hireTarget}
          onClose={() => setHireTarget(null)}
        />
      )}
    </div>
  );
}
