'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import {
  OFFER_STATUS_BADGE,
  compensationRows,
  currencySymbol,
  fmtDate,
} from '@/components/jobs/shared';
import type { TalentJobOffer } from '@/hooks/useJobOffers';

// The offer — the single most important thing in the offer phase — rendered as
// a prominent, colour-accented card at the top of the job detail. The whole
// card links to the full offer letter (accept/decline/negotiate live there).

const CADENCE_SHORT: Record<string, string> = {
  per_month: '/mo',
  per_annum: '/yr',
  monthly: '/mo',
  annual: '/yr',
};

export default function OfferHighlightCard({ offer }: { offer: TalentJobOffer }) {
  const badge = OFFER_STATUS_BADGE[offer.status];
  const rows = compensationRows(offer.compensation);
  // Headline the after-probation figure when present, else the last populated row.
  const headline = rows.find((r) => r.key === 'confirmed') ?? rows[rows.length - 1] ?? null;
  const currency =
    offer.compensation && typeof offer.compensation.currency === 'string'
      ? offer.compensation.currency
      : 'INR';
  const responded = ['accepted', 'declined', 'withdrawn', 'expired'].includes(offer.status);
  const cta =
    offer.status === 'accepted'
      ? 'View your accepted offer'
      : responded
        ? 'View offer'
        : 'View & respond to offer';

  return (
    <Link
      href={`/talent/job-openings/offers/${offer.id}`}
      className="group block rounded-2xl border border-[#A7F3D0] bg-gradient-to-br from-[#ECFDF5] to-[#F0FDFA] p-5 shadow-[0_1px_3px_rgba(16,185,129,0.12)] transition-all hover:border-[#6EE7B7] hover:shadow-[0_4px_12px_rgba(16,185,129,0.18)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-semibold text-[#047857]">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Job offer
          </span>
          <h2 className="mt-2 truncate font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#064E3B]">
            {offer.position_title}
          </h2>
          <p className="mt-0.5 truncate text-sm text-[#047857]">
            {offer.business_name}
            {offer.job_title ? ` · ${offer.job_title}` : ''}
          </p>
        </div>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      {headline && (
        <p className="mt-3.5 text-2xl font-bold text-[#065F46]">
          {currencySymbol(currency)}
          {headline.amount.toLocaleString()}
          <span className="ml-1.5 text-sm font-medium text-[#059669]">
            {CADENCE_SHORT[headline.cadence] ?? ''} · {headline.label}
          </span>
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[#A7F3D0]/60 pt-3 sm:grid-cols-3">
        {offer.sent_at && (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#059669]/80">Sent</dt>
            <dd className="text-sm text-[#064E3B]">{fmtDate(offer.sent_at)}</dd>
          </div>
        )}
        {offer.join_by_date && (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#059669]/80">Join by</dt>
            <dd className="text-sm text-[#064E3B]">{fmtDate(offer.join_by_date)}</dd>
          </div>
        )}
        {offer.expires_on && (
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wider text-[#059669]/80">
              Valid till
            </dt>
            <dd className="text-sm text-[#064E3B]">{fmtDate(offer.expires_on)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-[#A7F3D0]/60 pt-3.5">
        <span className="text-sm font-semibold text-[#047857]">{cta}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#059669] text-white transition-transform group-hover:translate-x-0.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
