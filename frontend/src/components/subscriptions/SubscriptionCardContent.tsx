'use client';

import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

/**
 * Renders a subscription card in a plan-tile layout. Priority order:
 *   1. Title + plan name + POPULAR ribbon (if is_popular)
 *   2. HOURS — hours_label + capacity_label (big, primary)
 *   3. DELIVERABLES — deliverables_label + custom_deliverables list
 *   4. PAYMENT — price_label or formatted monthly_price/currency (green accent)
 *   5. Secondary details (Working Days, Client Brief, Countries, Languages)
 *
 * Everything is optional; sections only render when data is present. The
 * renderer is a safe whitelist — unknown keys are silently ignored, no
 * dangerouslySetInnerHTML, no raw JSON dump.
 *
 * SquadHub forwarding contract: keys mirror SquadHub's subscription_cards
 * columns (custom_deliverables, working_days, brand_name, business_nature,
 * notes) plus the plan-tile fields (plan_name, hours_label, capacity_label,
 * deliverables_label, monthly_price + currency OR price_label, is_popular).
 */

// ────────────────────────────────────────────────────────────
// Coercion helpers
// ────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : String(x ?? '')))
    .map((s) => s.trim())
    .filter(Boolean);
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
      // Hours-kind items feed the dedicated HOURS section via hours_label;
      // skip them here so they don't double-render.
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
  icon,
  children,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: 'neutral' | 'money' | 'deliverables';
}) {
  const color =
    tone === 'money' ? 'text-emerald-700'
    : tone === 'deliverables' ? 'text-blue-700'
    : 'text-neutral-500';
  return (
    <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
      <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        {icon}
      </span>
      {children}
    </p>
  );
}

function Chip({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'neutral' }) {
  const classes =
    tone === 'indigo'
      ? 'bg-indigo-50 text-indigo-700'
      : 'bg-neutral-100 text-neutral-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {children}
    </span>
  );
}

