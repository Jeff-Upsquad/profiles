'use client';

import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

/**
 * Safe renderer for the flexible `content` JSONB. Only a whitelisted subset
 * of keys is rendered; everything else is silently ignored. No
 * dangerouslySetInnerHTML, no raw JSON dumps. New keys require a code change
 * here before they appear — intentional, not an oversight.
 *
 * Key names mirror SquadHub's subscription_cards schema so its publisher can
 * forward the columns verbatim:
 *   - custom_deliverables: Array<{ label?: string; description?: string } | string>
 *   - working_days: string[]
 *   - brand_name, business_nature, notes: strings (rendered under "Client Brief")
 *   - target_country_names: string[] (publisher must resolve UUIDs → names)
 *   - target_languages: string[]
 *
 * NOTE: if SquadHub serves images from its own CDN, that host needs to be
 * added to `next.config.ts`'s `images.remotePatterns` before `next/image`
 * can be used. Until then, imageUrl is rendered via a plain <img> with a
 * referrerPolicy to avoid leaking the talent's dashboard URL.
 */

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

function normalizeDeliverables(v: unknown): DeliverableItem[] {
  if (!Array.isArray(v)) return [];
  const out: DeliverableItem[] = [];
  for (const item of v) {
    if (typeof item === 'string') {
      const label = item.trim();
      if (label) out.push({ label });
    } else if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      const label =
        asString(obj.label).trim() ||
        asString(obj.name).trim() ||
        asString(obj.title).trim();
      const description = asString(obj.description).trim();
      if (label || description) {
        out.push({ label: label || '—', description: description || undefined });
      }
    }
  }
  return out;
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {children}
    </span>
  );
}

interface Props {
  content: SubscriptionCardContentShape;
}

export default function SubscriptionCardContent({ content }: Props) {
  const title = asString(content.title).trim();
  const description = asString(content.description).trim();
  const imageUrl = asString(content.imageUrl).trim();
  const expiresRelative = formatRelativeExpiry(
    typeof content.expiresAt === 'string' ? content.expiresAt : undefined
  );

  const deliverables = normalizeDeliverables(content.custom_deliverables);
  const workingDays = asStringArray(content.working_days);
  const brandName = asString(content.brand_name).trim();
  const businessNature = asString(content.business_nature).trim();
  const notes = asString(content.notes).trim();
  const countries = asStringArray(content.target_country_names);
  const languages = asStringArray(content.target_languages);

  const hasClientBrief = brandName || businessNature || notes;

  return (
    <div className="flex flex-col gap-3">
      {imageUrl.startsWith('https://') && (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-40 w-full rounded-lg object-cover"
        />
      )}
      {title && (
        <h3 className="line-clamp-2 text-base font-semibold text-neutral-900">
          {title}
        </h3>
      )}
      {description && (
        <p className="whitespace-pre-line text-sm text-neutral-600">
          {description}
        </p>
      )}

      {deliverables.length > 0 && (
        <DetailSection title="Deliverables">
          <ul className="space-y-1 text-sm text-neutral-700">
            {deliverables.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-neutral-400" />
                <div>
                  <span className="font-medium">{d.label}</span>
                  {d.description && (
                    <span className="text-neutral-500"> — {d.description}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      {workingDays.length > 0 && (
        <DetailSection title="Working Days">
          <div className="flex flex-wrap gap-1.5">
            {workingDays.map((d, i) => (
              <Chip key={i}>{d}</Chip>
            ))}
          </div>
        </DetailSection>
      )}

      {hasClientBrief && (
        <DetailSection title="Client Brief">
          <div className="space-y-1 text-sm text-neutral-700">
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
            {notes && <p className="whitespace-pre-line text-neutral-600">{notes}</p>}
          </div>
        </DetailSection>
      )}

      {countries.length > 0 && (
        <DetailSection title={countries.length === 1 ? 'Country' : 'Countries'}>
          <div className="flex flex-wrap gap-1.5">
            {countries.map((c, i) => (
              <Chip key={i}>{c}</Chip>
            ))}
          </div>
        </DetailSection>
      )}

      {languages.length > 0 && (
        <DetailSection title={languages.length === 1 ? 'Language' : 'Languages'}>
          <div className="flex flex-wrap gap-1.5">
            {languages.map((l, i) => (
              <Chip key={i}>{l}</Chip>
            ))}
          </div>
        </DetailSection>
      )}

      {expiresRelative && (
        <p className="text-xs text-neutral-500">Expires {expiresRelative}</p>
      )}
    </div>
  );
}
