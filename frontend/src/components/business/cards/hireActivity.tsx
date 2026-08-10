'use client';

import { useMemo } from 'react';
import {
  useMySubscriptionCards,
  useMyAssignmentCards,
  type BusinessSubscriptionCardSummary,
} from '@/hooks/useBusiness';
import { useBusinessJobCards, type BusinessJobCardSummary } from '@/hooks/useBusinessJobs';
import { jobTitle, packageLabel } from '@/components/jobs/shared';

// Shared card-activity model used by both the Find talent "Your activity"
// section and the standalone "My Cards" page. Keeping the mappers, status
// styles and the data hook here means both surfaces render identical rows.

// ─── Types ───────────────────────────────────────────────────────────────────

export type HireProduct = 'subscription' | 'assignment' | 'job';

export type ActivityStatus =
  | 'open'
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'submitted'
  | 'sourcing'
  | 'interviewing'
  | 'filled'
  | 'closed';

export interface HireActivityItem {
  id: string;
  product: HireProduct;
  title: string;
  subtitle: string;
  status: ActivityStatus;
  meta: string;
  href?: string;
  /** Count of newly-accepted talents the business hasn't opened yet
   *  (subscription / assignment only). Drives the unread badge on the row. */
  unreadCount?: number;
}

export type FilterKey = 'all' | HireProduct;

// ─── Mappers ─────────────────────────────────────────────────────────────────

function classifySubCard(card: BusinessSubscriptionCardSummary): ActivityStatus {
  if (card.status === 'submitted') return 'submitted';
  if (card.status === 'archived' || card.cancelled_at || card.recalled_at) return 'cancelled';
  if (card.paused_at) return 'paused';
  if (card.status === 'assigned') return 'active';
  return 'open';
}

function subCardTitle(card: BusinessSubscriptionCardSummary): string {
  const left = card.brand_name || 'Untitled';
  const right = card.subscription_name;
  return right ? `${left} · ${right}` : left;
}

function subCardSubtitle(card: BusinessSubscriptionCardSummary): string {
  const { plan_name, plan_tier } = card;
  const tiers = card.tiers ?? [];
  if (card.is_group && tiers.length > 0) {
    return plan_name ? `${plan_name} · ${tiers.join(' · ')}` : tiers.join(' · ');
  }
  if (plan_name && plan_tier) return `${plan_name} · ${plan_tier}`;
  if (plan_name) return plan_name;
  if (plan_tier) return `${plan_tier} tier`;
  return card.card_type === 'assignment' ? 'Assignment' : 'Subscription';
}

function subCardMeta(card: BusinessSubscriptionCardSummary): string {
  const c = card.counts ?? {
    accepted: 0,
    pending: 0,
    rejected: 0,
    shortlisted: 0,
    for_review: 0,
    selected: 0,
    new_accepted: 0,
    pending_bids: 0,
  };
  const parts: string[] = [];
  if (c.pending_bids) parts.push(`${c.pending_bids} bid${c.pending_bids === 1 ? '' : 's'}`);
  if (c.for_review) parts.push(`${c.for_review} for review`);
  if (c.shortlisted) parts.push(`${c.shortlisted} shortlisted`);
  if (c.selected) parts.push(`${c.selected} selected`);
  if (c.pending) parts.push(`${c.pending} pending`);
  if (c.accepted) parts.push(`${c.accepted} accepted`);
  return parts.join(' · ') || 'No candidates yet';
}

export function mapSubCards(
  cards: BusinessSubscriptionCardSummary[],
  product: 'subscription' | 'assignment',
): HireActivityItem[] {
  const base = product === 'assignment' ? '/business/assignments' : '/business/subscription';
  return cards.map((card) => ({
    id: `${product}-${card.id}`,
    product,
    title: subCardTitle(card),
    subtitle: subCardSubtitle(card),
    status: classifySubCard(card),
    meta: card.status === 'submitted' ? 'Awaiting team review' : subCardMeta(card),
    href: `${base}/${card.id}`,
    // Badge on new acceptances AND open talent bids awaiting business action.
    unreadCount: (card.counts?.new_accepted ?? 0) + (card.counts?.pending_bids ?? 0),
  }));
}

function jobActivityStatus(card: BusinessJobCardSummary): ActivityStatus {
  const jc = card.job_card;
  if (jc?.closed_at) {
    return jc.close_mode === 'filled' ? 'filled' : 'closed';
  }
  switch (jc?.hiring_stage) {
    case 'interviewing':
    case 'offering':
      return 'interviewing';
    case 'screening':
    case 'sourcing':
    default:
      return 'sourcing';
  }
}

function jobFunnelMeta(card: BusinessJobCardSummary): string {
  const c = card.funnel_counts ?? {};
  const applied = (c.applied ?? 0) + (c.screening ?? 0);
  const parts: string[] = [];
  if (card.pending_recipients > 0) parts.push(`${card.pending_recipients} pending`);
  if (applied > 0) parts.push(`${applied} applied`);
  if (c.shortlisted) parts.push(`${c.shortlisted} shortlisted`);
  const interviews = (c.interview_invited ?? 0) + (c.interview ?? 0);
  if (interviews > 0) parts.push(`${interviews} in interviews`);
  if (c.selected) parts.push(`${c.selected} selected`);
  if (c.offer) parts.push(`${c.offer} offered`);
  const hired = (c.hired ?? 0) + (c.placed ?? 0);
  if (hired > 0) parts.push(`${hired} hired`);
  return parts.join(' · ') || 'No candidates yet';
}

