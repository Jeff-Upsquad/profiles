'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import ConnectBriefDrawer from '@/components/business/connect-brief/ConnectBriefDrawer';
import {
  useMySubscriptionCards,
  useMyAssignmentCards,
  type BusinessSubscriptionCardSummary,
} from '@/hooks/useBusiness';
import { useBusinessJobCards, type BusinessJobCardSummary } from '@/hooks/useBusinessJobs';
import { jobTitle, packageLabel } from '@/components/jobs/shared';
import { SkeletonCard } from '@/components/ui/Skeleton';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HireProduct = 'subscription' | 'assignment' | 'job';

type ActivityStatus =
  | 'open'
  | 'active'
  | 'paused'
  | 'cancelled'
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
}

// ─── Product copy ────────────────────────────────────────────────────────────

const PRODUCTS: {
  id: HireProduct;
  label: string;
  shortLabel: string;
  tagline: string;
  /** One-line blurb shown on the card by default */
  summary: string;
  /** Full explanation revealed under Learn more */
  description: string;
  /** Section heading above the bullet list (e.g. Features / Best for) */
  detailsLabel: string;
  details: string[];
  howItWorks: string[];
  cta: string;
  accent: string;
  iconPath: string;
}[] = [
  {
    id: 'subscription',
    label: 'Subscription',
    shortLabel: 'Subscription',
    tagline: 'Ongoing monthly talent',
    summary: 'A specialist on a monthly hours plan — like a flexible part-timer.',
    description:
      'Get dedicated talent working with you every month on the hours plan you choose. Unlimited work requests and unlimited changes, within the hours of your plan — without adding full-time headcount.',
    detailsLabel: 'Features',
    details: [
      'Pause anytime — remaining balance stays as credit when you resume',
      'Cancel anytime — remaining balance is refunded',
      'Replace talent if you\'re not satisfied',
      'Upgrade or downgrade your plan',
      'Squad Manager included — a dedicated resource who helps manage the work, coordinates with talent, and keeps delivery on track',
      'Squad Hub — once talent is onboarded, this is where work is managed: projects, tasks, communication, and performance',
      'Unlimited work requests & unlimited changes, based on the hourly plan you pick',
    ],
    howItWorks: [
      'Tell us the role, plan hours, and budget',
      'We match and shortlist talent for you to review',
      'Once you pick, day-to-day work runs in Squad Hub (projects, tasks, and communication)',
    ],
    cta: 'Request a subscription',
    accent: 'tint-orange',
    iconPath:
      'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  },
  {
    id: 'assignment',
    label: 'Assignment',
    shortLabel: 'Assignment',
    tagline: 'One-off project work',
    summary: 'A defined project with scope, budget, and timeline — no retainer.',
    description:
      'Hire talent for a defined project with a clear scope, budget, and timeline. Ideal when you need something shipped without a monthly commitment.',
    detailsLabel: 'Best for',
    details: [
      'Project-based deliverables',
      'Fixed budget and deadline',
      'Trying a talent before a longer commitment',
    ],
    howItWorks: [
      'Share the brief, budget, and timeline',
      'We match freelancers who fit the scope',
      'You shortlist, select, and get the work delivered',
    ],
    cta: 'Request an assignment',
    accent: 'tint-blue',
    iconPath:
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
  {
    id: 'job',
    label: 'Job post',
    shortLabel: 'Job post',
    tagline: 'Full hiring funnel',
    summary: 'Post a role and hire end-to-end — screen, interview, offer.',
    description:
      'Post a role and run a complete hiring process — sourcing, screening, interviews, offers, and hire. Use this when you want someone on payroll or a permanent seat on your team.',
    detailsLabel: 'Best for',
    details: [
      'Full-time or permanent roles',
      'Interview-based selection',
      'Building your in-house team',
    ],
    howItWorks: [
      'Share the role, package, and requirements',
      'Candidates apply and move through your funnel',
      'Schedule interviews, send offers, and hire',
    ],
    cta: 'Request a job post',
    accent: 'tint-purple',
    iconPath:
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FilterKey = 'all' | HireProduct;

function classifySubCard(card: BusinessSubscriptionCardSummary): ActivityStatus {
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
  };
  const parts: string[] = [];
  if (c.for_review) parts.push(`${c.for_review} for review`);
  if (c.shortlisted) parts.push(`${c.shortlisted} shortlisted`);
  if (c.selected) parts.push(`${c.selected} selected`);
  if (c.pending) parts.push(`${c.pending} pending`);
  if (c.accepted) parts.push(`${c.accepted} accepted`);
  return parts.join(' · ') || 'No candidates yet';
}

function mapSubCards(
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
    meta: subCardMeta(card),
    href: `${base}/${card.id}`,
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

function mapJobCards(cards: BusinessJobCardSummary[]): HireActivityItem[] {
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

const STATUS_STYLES: Record<ActivityStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  active: { label: 'Active', className: 'bg-[#ECFDF5] text-[#047857]' },
  paused: { label: 'Paused', className: 'bg-[#FFF7ED] text-[#C2410C]' },
  cancelled: { label: 'Cancelled', className: 'bg-[#F5F5F6] text-[#737373]' },
  sourcing: { label: 'Sourcing', className: 'bg-[#EFF6FF] text-[#1D4ED8]' },
  interviewing: { label: 'Interviewing', className: 'bg-[#EEF2FF] text-[#4338CA]' },
  filled: { label: 'Filled', className: 'bg-[#ECFDF5] text-[#047857]' },
  closed: { label: 'Closed', className: 'bg-[#F5F5F6] text-[#737373]' },
};

const PRODUCT_BADGE: Record<HireProduct, string> = {
  subscription: 'Subscription',
  assignment: 'Assignment',
  job: 'Job post',
};

const PRODUCT_TINT: Record<HireProduct, string> = {
  subscription: 'tint-orange',
  assignment: 'tint-blue',
  job: 'tint-purple',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function BusinessHireHub({
  activity,
  preview = false,
}: {
  /** Override activity list (e.g. tests). When omitted: live APIs, or mock if preview. */
  activity?: HireActivityItem[];
  /** Public preview mode — mock data, no auth, soft links. */
  preview?: boolean;
}) {
  // Live data when not preview and no explicit activity override.
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

  // Any existing sub / assignment / job → fold Quick compare into a closed dropdown.
  const hasCards = items.length > 0;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selectedProduct, setSelectedProduct] = useState<HireProduct | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefProduct, setBriefProduct] = useState<'subscription' | 'assignment'>('subscription');
  const [jobNoticeOpen, setJobNoticeOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  /** Desktop: anchored under Create. Mobile: bottom sheet (isSheet). */
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    isSheet: boolean;
  } | null>(null);
  // Open by default only when they have nothing yet (education). Collapse when cards exist.
  const [compareOpen, setCompareOpen] = useState(() => !hasCards);
  const [compareSeeded, setCompareSeeded] = useState(false);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  // Seed compare open/closed once live data finishes loading.
  useEffect(() => {
    if (preview || activity) {
      if (!compareSeeded) {
        setCompareOpen(!hasCards);
        setCompareSeeded(true);
      }
      return;
    }
    if (!isLoading && !compareSeeded) {
      setCompareOpen(!hasCards);
      setCompareSeeded(true);
    }
  }, [preview, activity, isLoading, hasCards, compareSeeded]);

  const placeCreateMenu = () => {
    const el = createBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const isSheet = window.innerWidth < 640;
    if (isSheet) {
      setMenuPos({ top: 0, left: 0, isSheet: true });
      return;
    }
    const menuW = 288;
    const pad = 12;
    // Prefer left-align under the button; clamp so it never clips off-screen.
    let left = r.left;
    if (left + menuW > window.innerWidth - pad) {
      left = window.innerWidth - menuW - pad;
    }
    if (left < pad) left = pad;
    setMenuPos({ top: r.bottom + 8, left, isSheet: false });
  };

  // Reposition Create menu on resize/scroll (portal; hero overflow can't clip it).
  useEffect(() => {
    if (!createMenuOpen) return;
    placeCreateMenu();
    window.addEventListener('resize', placeCreateMenu);
    window.addEventListener('scroll', placeCreateMenu, true);
    return () => {
      window.removeEventListener('resize', placeCreateMenu);
      window.removeEventListener('scroll', placeCreateMenu, true);
    };
  }, [createMenuOpen]);

  const counts = useMemo(() => {
    const c = { all: items.length, subscription: 0, assignment: 0, job: 0 };
    for (const i of items) c[i.product] += 1;
    return c;
  }, [items]);

  const visible = filter === 'all' ? items : items.filter((i) => i.product === filter);

  const openCreate = (product: HireProduct) => {
    setCreateMenuOpen(false);
    setSelectedProduct(product);
    if (product === 'job') {
      setJobNoticeOpen(true);
      return;
    }
    setBriefProduct(product);
    setBriefOpen(true);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── Hero: title + Create on one row (fixes mobile stack misalignment) ── */}
      <section className="hero-container hero-glow-orange relative rounded-2xl border border-[#E7E7EA] bg-white px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="hero-glow-blur" />
        <div className="hero-content flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 stagger-1">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#E7E7EA] bg-[#FAFAFA] px-2.5 py-1 text-[11px] font-semibold text-[#525252]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a0a0a]" />
                <span className="truncate">
                  {isLoading
                    ? 'Loading…'
                    : `${counts.subscription} sub · ${counts.assignment} assignment · ${counts.job} job`}
                </span>
              </span>
            </div>
            <h1 className="font-[family-name:var(--font-jakarta)] text-[22px] sm:text-[24px] font-semibold tracking-[-0.025em] leading-[1.15] text-[#0a0a0a] stagger-2">
              Find <span className="text-rainbow">talent</span>.
            </h1>
            <p className="mt-1 max-w-xl font-[family-name:var(--font-jakarta)] text-[13px] leading-snug text-[#525252] stagger-3">
              Subscriptions, assignments, and job posts in one place.
            </p>
            {preview && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[10px] font-semibold text-[#0a0a0a] stagger-3">
                UI preview · sample data
              </p>
            )}
          </div>

          <div className="relative z-20 shrink-0 pt-0.5 stagger-3">
            <button
              ref={createBtnRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={createMenuOpen}
              onClick={() => {
                if (!createMenuOpen) placeCreateMenu();
                setCreateMenuOpen((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#0a0a0a] px-3 py-2 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-200 hover:bg-[#0a0a0a]/85 active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-2.5"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create
              <svg className={`h-3.5 w-3.5 transition-transform ${createMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Create menu — mobile bottom sheet; desktop anchored dropdown */}
      {portalReady &&
        createMenuOpen &&
        menuPos &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[60] bg-black/40 ${menuPos.isSheet ? '' : 'bg-transparent'}`}
              onClick={() => setCreateMenuOpen(false)}
            />
            <div
              role="menu"
              className={
                menuPos.isSheet
                  ? 'fixed inset-x-0 bottom-0 z-[70] max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#E7E7EA] bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.25)]'
                  : 'fixed z-[70] w-72 overflow-hidden rounded-xl border border-[#E7E7EA] bg-white py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.2)]'
              }
              style={
                menuPos.isSheet
                  ? undefined
                  : { top: menuPos.top, left: menuPos.left }
              }
            >
              {menuPos.isSheet && (
                <div className="flex items-center justify-between border-b border-[#E7E7EA] px-4 py-3">
                  <p className="text-sm font-semibold text-[#0a0a0a]">Create</p>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setCreateMenuOpen(false)}
                    className="rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className={menuPos.isSheet ? 'py-1' : ''}>
                {PRODUCTS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    onClick={() => openCreate(p.id)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F5F5F6] sm:px-3.5 sm:py-3"
                  >
                    <span
                      className={`${p.accent} mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-8 sm:w-8 sm:rounded-lg`}
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#0a0a0a]">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-[#737373]">{p.tagline}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* ── What do you need? — product explainers ── */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              What do you need?
            </h2>
            <p className="mt-0.5 text-sm text-[#737373]">
              Three ways to work with talent — choose the one that matches how you want to engage.
            </p>
          </div>
        </div>

        <div className="grid items-start gap-3 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const isExpanded = selectedProduct === p.id;
            return (
              <article
                key={p.id}
                className={`group relative flex flex-col rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all ${
                  isExpanded
                    ? 'border-[#0a0a0a] ring-1 ring-[#0a0a0a]'
                    : 'border-[#E7E7EA] hover:border-[#D4D4D8]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedProduct(isExpanded ? null : p.id)}
                  className="flex flex-col p-5 text-left"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div
                      className={`${p.accent} flex h-11 w-11 items-center justify-center rounded-xl`}
                      style={{ color: 'var(--tint-icon)' }}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={p.iconPath} />
                      </svg>
                    </div>
                    <span className="rounded-full bg-[#F5F5F6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#737373]">
                      {p.tagline}
                    </span>
                  </div>
                  <h3 className="font-[family-name:var(--font-jakarta)] text-[17px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                    {p.label}
                  </h3>
                  {/* Collapsed: short one-line summary. Expanded details below. */}
                  <p className="mt-1.5 text-[13px] leading-snug text-[#737373]">
                    {p.summary}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0a0a0a]">
                    {isExpanded ? 'Hide details' : 'Learn more'}
                    <svg
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-[#E7E7EA] bg-[#FAFAFA] px-5 py-4">
                    <p className="text-[13px] leading-relaxed text-[#525252]">
                      {p.description}
                    </p>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
                        {p.detailsLabel}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {p.details.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-[13px] text-[#525252]">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0a0a0a]" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
                        How it works
                      </p>
                      <ol className="mt-2 space-y-1.5">
                        {p.howItWorks.map((step, i) => (
                          <li key={step} className="flex items-start gap-2.5 text-[13px] text-[#525252]">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#FFFAC2] text-[10px] font-bold text-[#0a0a0a]">
                              {i + 1}
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreate(p.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#0a0a0a]/85 active:scale-[0.99]"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      {p.cta}
                    </button>
                  </div>
                )}

                {!isExpanded && (
                  <div className="border-t border-[#E7E7EA] px-5 py-3">
                    <button
                      type="button"
                      onClick={() => openCreate(p.id)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E7E7EA] bg-white px-3 py-2 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
                    >
                      {p.cta}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Quick compare — collapsed by default when user already has cards ── */}
      <section className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setCompareOpen((v) => !v)}
          aria-expanded={compareOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#FAFAFA] sm:px-5"
        >
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              Quick compare
            </h2>
            {!compareOpen && (
              <p className="mt-0.5 truncate text-[11px] text-[#a3a3a3]">
                Subscription vs assignment vs job post
              </p>
            )}
          </div>
          <svg
            className={`h-4 w-4 shrink-0 text-[#737373] transition-transform ${compareOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {compareOpen && (
          <div className="border-t border-[#E7E7EA]">
            <p className="px-4 pt-2 text-[11px] text-[#a3a3a3] sm:px-5">
              Not sure which to pick? At a glance:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-b border-[#E7E7EA] bg-[#FAFAFA] text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
                    <th className="px-4 py-1.5 sm:px-5"> </th>
                    <th className="px-2.5 py-1.5">Subscription</th>
                    <th className="px-2.5 py-1.5">Assignment</th>
                    <th className="px-2.5 py-1.5 sm:pr-5">Job post</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E7EA] text-[#525252]">
                  <CompareRow
                    label="Engagement"
                    values={['Monthly, ongoing', 'One project', 'Permanent / salaried']}
                  />
                  <CompareRow
                    label="Commitment"
                    values={['Plan of hours / mo', 'Scope + budget + timeline', 'Role on your team']}
                  />
                  <CompareRow
                    label="You select"
                    values={['Matched shortlist', 'Matched shortlist', 'Full funnel']}
                  />
                  <CompareRow
                    label="Managed in"
                    values={['Squad Hub', 'Squad Hub', 'This portal']}
                  />
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Activity list ── */}
      <section className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-col gap-3 border-b border-[#E7E7EA] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              Your activity
            </h2>
            <p className="mt-0.5 text-sm text-[#737373]">
              All subscriptions, assignments, and job posts in one list.
            </p>
          </div>
        </div>

        <div className="border-b border-[#E7E7EA] px-5 sm:px-6" role="tablist" aria-label="Filter by type">
          <div className="-mb-px flex gap-1 overflow-x-auto">
            {(
              [
                { key: 'all' as const, label: 'All' },
                { key: 'subscription' as const, label: 'Subscriptions' },
                { key: 'assignment' as const, label: 'Assignments' },
                { key: 'job' as const, label: 'Job posts' },
              ] as const
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.key)}
                  className={`relative shrink-0 px-3 py-3 text-sm font-semibold transition-colors ${
                    active ? 'text-[#0a0a0a]' : 'text-[#737373] hover:text-[#0a0a0a]'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 text-xs font-medium ${active ? 'text-[#525252]' : 'text-[#a3a3a3]'}`}>
                    {counts[tab.key]}
                  </span>
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#0a0a0a]" />}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 px-5 py-5 sm:px-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="px-5 py-10 sm:px-6">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-900">Could not load your activity.</p>
              <p className="mt-0.5 text-sm text-red-700">Refresh the page to try again.</p>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F5F5F6]">
              <svg className="h-5 w-5 text-[#a3a3a3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
              Nothing here yet
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-[#737373]">
              Create a subscription, assignment, or job post above and it will show up in this list.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#E7E7EA]">
            {visible.map((item) => {
              const status = STATUS_STYLES[item.status];
              const body = (
                <div className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#F5F5F6] sm:px-6">
                  <div
                    className={`${PRODUCT_TINT[item.product]} flex h-11 w-11 shrink-0 items-center justify-center rounded-xl`}
                    style={{ color: 'var(--tint-icon)' }}
                  >
                    <ProductIcon product={item.product} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
                        {item.title}
                      </p>
                      <span className="shrink-0 rounded-full bg-[#F5F5F6] px-2 py-0.5 text-[10px] font-semibold text-[#525252]">
                        {PRODUCT_BADGE[item.product]}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[#737373]">{item.subtitle}</p>
                    <p className="mt-0.5 truncate text-xs text-[#a3a3a3]">{item.meta}</p>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-[#D4D4D8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              );

              if (item.href && !preview) {
                return (
                  <li key={item.id}>
                    <Link href={item.href}>{body}</Link>
                  </li>
                );
              }
              return (
                <li key={item.id} className={preview ? 'cursor-default' : undefined}>
                  {body}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Existing brief forms for subscription & assignment */}
      <ConnectBriefDrawer
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        product={briefProduct}
      />

      {/* Job post create — placeholder until job brief form exists */}
      {jobNoticeOpen && (
        <JobRequestModal onClose={() => setJobNoticeOpen(false)} />
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function CompareRow({ label, values }: { label: string; values: [string, string, string] }) {
  return (
    <tr>
      <th className="whitespace-nowrap px-4 py-1.5 text-left text-[11px] font-semibold text-[#0a0a0a] sm:px-5">
        {label}
      </th>
      {values.map((v) => (
        <td key={v} className="px-2.5 py-1.5 text-[12px] leading-snug last:sm:pr-5">
          {v}
        </td>
      ))}
    </tr>
  );
}

function ProductIcon({ product }: { product: HireProduct }) {
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

function JobRequestModal({ onClose }: { onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl border border-[#E7E7EA] bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Job post</p>
            <h3 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.015em] text-[#0a0a0a]">
              {submitted ? 'Request received' : 'Request a job post'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[#a3a3a3] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-[#525252]">
              Thanks — our team will set up the hiring funnel for this role and publish it to your Job posts list.
              (Prototype: this doesn&apos;t call the API yet.)
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-[10px] bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <p className="text-sm leading-relaxed text-[#525252]">
              Job posts use a full hiring funnel (screening → interviews → offers). Share a few details and
              we&apos;ll get the role live. A full self-serve form is next — this is a lightweight request for the UI pass.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#0a0a0a]">Role title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Accountant"
                className="w-full rounded-xl border border-[#E7E7EA] bg-white px-3.5 py-2.5 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-[#0a0a0a]">Notes (optional)</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Location, package range, must-have skills…"
                className="w-full resize-none rounded-xl border border-[#E7E7EA] bg-white px-3.5 py-2.5 text-sm text-[#0a0a0a] outline-none focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/10"
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-[10px] border border-[#E7E7EA] px-4 py-2.5 text-sm font-semibold text-[#525252] hover:bg-[#F5F5F6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-[10px] bg-[#0a0a0a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a0a0a]/85"
              >
                Submit request
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
