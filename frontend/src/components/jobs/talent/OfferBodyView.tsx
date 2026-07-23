'use client';

import { currencySymbol } from '@/components/jobs/shared';
import type { OfferCompensation, OfferLetter } from '@/hooks/useJobOffers';

// Shared, read-only render of an offer's body — the compensation table plus the
// letter itself. Two letter shapes:
//   - simple:   a free-text description + an optional "Download offer PDF" link
//   - template: the frozen letter sections + signatory
// Reused by the talent offer letter view and the business offer-detail modal so
// both surfaces render an offer identically.

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
              <td className="py-2.5 pr-4 font-medium text-[#0a0a0a]">{COMP_ROW_LABELS[key] ?? key}</td>
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

function card(children: React.ReactNode) {
  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {children}
    </div>
  );
}

export default function OfferLetterBody({
  compensation,
  letter,
}: {
  compensation: OfferCompensation | null | undefined;
  letter: OfferLetter | null | undefined;
}) {
  const comp = compensation ?? {};
  const isSimple = letter?.kind === 'simple';
  const sections = letter?.sections ?? [];
  const signatory = letter?.signatory ?? null;
  const description = typeof letter?.description === 'string' ? letter.description : '';
  const pdfUrl = typeof letter?.pdf_url === 'string' ? letter.pdf_url : null;

  return (
    <div className="space-y-4">
      {/* Compensation */}
      {card(
        <>
          <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
            Compensation
          </h2>
          <CompensationTableView compensation={comp} />
        </>,
      )}

      {/* Simple offer: description + optional PDF */}
      {isSimple && (description || pdfUrl) &&
        card(
          <div className="space-y-4">
            {description && (
              <div>
                <h2 className="mb-2 font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
                  Offer details
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#525252]">
                  {description}
                </p>
              </div>
            )}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#E7E7EA] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] transition-colors hover:bg-[#F5F5F6]"
              >
                <svg className="h-4 w-4 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download offer letter (PDF)
              </a>
            )}
          </div>,
        )}

      {/* Template offer: frozen letter sections + signatory */}
      {!isSimple && sections.length > 0 &&
        card(
          <>
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
          </>,
        )}
    </div>
  );
}
