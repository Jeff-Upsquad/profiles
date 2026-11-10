import LinkifiedText from '@/components/LinkifiedText';
import { cardBusinessLinks } from '../../../../../shared/src/businessLinks';
import { ASAP_LABEL, ASAP_DESCRIPTION, isAsSoonAsPossible } from '@/lib/creatorTimeline';
import type { BusinessSubscriptionCardDetail } from '@/hooks/useBusiness';
import { formatDate as formatLongDate } from '@/lib/formatDate';
import { isPerUnitAssignment, singularUnit, pluralizeUnit, optionalAssignmentQuantity, type AssignmentPricingDetails } from '@/lib/assignmentPricing';

const CREATOR_GROUPS: Record<string, string> = {
  channels: 'Platforms',
  creator_niches: 'Creator niches',
  creator_formats: 'Content formats',
  creator_services: 'Services',
  service_count: 'Service quantity',
  desired_age: 'Audience age groups',
  audience_location: 'Audience location',
  creator_audience: 'Creator audience',
  deliverables: 'Content deliverables',
  usage_rights: 'Usage rights & approvals',
  campaign_logistics: 'Campaign logistics',
  reference_links: 'Reference links',
};

function stringItems(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && !!item.trim()).map((item) => item.trim()) : [];
}

function formatPrice(amount: number | null, currency: string | null): string | null {
  if (amount == null) return null;
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString()}/mo`;
}

// Format an ISO date ("2026-07-15") as "15 July 2026". Parsed as local midnight
// so the day doesn't shift by timezone.
function fmtDate(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return formatLongDate(d);
}

export default function BusinessCardDetails({ card, isAssignment = card.card_type === 'assignment' }: { card: BusinessSubscriptionCardDetail; isAssignment?: boolean }) {
  const clientLinks = cardBusinessLinks({ ...card });
  const asap = isAsSoonAsPossible(card.additional_requirements);
  const isSubmitted = card.status === 'submitted';
  const isClosed = card.status === 'archived' || !!card.recalled_at;
  const requirements = card.additional_requirements ?? {};
  const isCreator = card.categories.some((category) => ['social-media-creator', 'social-media-creators', 'social_media_creator'].includes(category.slug)) || Object.keys(requirements).some((key) => key.startsWith('creator_'));
  const creatorLevels = stringItems(requirements.creator_levels);
  const creatorGroups = Object.entries(CREATOR_GROUPS).flatMap(([key, label]) => {
    // The legacy audience summary repeats the newer structured audience fields.
    if (key === 'creator_audience' && ['creator_niches', 'audience_location', 'desired_age'].some((field) => stringItems(requirements[field]).length)) return [];
    const items = stringItems(requirements[key]);
    return items.length ? [{ key, label, items }] : [];
  });
  // Prefer the company over the brand for the title — the brand is often the
  // brand the talent will work *on*, not the customer's name. Fall back to
  // brand, then subscription_name.
  const titleLead = card.customer_company || card.brand_name || card.subscription_name || (isAssignment ? 'Assignment card' : 'Subscription card');
  const title = card.subscription_name && titleLead !== card.subscription_name
    ? `${titleLead} · ${card.subscription_name}`
    : titleLead;
  // Per-level prices for the brief — one row per experience level with the
  // budget the client set for it. Falls back to the card's own price for
  // single-tier cards that never carried a per-tier breakdown.
  const levelPrices: Array<{ tier: string; price: number | null }> = card.tier_prices?.length
    ? card.tier_prices.map((t) => ({ tier: t.tier, price: t.price }))
    : card.target_tiers.length === 1 && card.customer_monthly_price != null
      ? [{ tier: card.target_tiers[0], price: card.customer_monthly_price }]
      : card.target_tiers.map((t) => ({ tier: t, price: null }));
  // Assignments are one-off projects — show the level budgets without "/mo".
  const levelPrice = (n: number) => {
    const p = formatPrice(n, card.currency);
    return isAssignment && p ? p.replace(/\/mo$/, '') : p;
  };
  const timeline = card.assignment_details ?? null;
  const assignmentPricing = (card.assignment_details ?? null) as AssignmentPricingDetails | null;
  const perUnitAssignment = isAssignment && isPerUnitAssignment(assignmentPricing);
  const workQuantity = optionalAssignmentQuantity(assignmentPricing);
  const workUnit = singularUnit(assignmentPricing);
  const workType = assignmentPricing?.work_type?.trim() ||
    (perUnitAssignment
      ? (assignmentPricing?.scope_type ?? '').replace(/^Business service\s*[·:-]\s*/i, '').trim()
      : '');
  return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              {title}
            </h1>
            {(card.plan_name || card.categories.length > 0) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {card.plan_name && (
                  <span className="text-sm text-[#737373]">{card.plan_name}</span>
                )}
                {card.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="rounded-full bg-[#F1F1F3] px-2.5 py-0.5 text-[11px] font-medium text-[#0a0a0a]"
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isSubmitted && (
              <span className="rounded-full bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
                Submitted
              </span>
            )}
            {isClosed && (
              <span className="rounded-full bg-[#f0f0f0] px-3 py-1 text-xs font-semibold text-[#737373]">
                {card.recalled_at ? 'Recalled' : 'Closed'}
              </span>
            )}
          </div>
        </div>

        {/* === Plan & levels === one price per experience level (the budgets
            the client set) instead of a single headline budget figure. */}
        {!isCreator && levelPrices.length > 0 && (
          <Section title={perUnitAssignment && workUnit ? `Levels & price per ${workUnit}` : isAssignment ? 'Levels & budget' : 'Plan & levels'}>
            <ul className="space-y-1.5">
              {levelPrices.map((l) => (
                <li key={l.tier} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-[#0a0a0a]">{l.tier}</span>
                  <span className="font-semibold text-[#0a0a0a]">
                    {l.price != null ? levelPrice(l.price) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {perUnitAssignment && workUnit && (
          <Section title="Work request">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {workType && <DetailRow label="Type of work">{workType}</DetailRow>}
              {workQuantity && <DetailRow label="Quantity">{workQuantity} {pluralizeUnit(workUnit, workQuantity)}</DetailRow>}
              <DetailRow label="Pricing">Talent quotes per {workUnit}</DetailRow>
            </dl>
          </Section>
        )}


        {isCreator && creatorLevels.length > 0 && (
          <Section title="Creator levels & budget">
            <table className="w-full table-fixed text-left text-sm text-[#0a0a0a]">
              <thead>
                <tr className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                  <th scope="col" className="w-1/2 pb-1.5 pr-3 font-medium">Follower range</th>
                  <th scope="col" className="pb-1.5 text-right font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {creatorLevels.map((level) => {
                  // Submitted briefs append an optional currency budget to the
                  // selected follower range. Keep that exact amount and cadence.
                  const match = level.match(/^(.*?)\s+\(([A-Z]{3}\s+[\d,.]+(?:\s*\/\s*month)?)\)$/);
                  return (
                    <tr key={level}>
                      <th scope="row" className="break-words py-1 pr-3 align-top font-medium">{match?.[1] ?? level}</th>
                      <td className="py-1 text-right align-top font-semibold tabular-nums">{match?.[2] ?? 'Not specified'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>
        )}
        {isCreator && creatorGroups.map(({ key, label, items }) => (
          <Section key={key} title={label}>
            {key === 'reference_links' ? (
              <ul className="space-y-2 text-sm">
                {items.map((item, index) => {
                  let safe = false;
                  try { safe = ['https:', 'http:'].includes(new URL(item).protocol); } catch { /* Show invalid URLs as plain text. */ }
                  return <li key={index} className="break-words">{safe ? <a href={item} target="_blank" rel="noopener noreferrer" className="text-[#0a0a0a] underline underline-offset-2">{item}</a> : <LinkifiedText text={item} />}</li>;
                })}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-sm text-[#525252]">
                {items.map((item, index) => <li key={index} className="whitespace-pre-line break-words"><LinkifiedText text={item} /></li>)}
              </ul>
            )}
          </Section>
        ))}

        {/* === Details === availability, schedule, location and languages in
            one compact grid (service/plan live in the title + subtitle). */}
        {(card.hours_label ||
          (card.working_days && card.working_days.length > 0) ||
          (card.target_country_names?.length ?? 0) > 0 ||
          card.target_regions.length > 0 ||
          card.target_languages.length > 0) && (
          <Section title="Details">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {card.hours_label && (
                <DetailRow label="Availability">{card.hours_label}</DetailRow>
              )}
              {!isAssignment && card.working_days && card.working_days.length > 0 && (
                <DetailRow label="Working days">{card.working_days.join(', ')}</DetailRow>
              )}
              {(card.target_country_names?.length ?? 0) > 0 && (
                <DetailRow label={card.target_country_names.length === 1 ? 'Country' : 'Countries'}>
                  {card.target_country_names.join(', ')}
                </DetailRow>
              )}
              {card.target_regions.length > 0 && (
                <DetailRow label={card.target_regions.length === 1 ? 'Region' : 'Regions'}>
                  {card.target_regions.map((r) => r.region).join(', ')}
                </DetailRow>
              )}
              {card.target_languages.length > 0 && (
                <DetailRow label={card.target_languages.length === 1 ? 'Language' : 'Languages'}>
                  {card.target_languages.join(', ')}
                </DetailRow>
              )}
            </dl>
          </Section>
        )}

        {/* === Custom deliverables === */}
        {card.custom_deliverables.length > 0 && (
          <Section title="Custom deliverables">
            <ul className="space-y-1 text-sm text-[#0a0a0a]">
              {card.custom_deliverables.map((d, i) => {
                const cadence = [
                  d.per_day ? `${d.per_day}/day` : null,
                  d.per_week ? `${d.per_week}/week` : null,
                  d.per_month ? `${d.per_month}/month` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <li key={d.id ?? i} className="flex items-baseline gap-2">
                    <span className="font-medium">{d.name || '—'}</span>
                    {cadence && <span className="text-xs text-[#737373]">{cadence}</span>}
                    {d.kind && <span className="text-[10px] text-[#a3a3a3] uppercase">{d.kind}</span>}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* === Timeline (assignments only) === */}
        {(asap || (isAssignment && timeline && (timeline.duration || timeline.start_date || timeline.deadline))) && (
          <Section title="Timeline">
            {asap && <div className="text-sm"><p className="font-medium">{ASAP_LABEL}</p><p className="mt-1 text-[#737373]">{ASAP_DESCRIPTION}</p></div>}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {timeline?.duration && <DetailRow label="Duration">{timeline.duration}</DetailRow>}
              {!asap && timeline?.start_date && <DetailRow label="Start date">{fmtDate(timeline.start_date)}</DetailRow>}
              {!asap && timeline?.deadline && <DetailRow label="Deadline">{fmtDate(timeline.deadline)}</DetailRow>}
            </dl>
          </Section>
        )}

        {/* === Scope & deliverables (assignments) — the client's project brief === */}
        {isAssignment && card.description && (
          <Section title="Scope & deliverables">
            <p className="whitespace-pre-line text-sm text-[#525252]"><LinkifiedText text={card.description} /></p>
          </Section>
        )}

        {/* === About the brand === customer's own brief */}
        {(clientLinks.length > 0 || card.brand_name || card.business_nature || card.customer_location || (!isAssignment && card.description)) && (
          <Section title="About the brand">
            {clientLinks.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{clientLinks.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#e5dfec] px-3 py-2 text-xs font-medium text-[#75518b] hover:bg-[#f5f0fa]">{link.label} ↗</a>)}</div>}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {card.brand_name && card.brand_name !== card.customer_company && (
                <DetailRow label="Brand">{card.brand_name}</DetailRow>
              )}
              {card.business_nature && (
                <DetailRow label="Nature of business">{card.business_nature}</DetailRow>
              )}
              {card.customer_location && (
                <DetailRow label="Location of business">{card.customer_location}</DetailRow>
              )}
            </dl>
            {!isAssignment && card.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-[#525252]">
                <LinkifiedText text={card.description} />
              </p>
            )}
          </Section>
        )}
      </div>

  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 border-t border-[#E7E7EA] pt-3">
      <h2 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
        {title}
      </h2>
      {children}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  // Mobile: label and value share one line (wrapping) so rows don't stack into
  // a tall column. sm+: back to the stacked label-above-value 2-col grid look.
  return (
    <div className="flex items-baseline gap-2 sm:block">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-[#0a0a0a]">{children}</dd>
    </div>
  );
}
