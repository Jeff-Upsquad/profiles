'use client';

import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

/**
 * Safe renderer for the flexible `content` JSONB. Only a whitelisted subset
 * of keys is rendered; everything else is silently ignored. No
 * dangerouslySetInnerHTML, no raw JSON dumps. New keys require a code change
 * here before they appear — intentional, not an oversight.
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
        <p className="line-clamp-5 whitespace-pre-line text-sm text-neutral-600">
          {description}
        </p>
      )}
      {expiresRelative && (
        <p className="text-xs text-neutral-500">Expires {expiresRelative}</p>
      )}
    </div>
  );
}