export function mapJobCards(cards: BusinessJobCardSummary[]): HireActivityItem[] {
  return cards.map((card) => {
    const title = jobTitle(card.content);
    const pkg = packageLabel(card.content);
    const employment = card.content?.job_profile?.employment_type;
    const workMode = card.content?.job_profile?.work_mode;
    const subtitleParts = [employment, workMode, pkg].filter(Boolean);
    return {
      id: `job-${card.id}`,
      product: 'job' as const,
      title,
      subtitle: subtitleParts.length ? subtitleParts.join(' · ') : 'Job post',
      status: jobActivityStatus(card),
      meta: jobFunnelMeta(card),
      href: `/business/job-posts/${card.id}`,
    };
  });
}

// ─── Presentational maps ─────────────────────────────────────────────────────

export const STATUS_STYLES: Record<ActivityStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  active: { label: 'Active', className: 'bg-[#ECFDF5] text-[#047857]' },
  paused: { label: 'Paused', className: 'bg-[#FFF7ED] text-[#C2410C]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#F5F5F6] text-[#737373]' },
  submitted: { label: 'Submitted', className: 'bg-[#FFFBEB] text-[#B45309]' },
  sourcing: { label: 'Sourcing', className: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  interviewing: { label: 'Interviewing', className: 'bg-[#EEF2FF] text-[#4338CA]' },
  filled: { label: 'Filled', className: 'bg-[#ECFDF5] text-[#047857]' },
  closed: { label: 'Closed', className: 'bg-[#F5F5F6] text-[#737373]' },
};

export const PRODUCT_BADGE: Record<HireProduct, string> = {
  subscription: 'Subscription',
  assignment: 'Assignment',
  job: 'Job post',
};

export const PRODUCT_TINT: Record<HireProduct, string> = {
  subscription: 'tint-orange',
  assignment: 'tint-blue',
  job: 'tint-purple',
};

export function ProductIcon({ product }: { product: HireProduct }) {
  const path =
    product === 'subscription'
      ? 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
      : product === 'assignment'
        ? 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
        : 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z';
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

// Sample activity for the UI prototype so the list isn't empty before APIs are wired.
export const MOCK_ACTIVITY: HireActivityItem[] = [
  {
    id: 'mock-sub-1',
    product: 'subscription',
    title: 'Acme Studio · Design retainer',
    subtitle: 'Plus plan · Pro tier',
    status: 'active',
    meta: '2 candidates shortlisted · Active since Mar 2026',
  },
  {
    id: 'mock-asg-1',
    product: 'assignment',
    title: 'Launch kit — Q3 campaign',
    subtitle: 'Designer / Editor · Budget ₹45,000',
    status: 'open',
    meta: '4 talents ready for review',
  },
  {
    id: 'mock-job-1',
    product: 'job',
    title: 'Senior Accountant',
    subtitle: 'Full-time · Bangalore / Hybrid',
    status: 'interviewing',
    meta: '12 applied · 3 in interviews',
  },
  {
    id: 'mock-sub-2',
    product: 'subscription',
    title: 'Northwind · Bookkeeping',
    subtitle: 'Basic plan · Junior tier',
    status: 'open',
    meta: 'Waiting for talent matches',
  },
  {
    id: 'mock-job-2',
    product: 'job',
    title: 'Growth Marketer',
    subtitle: 'Full-time · Remote',
    status: 'sourcing',
    meta: 'Job live · 5 pending invites',
  },
];

// ─── Data hook ───────────────────────────────────────────────────────────────

/**
 * Aggregate the business's subscriptions, assignments and job posts into one
 * activity list. When `activity` is provided it's returned verbatim (tests);
 * when `preview` is set, mock data is used and live APIs stay disabled.
 */
export function useHireActivity({
  preview = false,
  activity,
}: {
  preview?: boolean;
  activity?: HireActivityItem[];
} = {}): { items: HireActivityItem[]; isLoading: boolean; isError: boolean } {
  const live = !preview && activity === undefined;
  const subQuery = useMySubscriptionCards(live);
  const asgQuery = useMyAssignmentCards(live);
  const jobQuery = useBusinessJobCards(live);

  const items = useMemo(() => {
    if (activity) return activity;
    if (preview) return MOCK_ACTIVITY;
    return [
      ...mapSubCards(subQuery.data ?? [], 'subscription'),
      ...mapSubCards(asgQuery.data ?? [], 'assignment'),
      ...mapJobCards(jobQuery.data ?? []),
    ];
  }, [activity, preview, subQuery.data, asgQuery.data, jobQuery.data]);

  const isLoading =
    live && (subQuery.isLoading || asgQuery.isLoading || jobQuery.isLoading);
  const isError =
    live && (subQuery.isError || asgQuery.isError || jobQuery.isError);

  return { items, isLoading, isError };
}
