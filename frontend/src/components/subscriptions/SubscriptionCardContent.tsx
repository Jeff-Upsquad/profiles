'use client';

import { formatDate as formatLongDate } from '@/lib/formatDate';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

// ────────────────────────────────────────────────────────────
// Coercion helpers
// ────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

// Format an ISO date string ("2026-07-15") as "15 July 2026". Parsed as local
// midnight so the day doesn't shift by timezone. Returns the raw value
// unchanged if it isn't a parseable date.
function fmtDate(s: string): string {
  const v = s.trim();
  if (!v) return v;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return formatLongDate(d);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : String(x ?? '')))
    .map((s) => s.trim())
    .filter(Boolean);
}

// Optional "additional requirements" the client attached to the brief: a map
// of group key → labels. Display labels for the common groups; unknown keys are
// title-cased so future SquadHub groups still render sensibly.
const AR_GROUP_LABELS: Record<string, string> = {
  skills: 'Skill sets',
  tools: 'Tools',
  software: 'Software',
  ai_tools: 'AI tools',
  accounting_software: 'Accounting software',
};
function arGroupLabel(key: string): string {
  return (
    AR_GROUP_LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
function parseAdditionalRequirements(
  raw: unknown,
): { key: string; label: string; items: string[] }[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: { key: string; label: string; items: string[] }[] = [];
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const items = asStringArray(val);
    if (items.length) out.push({ key, label: arGroupLabel(key), items });
  }
  return out;
}

// Match the first two letters case-insensitively so "Mon" / "monday" / "MON" all resolve.
const WEEK_ORDER = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;

function weekIndex(day: string): number {
  const key = day.trim().slice(0, 2).toLowerCase();
  const i = WEEK_ORDER.indexOf(key as (typeof WEEK_ORDER)[number]);
  return i === -1 ? WEEK_ORDER.length : i;
}

function isWeekend(day: string): boolean {
  const i = weekIndex(day);
  return i === 5 || i === 6;
}

interface DeliverableItem {
  label: string;
  description?: string;
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function formatItemCadence(d: Record<string, unknown>): string {
  const perDay = asNumber(d.per_day);
  const perWeek = asNumber(d.per_week);
  const perMonth = asNumber(d.per_month);
  const parts: string[] = [];
  if (perDay) parts.push(`${perDay}/day`);
  if (perWeek) parts.push(`${perWeek}/week`);
  if (perMonth) parts.push(`${perMonth}/month`);
  return parts.join(' · ');
}

function normalizeDeliverables(v: unknown): DeliverableItem[] {
  if (!Array.isArray(v)) return [];
  const out: DeliverableItem[] = [];
  for (const item of v) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) out.push({ label });
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      if (asString(obj.kind).trim() === 'hours') continue;
      const label =
        asString(obj.label).trim() ||
        asString(obj.name).trim() ||
        asString(obj.title).trim();
      const description =
        asString(obj.description).trim() || formatItemCadence(obj);
      if (label || description) {
        out.push({ label: label || '—', description: description || undefined });
      }
    }
  }
  return out;
}

