'use client';

import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import OfferResponseBar from './OfferResponseBar';
import OfferThread from './OfferThread';
import { useJobOffer, useMyJobOffers, type OfferCompensation, type OfferStatus } from '@/hooks/useJobOffers';
import { currencySymbol, fmtDate } from '@/components/jobs/shared';
import type { BadgeVariantName } from '@/components/jobs/shared';

// Full offer view for the talent: frozen letter sections, the compensation
// table, response actions and the negotiation/question thread.

const STATUS_BADGE: Record<OfferStatus, { label: string; variant: BadgeVariantName }> = {
  draft: { label: 'Draft', variant: 'gray' },
  sent: { label: 'Awaiting your response', variant: 'indigo' },
  negotiating: { label: 'Negotiating', variant: 'yellow' },
  countered: { label: 'Final counteroffer', variant: 'yellow' },
  accepted: { label: 'Accepted', variant: 'green' },
  declined: { label: 'Declined', variant: 'red' },
  withdrawn: { label: 'Withdrawn', variant: 'gray' },
  expired: { label: 'Expired', variant: 'gray' },
};

const CADENCE_LABELS: Record<string, string> = {
  per_month: 'Per month',
  per_annum: 'Per annum',
  monthly: 'Per month',
  annual: 'Per annum',
};

const COMP_ROW_LABELS: Record<string, string> = {
  training: 'Training period',
  probation: 'Probation period',
  confirmed: 'After probation',
};

export function CompensationTableView({ compensation }: { compensation: OfferCompensation }) {
  const currency = typeof compensation.currency === 'string' ? compensation.currency : 'INR';
  const rows = ['training', 'probation', 'confirmed']
    .map((key) => ({ key, slot: compensation[key] }))
    .filter(
      (r): r is { key: string; slot: { amount?: number | null; cadence?: string | null } } =>
        r.slot != null && typeof r.slot === 'object' && (r.slot as any).amount != null,
    );
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E7E7EA] text-left">
            <th className="py-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Component
            </th>
            <th className="py-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Amount
            </th>
            <th className="py-2 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Cadence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7E7EA]">
          {rows.map(({ key, slot }) => (
            <tr key={key}>
              <td className="py-2.5 pr-4 font-medium text-[#0a0a0a]">
                {COMP_ROW_LABELS[key] ?? key}
              </td>
              <td className="py-2.5 pr-4 text-[#0a0a0a]">
                {currencySymbol(currency)}
                {Number(slot.amount).toLocaleString()}
              </td>
              <td className="py-2.5 text-[#525252]">
                {slot.cadence ? (CADENCE_LABELS[slot.cadence] ?? slot.cadence) : 'Per month'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OfferLetterView({ offerId }: { offerId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useJobOffer(offerId);
  const { data: myOffers } = useMyJobOffers();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-2xl bg-[#f0f0f0]" />
        <div className="h-72 animate-pulse rounded-2xl bg-[#f0f0f0]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-10 text-center">
        <p className="text-sm font-medium text-[#0a0a0a]">Offer not found.</p>
        <button
          onClick={() => router.push('/talent/job-openings')}
          className="mt-3 text-xs font-medium text-[#0a0a0a] hover:underline"
        >
          Back to job openings
        </button>
      </div>
    );
  }

  const { offer, events } = data;
  const listItem = (myOffers ?? []).find((o) => o.id === offer.id);
  const badge = STATUS_BADGE[offer.status];
  const sections = offer.letter?.sections ?? [];
  const signatory = offer.letter?.signatory ?? null;

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#737373] transition-colors hover:text-[#0a0a0a]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold text-[#0a0a0a]">
              Offer — {offer.position_title}
            </h1>
            {listItem && (
              <p className="mt-0.5 text-sm text-[#737373]">
                {listItem.business_name} · {listItem.job_title}
              </p>
            )}
          </div>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 border-t border-[#E7E7EA] pt-3 sm:grid-cols-3">
          {offer.effective_date && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                Effective
              </dt>
              <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.effective_date)}</dd>
            </div>
          )}
          {offer.join_by_date && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                Join by
              </dt>
              <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.join_by_date)}</dd>
            </div>
          )}
          {offer.expires_on && (
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
                Offer valid till
              </dt>
              <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.expires_on)}</dd>
            </div>
          )}
        </dl>

        {offer.delivery_mode === 'manual_email' && (
          <p className="mt-3 rounded-xl bg-[#F5F5F6] px-3.5 py-2.5 text-xs text-[#525252]">
            The business sent the full offer letter to your email — this records your response on
            UpSquad.
          </p>
        )}
      </div>

      {/* Compensation */}
      <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          Compensation
        </h2>
        <CompensationTableView compensation={offer.compensation ?? {}} />
      </div>

      {/* Letter sections (frozen at send) */}
      {sections.length > 0 && (
        <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6">
          <div className="space-y-5">
            {sections.map((s) => (
              <section key={s.key}>
                {s.title && (
                  <h3 className="mb-1.5 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
                    {s.title}
                  </h3>
                )}
                <div
                  className="prose-sm text-sm leading-relaxed text-[#525252] [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2 [&_strong]:text-[#0a0a0a]"
                  dangerouslySetInnerHTML={{ __html: s.body_html ?? '' }}
                />
              </section>
            ))}
          </div>
          {signatory && (signatory.name || signatory.title) && (
            <p className="mt-6 border-t border-[#E7E7EA] pt-4 text-sm text-[#525252]">
              Warm regards,
              <br />
              <strong className="text-[#0a0a0a]">{signatory.name}</strong>
              {signatory.title ? (
                <>
                  <br />
                  {signatory.title}
                </>
              ) : null}
            </p>
          )}
        </div>
      )}

      <OfferResponseBar offer={offer} />

      <OfferThread offerId={offer.id} events={events} />
    </div>
  );
}
