'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ConnectBriefDrawer from '@/components/business/connect-brief/ConnectBriefDrawer';
import BusinessCardsList from '@/components/business/cards/BusinessCardsList';
import {
  useHireActivity,
  type HireActivityItem,
  type HireProduct,
} from '@/components/business/cards/hireActivity';

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
    cta: 'Create a subscription',
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
    cta: 'Create an assignment',
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
    cta: 'Create a job post',
    accent: 'tint-purple',
    iconPath:
      'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
];

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
  // Aggregated subscriptions + assignments + job posts (live, mock, or override).
  const { items, isLoading, isError } = useHireActivity({ preview, activity });

  // Any existing sub / assignment / job → fold Quick compare into a closed dropdown.
  const hasCards = items.length > 0;
  // When the business has an active (assigned) engagement, surface the activity
  // list above the discovery/product sections (Change 1).
  const hasActiveCards = useMemo(() => items.some((i) => i.status === 'active'), [items]);
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

  // Rendered once — either above the discovery sections (active cards) or below
  // them (default). Only one branch mounts, so its internal filter state is safe.
  const cardsList = (
    <BusinessCardsList
      items={items}
      isLoading={isLoading}
      isError={isError}
      preview={preview}
    />
  );

  const openCreate = (product: HireProduct) => {
    setCreateMenuOpen(false);
    // Don't set selectedProduct here — that flag only controls the Learn more
    // expand state. Opening Create was leaving the matching card permanently open.
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

      {/* ── Your activity — surfaced on top when there are active engagements ── */}
      {hasActiveCards && cardsList}

      {/* ── What do you need? — product explainers + create CTAs ── */}
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

      {/* ── Your activity — default position, below the discovery sections ── */}
      {!hasActiveCards && cardsList}

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
              {submitted ? 'Submitted' : 'Create a job post'}
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
              we&apos;ll get the role live. A full self-serve form is next — this is a lightweight create flow for now.
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
                Create
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
