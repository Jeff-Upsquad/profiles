'use client';

import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import OfferResponseBar from './OfferResponseBar';
import OfferThread from './OfferThread';
import OfferLetterBody from './OfferBodyView';
import { useJobOffer, useMyJobOffers } from '@/hooks/useJobOffers';
import { OFFER_STATUS_BADGE, fmtDate } from '@/components/jobs/shared';

// Full offer view for the talent: header, the shared offer body (compensation +
// letter, whether simple or templated), response actions and the thread.

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
  const badge = OFFER_STATUS_BADGE[offer.status];

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

      <OfferLetterBody compensation={offer.compensation} letter={offer.letter} />

      <OfferResponseBar offer={offer} />

      <OfferThread offerId={offer.id} events={events} />
    </div>
  );
}