function formatPrice(amount: unknown, currency: unknown): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  const cur = typeof currency === 'string' && currency ? currency : 'INR';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${cur} ${amount.toLocaleString()}`;
  }
}

function formatRelativeExpiry(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const diffMs = d.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  return rtf.format(Math.round(diffMs / day), 'day');
}

// ────────────────────────────────────────────────────────────
// Visual primitives
// ────────────────────────────────────────────────────────────

function SectionLabel({
  icon, children, color,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <p
      className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: color ?? '#a3a3a3' }}
    >
      <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">
        {icon}
      </span>
      {children}
    </p>
  );
}

function Chip({ children, tint = 'neutral' }: { children: React.ReactNode; tint?: 'neutral' | 'purple' }) {
  const classes =
    tint === 'purple'
      ? 'bg-[#FFFAC2] text-[#0a0a0a] ring-1 ring-inset ring-[#0a0a0a]'
      : 'bg-[#F5F5F6] text-[#525252] ring-1 ring-inset ring-[#E7E7EA]';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-[family-name:var(--font-inter)] text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

const IconClock = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <circle cx="10" cy="10" r="7" />
    <path strokeLinecap="round" d="M10 6v4l2.5 2" />
  </svg>
);
const IconClipboard = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <rect x="5" y="4" width="10" height="13" rx="1.5" />
    <path strokeLinecap="round" d="M8 4h4v2H8z M8 9h4 M8 12h4" />
  </svg>
);
const IconMoney = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <circle cx="10" cy="10" r="7.5" />
    <path strokeLinecap="round" d="M10 6v8 M12.5 7.5c-.8-.8-2-1-3-.5-1.2.5-1.2 2 0 2.5l2 .8c1.2.5 1.2 2 0 2.5-1 .5-2.2.3-3-.5" />
  </svg>
);
const IconCalendar = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <rect x="3.5" y="5" width="13" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M3.5 9h13 M7 3.5v3 M13 3.5v3" />
  </svg>
);
const IconBriefcase = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <rect x="3" y="6" width="14" height="10" rx="1.5" />
    <path strokeLinecap="round" d="M7.5 6V4.5h5V6 M3 10h14" />
  </svg>
);
const IconGlobe = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <circle cx="10" cy="10" r="7.5" />
    <path strokeLinecap="round" d="M2.5 10h15 M10 2.5c2.5 2.5 2.5 12.5 0 15 M10 2.5c-2.5 2.5-2.5 12.5 0 15" />
  </svg>
);
const IconSpeech = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h12a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H9l-3 2.5v-2.5H4A1.5 1.5 0 012.5 13V7A1.5 1.5 0 014 5.5z" />
  </svg>
);
const IconSparkles = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 3.5l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3L5 8l3.3-1.2 1.2-3.3zM17 13l.8 2.2 2.2.8-2.2.8L17 19l-.8-2.2-2.2-.8 2.2-.8L17 13z" />
  </svg>
);

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

interface Props {
  content: SubscriptionCardContentShape;
}

export default function SubscriptionCardContent({ content }: Props) {
  const title = asString(content.title).trim();
  const imageUrl = asString(content.imageUrl).trim();
  const description = asString(content.description).trim();

  const planName = asString(content.plan_name).trim();
  const subscriptionName = asString(content.subscription_name).trim();
  const isPopular = content.is_popular === true;

  const hoursLabel = asString(content.hours_label).trim();
  const capacityLabel = asString(content.capacity_label).trim();

  // Prefer deliverables_label (SquadHub maps requirement_note here). Fall back
  // to requirement_note if a consumer sent it only under that key.
  const deliverablesLabel =
    asString(content.deliverables_label).trim() ||
    asString(content.requirement_note).trim();
  // Client's recorded requirement voice note (public R2 URL), if any.
  const requirementVoiceUrl = asString(content.requirement_voice_url).trim();
  const deliverables = normalizeDeliverables(content.custom_deliverables);

  const priceLabelRaw = asString(content.price_label).trim();
  const priceFormatted =
    priceLabelRaw || formatPrice(content.monthly_price, content.currency);

  // Assignment cards reuse monthly_price as the one-off project budget. Relabel
  // the Payment section and surface the timeline (plan/hours are absent on
  // these cards, so those sections self-hide).
  const isAssignment = asString(content.card_type).trim() === 'assignment';
  const assignmentDetails = (content.assignment_details ?? {}) as Record<string, unknown>;
  const assignmentDuration = asString(assignmentDetails.duration).trim();
  const assignmentStartDate = asString(assignmentDetails.start_date).trim();
  const assignmentDeadline = asString(assignmentDetails.deadline).trim();

  // Assignments don't use working days — drop them so the section self-hides.
  const workingDaysSorted = isAssignment
    ? []
    : [...asStringArray(content.working_days)].sort((a, b) => weekIndex(a) - weekIndex(b));
  const weekdayDays = workingDaysSorted.filter((d) => !isWeekend(d));
  const weekendDays = workingDaysSorted.filter(isWeekend);
  const brandName = asString(content.brand_name).trim();
  const businessNature = asString(content.business_nature).trim();
  const customerLocation = asString(content.customer_location).trim();
  const notes = asString(content.notes).trim();
  const countries = asStringArray(content.target_country_names);
  const languages = asStringArray(content.target_languages);
  // Optional skills/tools the client attached to the brief. Descriptive only —
  // shown as nice-to-haves; never a condition of accepting the card.
  const additionalGroups = parseAdditionalRequirements(content.additional_requirements);
  const hasAdditional = additionalGroups.length > 0;

  // Client brief = engagement identity only (brand / role / plan).
  // About the client = company context under a toggle (nature, location, notes).
  // Do not repeat requirement here — it lives only under Deliverables.
  const hasClientBrief = Boolean(brandName || subscriptionName || planName);
  const hasAboutClient = Boolean(businessNature || customerLocation || notes);
  const hasStructured =
    hoursLabel || capacityLabel || deliverablesLabel ||
    deliverables.length > 0 || priceFormatted ||
    workingDaysSorted.length > 0 || hasClientBrief || hasAboutClient ||
    countries.length > 0 || languages.length > 0 || hasAdditional;
  const showDescription = description && !hasStructured;

  const expiresRelative = formatRelativeExpiry(
    typeof content.expiresAt === 'string' ? content.expiresAt : undefined
  );

  const planLine = [subscriptionName, planName].filter(Boolean).join(' · ');

  return (
    <div className="relative flex flex-col gap-4">
      {isPopular && (
        <span className="absolute -top-2 right-0 z-10 rounded-full bg-rainbow px-2.5 py-0.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider text-white shadow-[0_4px_12px_rgba(210,77,255,0.35)]">
          Popular
        </span>
      )}

      {imageUrl.startsWith('https://') && (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-32 w-full rounded-xl object-cover ring-1 ring-[#E7E7EA]"
        />
      )}

      {/* Header */}
      {(title || planLine) && (
        <div>
          {title && (
            <h3 className="font-[family-name:var(--font-jakarta)] text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0a0a0a]">
              {title}
            </h3>
          )}
          {planLine && (
            <p className="mt-0.5 font-[family-name:var(--font-inter)] text-xs text-[#737373]">{planLine}</p>
          )}
        </div>
      )}

      {showDescription && (
        <p className="whitespace-pre-line text-sm text-[#525252] leading-relaxed">
          {description}
        </p>
      )}

      {/* Work commitment — Hours + Deliverables + Voice note (grouped) */}
      {(() => {
        const hasHours = Boolean(hoursLabel || capacityLabel);
        const hasDeliverables = Boolean(deliverablesLabel || deliverables.length > 0);
        const hasVoice = Boolean(requirementVoiceUrl);
        if (!hasHours && !hasDeliverables && !hasVoice) return null;

        return (
          <div>
            <SectionLabel icon={IconBriefcase} color="#0a0a0a">Work commitment</SectionLabel>
            <div className="mt-2 grid gap-2">
              {/* Hours sub-card — hidden for assignments (no hourly-commitment concept) */}
              {!isAssignment && (
              <div className="tint-blue rounded-xl p-3" style={{ color: 'var(--tint-icon)' }}>
                <p className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">{IconClock}</span>
                  Hours
                </p>
                {hasHours ? (
                  <>
                    {hoursLabel && (
                      <p className="mt-1 font-[family-name:var(--font-jakarta)] text-base font-semibold" style={{ color: 'var(--tint-text)' }}>
                        {hoursLabel}
                      </p>
                    )}
                    {capacityLabel && (
                      <p className="text-xs opacity-70">{capacityLabel}</p>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm font-medium opacity-70">No hourly commitment</p>
                )}
              </div>
              )}

              {/* Deliverables sub-card — subscriptions always show it (placeholder
                  when empty); assignments only when there's real content. */}
              {(!isAssignment || hasDeliverables) && (
              <div className="tint-blue rounded-xl p-3" style={{ color: 'var(--tint-icon)' }}>
                <p className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider opacity-70">
                  <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">{IconClipboard}</span>
                  Deliverables
                </p>
                {hasDeliverables ? (
                  <>
                    {deliverablesLabel && (
                      <p className="mt-1 font-[family-name:var(--font-inter)] text-sm font-medium" style={{ color: 'var(--tint-text)' }}>
                        {deliverablesLabel}
                      </p>
                    )}
                    {deliverables.length > 0 && (
                      <ul className="mt-1 space-y-1">
                        {deliverables.map((d, i) => (
                          <li key={i} className="flex items-baseline gap-2">
                            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: 'var(--tint-icon)' }} />
                            <div className="flex flex-wrap items-baseline gap-x-1.5">
                              <span className="font-[family-name:var(--font-jakarta)] text-base font-semibold" style={{ color: 'var(--tint-text)' }}>
                                {d.label}
                              </span>
                              {d.description && (
                                <span className="text-xs font-normal opacity-70">{d.description}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <p className="mt-1 text-sm font-medium opacity-70">No specific deliverables</p>
                )}
              </div>
              )}

              {/* Voice note from the client — its own prominent block so it's
                  unmistakably playable. Shows for subscriptions and assignments. */}
              {hasVoice && (
                <div className="tint-amber rounded-xl p-3" style={{ color: 'var(--tint-icon)' }}>
                  <p className="flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m0 0h-3.75m3.75 0h3.75M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </span>
                    Voice note from the client
                  </p>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls preload="none" src={requirementVoiceUrl} className="mt-2 h-10 w-full" />
                  <p className="mt-1.5 font-[family-name:var(--font-inter)] text-[11px] opacity-70">
                    The client recorded the requirement in their own words — tap play to listen.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Payment — green tint. Assignments show a one-off project budget. */}
      {priceFormatted && (
        <div>
          <SectionLabel icon={IconMoney} color="#1F7E36">{isAssignment ? 'Project budget' : 'Payment'}</SectionLabel>
          <p className="mt-1 font-[family-name:var(--font-jakarta)] text-xl font-semibold tracking-[-0.02em] text-[#1F7E36]">
            {priceFormatted}
            {!isAssignment && (
              <span className="font-[family-name:var(--font-inter)] text-xs font-normal text-[#1F7E36]/70"> /month</span>
            )}
          </p>
          {isAssignment && (assignmentDuration || assignmentStartDate || assignmentDeadline) && (
            <p className="mt-1 font-[family-name:var(--font-inter)] text-xs text-[#737373]">
              {[
                assignmentDuration && `Duration: ${assignmentDuration}`,
                assignmentStartDate && `Starts ${fmtDate(assignmentStartDate)}`,
                assignmentDeadline && `Due ${fmtDate(assignmentDeadline)}`,
              ].filter(Boolean).join('  ·  ')}
            </p>
          )}
        </div>
      )}

      {/* Secondary details */}
      {(workingDaysSorted.length > 0 || hasClientBrief || hasAboutClient || countries.length > 0 || languages.length > 0) && (
        <div className="space-y-3 border-t border-[#E7E7EA] pt-3">
          {workingDaysSorted.length > 0 && (
            <div>
              <SectionLabel icon={IconCalendar}>Working Days</SectionLabel>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {weekdayDays.map((d, i) => (
                  <Chip key={`wd-${i}`} tint="purple">{d}</Chip>
                ))}
                {weekendDays.length > 0 && (
                  <>
                    {weekdayDays.length > 0 && (
                      <span aria-hidden="true" className="mx-0.5 h-3 w-px bg-[#E7E7EA]" />
                    )}
                    <span className="font-[family-name:var(--font-inter)] text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                      Weekend
                    </span>
                    {weekendDays.map((d, i) => (
                      <Chip key={`we-${i}`} tint="purple">{d}</Chip>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Client brief = engagement identity only. Requirement lives in Deliverables. */}
          {hasClientBrief && (
            <div>
              <SectionLabel icon={IconBriefcase}>Client Brief</SectionLabel>
              <div className="mt-1 space-y-0.5 text-sm">
                {brandName && (
                  <p>
                    <span className="text-[#737373]">Brand:</span>{' '}
                    <span className="font-medium text-[#0a0a0a]">{brandName}</span>
                  </p>
                )}
                {subscriptionName && (
                  <p>
                    <span className="text-[#737373]">Role:</span>{' '}
                    <span className="text-[#0a0a0a]">{subscriptionName}</span>
                  </p>
                )}
                {planName && (
                  <p>
                    <span className="text-[#737373]">Plan:</span>{' '}
                    <span className="text-[#0a0a0a]">{planName}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* About the client — always visible so nothing hides behind a toggle.
              Rendered as a distinct card to give the company context real weight. */}
          {hasAboutClient && (
            <div>
              <SectionLabel icon={IconBriefcase}>About the client</SectionLabel>
              <div className="mt-1.5 space-y-1.5 rounded-xl bg-[#FAFAFA] p-3 text-sm ring-1 ring-inset ring-[#EDEDED]">
                {businessNature && (
                  <p>
                    <span className="text-[#737373]">Nature of business:</span>{' '}
                    <span className="font-medium text-[#0a0a0a]">{businessNature}</span>
                  </p>
                )}
                {customerLocation && (
                  <p>
                    <span className="text-[#737373]">Location of business:</span>{' '}
                    <span className="font-medium text-[#0a0a0a]">{customerLocation}</span>
                  </p>
                )}
                {notes && (
                  <p className="whitespace-pre-line leading-relaxed text-[#525252]">{notes}</p>
                )}
              </div>
            </div>
          )}

          {countries.length > 0 && (
            <div>
              <SectionLabel icon={IconGlobe}>
                {countries.length === 1 ? 'Country' : 'Countries'}
              </SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {countries.map((c, i) => (
                  <Chip key={i}>{c}</Chip>
                ))}
              </div>
            </div>
          )}

          {languages.length > 0 && (
            <div>
              <SectionLabel icon={IconSpeech}>
                {languages.length === 1 ? 'Language' : 'Languages'}
              </SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {languages.map((l, i) => (
                  <Chip key={i}>{l}</Chip>
                ))}
              </div>
            </div>
          )}

          {/* Additional requirements — optional skills/tools the client would
              like. Descriptive only; not a condition of accepting the card. */}
          {hasAdditional && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel icon={IconSparkles}>Additional requirements</SectionLabel>
                <span className="shrink-0 rounded-full bg-[#F3F3F4] px-2 py-0.5 font-[family-name:var(--font-inter)] text-[9.5px] font-bold uppercase tracking-wide text-[#737373] ring-1 ring-inset ring-[#E7E7EA]">
                  Optional
                </span>
              </div>
              <div className="mt-2 space-y-2.5">
                {additionalGroups.map((g) => (
                  <div key={g.key}>
                    <p className="font-[family-name:var(--font-inter)] text-[11px] font-semibold text-[#737373]">
                      {g.label}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {g.items.map((it, i) => (
                        <Chip key={i}>{it}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 font-[family-name:var(--font-inter)] text-[11px] leading-relaxed text-[#a3a3a3]">
                Nice-to-haves from the client — not required to accept this card.
              </p>
            </div>
          )}
        </div>
      )}

      {expiresRelative && (
        <p className="inline-flex items-center gap-1.5 font-[family-name:var(--font-inter)] text-xs text-[#a3a3a3]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Expires {expiresRelative}
        </p>
      )}
    </div>
  );
}