const IconClock = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <circle cx="10" cy="10" r="7" />
    <path strokeLinecap="round" d="M10 6v4l2.5 2" />
  </svg>
);
const IconClipboard = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <rect x="5" y="4" width="10" height="13" rx="1.5" />
    <path strokeLinecap="round" d="M8 4h4v2H8z M8 9h4 M8 12h4" />
  </svg>
);
const IconMoney = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <circle cx="10" cy="10" r="7.5" />
    <path strokeLinecap="round" d="M10 6v8 M12.5 7.5c-.8-.8-2-1-3-.5-1.2.5-1.2 2 0 2.5l2 .8c1.2.5 1.2 2 0 2.5-1 .5-2.2.3-3-.5" />
  </svg>
);
const IconCalendar = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <rect x="3.5" y="5" width="13" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M3.5 9h13 M7 3.5v3 M13 3.5v3" />
  </svg>
);
const IconBriefcase = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <rect x="3" y="6" width="14" height="10" rx="1.5" />
    <path strokeLinecap="round" d="M7.5 6V4.5h5V6 M3 10h14" />
  </svg>
);
const IconGlobe = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <circle cx="10" cy="10" r="7.5" />
    <path strokeLinecap="round" d="M2.5 10h15 M10 2.5c2.5 2.5 2.5 12.5 0 15 M10 2.5c-2.5 2.5-2.5 12.5 0 15" />
  </svg>
);
const IconSpeech = (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5h12a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H9l-3 2.5v-2.5H4A1.5 1.5 0 012.5 13V7A1.5 1.5 0 014 5.5z" />
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

  const deliverablesLabel = asString(content.deliverables_label).trim();
  const deliverables = normalizeDeliverables(content.custom_deliverables);

  const priceLabelRaw = asString(content.price_label).trim();
  const priceFormatted =
    priceLabelRaw || formatPrice(content.monthly_price, content.currency);

  const workingDays = asStringArray(content.working_days);
  const brandName = asString(content.brand_name).trim();
  const businessNature = asString(content.business_nature).trim();
  const notes = asString(content.notes).trim();
  const countries = asStringArray(content.target_country_names);
  const languages = asStringArray(content.target_languages);

  const hasClientBrief = brandName || businessNature || notes;
  const hasStructured =
    hoursLabel ||
    capacityLabel ||
    deliverablesLabel ||
    deliverables.length > 0 ||
    priceFormatted ||
    workingDays.length > 0 ||
    hasClientBrief ||
    countries.length > 0 ||
    languages.length > 0;
  const showDescription = description && !hasStructured;

  const expiresRelative = formatRelativeExpiry(
    typeof content.expiresAt === 'string' ? content.expiresAt : undefined
  );

  const planLine = [subscriptionName, planName].filter(Boolean).join(' · ');

  return (
    <div className="relative flex flex-col gap-4">
      {isPopular && (
        <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
          Popular
        </span>
      )}

      {imageUrl.startsWith('https://') && (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-32 w-full rounded-lg object-cover"
        />
      )}

      {/* Header */}
      <div>
        {title && (
          <h3 className="text-base font-semibold leading-tight text-neutral-900">
            {title}
          </h3>
        )}
        {planLine && (
          <p className="mt-0.5 text-xs text-neutral-500">{planLine}</p>
        )}
      </div>

      {showDescription && (
        <p className="whitespace-pre-line text-sm text-neutral-600">
          {description}
        </p>
      )}

      {/* ── PRIMARY: Work commitment (Hours + Deliverables) ─────
          Group both under one "WORK COMMITMENT" wrapper when both
          are present; otherwise render the surviving section in the
          simpler standalone style so a solo sub-card under a heavy
          section header doesn't look lopsided. */}
      {(() => {
        const hasHours = Boolean(hoursLabel || capacityLabel);
        const hasDeliverables = Boolean(deliverablesLabel || deliverables.length > 0);

        if (hasHours && hasDeliverables) {
          return (
            <div>
              <SectionLabel icon={IconBriefcase} tone="deliverables">Work commitment</SectionLabel>
              <div className="mt-2 space-y-2">
                {/* Hours sub-card */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700/70">
                    <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">{IconClock}</span>
                    Hours
                  </p>
                  {hoursLabel && (
                    <p className="mt-1 text-base font-semibold text-blue-700">{hoursLabel}</p>
                  )}
                  {capacityLabel && (
                    <p className="text-xs text-blue-700/60">{capacityLabel}</p>
                  )}
                </div>

                {/* Deliverables sub-card */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700/70">
                    <span aria-hidden="true" className="inline-flex h-3.5 w-3.5 items-center justify-center">{IconClipboard}</span>
                    Deliverables
                  </p>
                  {deliverablesLabel && (
                    <p className="mt-1 text-sm font-medium text-blue-700">{deliverablesLabel}</p>
                  )}
                  {deliverables.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {deliverables.map((d, i) => (
                        <li key={i} className="flex items-baseline gap-2">
                          <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-base font-semibold text-blue-700">{d.label}</span>
                            {d.description && (
                              <span className="text-xs font-normal text-blue-700/70">{d.description}</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        }

        if (hasHours) {
          // Standalone Hours — no wrapper, no nested card.
          return (
            <div>
              <SectionLabel icon={IconClock}>Hours</SectionLabel>
              {hoursLabel && (
                <p className="mt-1 text-base font-semibold text-neutral-900">{hoursLabel}</p>
              )}
              {capacityLabel && (
                <p className="text-xs text-neutral-500">{capacityLabel}</p>
              )}
            </div>
          );
        }

        if (hasDeliverables) {
          // Standalone Deliverables — keep the iter-2 blue styling.
          return (
            <div>
              <SectionLabel icon={IconClipboard} tone="deliverables">Deliverables</SectionLabel>
              {deliverablesLabel && (
                <p className="mt-1 text-base font-semibold text-blue-700">{deliverablesLabel}</p>
              )}
              {deliverables.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {deliverables.map((d, i) => (
                    <li key={i} className="flex items-baseline gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="text-lg font-semibold text-blue-700">{d.label}</span>
                        {d.description && (
                          <span className="text-xs font-normal text-blue-700/70">{d.description}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        return null;
      })()}

      {/* ── Payment ───────────────────────────────────── */}
      {priceFormatted && (
        <div>
          <SectionLabel icon={IconMoney} tone="money">Payment</SectionLabel>
          <p className="mt-1 text-lg font-semibold text-emerald-700">
            {priceFormatted}
            <span className="text-xs font-normal text-emerald-700/70"> /month</span>
          </p>
        </div>
      )}

      {/* ── Secondary details ─────────────────────────── */}
      {(workingDays.length > 0 ||
        hasClientBrief ||
        countries.length > 0 ||
        languages.length > 0) && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          {workingDays.length > 0 && (
            <div>
              <SectionLabel icon={IconCalendar}>Working Days</SectionLabel>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {workingDays.map((d, i) => (
                  <Chip key={i}>{d}</Chip>
                ))}
              </div>
            </div>
          )}

          {hasClientBrief && (
            <div>
              <SectionLabel icon={IconBriefcase}>Client Brief</SectionLabel>
              <div className="mt-1 space-y-0.5 text-sm text-neutral-700">
                {brandName && (
                  <p>
                    <span className="text-neutral-500">Brand:</span>{' '}
                    <span className="font-medium">{brandName}</span>
                  </p>
                )}
                {businessNature && (
                  <p>
                    <span className="text-neutral-500">Nature of business:</span>{' '}
                    {businessNature}
                  </p>
                )}
                {notes && (
                  <p className="whitespace-pre-line text-neutral-600">{notes}</p>
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
                  <Chip key={i} tone="neutral">{c}</Chip>
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
                  <Chip key={i} tone="neutral">{l}</Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {expiresRelative && (
        <p className="text-xs text-neutral-500">Expires {expiresRelative}</p>
      )}
    </div>
  );
}
