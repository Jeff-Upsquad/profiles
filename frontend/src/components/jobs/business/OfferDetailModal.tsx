'use client';

import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import OfferLetterBody from '@/components/jobs/talent/OfferBodyView';
import { OFFER_STATUS_BADGE, fmtDate } from '@/components/jobs/shared';
import type { BusinessOffer } from '@/hooks/useBusinessJobs';

// Read-only full view of a sent offer for the business — header, dates, and the
// shared offer body (compensation + letter, simple or templated). The talent
// sees the same body on their offer page.

export default function OfferDetailModal({
  offer,
  open,
  onClose,
}: {
  offer: BusinessOffer | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!offer) return null;
  const badge = OFFER_STATUS_BADGE[offer.status] ?? { label: offer.status, variant: 'gray' as const };

  return (
    <Modal open={open} onClose={onClose} title={`Offer — ${offer.talent_name || 'candidate'}`}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div className="rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
                {offer.position_title}
              </h2>
              <p className="mt-0.5 text-sm text-[#737373]">{offer.talent_name || 'Candidate'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {offer.delivery_mode === 'manual_email' && <Badge variant="gray">Own email</Badge>}
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-[#E7E7EA] pt-3 sm:grid-cols-3">
            {offer.effective_date && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Effective</dt>
                <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.effective_date)}</dd>
              </div>
            )}
            {offer.join_by_date && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Join by</dt>
                <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.join_by_date)}</dd>
              </div>
            )}
            {offer.expires_on && (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">Valid till</dt>
                <dd className="text-sm text-[#0a0a0a]">{fmtDate(offer.expires_on)}</dd>
              </div>
            )}
          </dl>

          {offer.status === 'draft' && (
            <p className="mt-3 rounded-xl bg-[#F5F5F6] px-3.5 py-2.5 text-xs text-[#525252]">
              This offer is still a draft — the letter is frozen when you send it.
            </p>
          )}
        </div>

        <OfferLetterBody compensation={offer.compensation} letter={offer.letter} />
      </div>
    </Modal>
  );
}
