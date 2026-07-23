'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import {
  useCreateOffers,
  useMarkOfferSentManually,
  useOfferTemplate,
  useSendOffer,
  useUpdateOffer,
  type BusinessOffer,
  type JobCandidateForBusiness,
  type OfferCompensationSchemaRow,
  type OfferTemplateSection,
} from '@/hooks/useBusinessJobs';
import type { OfferCompensation, OfferLetter } from '@/hooks/useJobOffers';
import { useUpload } from '@/hooks/useUpload';
import { currencySymbol } from '@/components/jobs/shared';

// Offer composer. The letter TEMPLATE is canonical on SquadHub — pulled here
// via the signed integration GET, then the business edits sections + package
// PER OFFER before send. The final render is frozen into job_offers.letter.

const CADENCE_OPTIONS = [
  { label: 'Per month', value: 'per_month' },
  { label: 'Per annum', value: 'per_annum' },
];

/** Client replica of the server's renderMergeFields — unknown tokens stay put. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMergeFields(
  text: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (token, key: string) => {
    const v = values[key];
    if (v === null || v === undefined || v === '') return token;
    return escapeHtml(String(v));
  });
}

interface CompRowState {
  amount: string;
  cadence: string;
}

function CompensationTable({
  schema,
  currency,
  rows,
  onChange,
}: {
  schema: OfferCompensationSchemaRow[];
  currency: string;
  rows: Record<string, CompRowState>;
  onChange: (key: string, next: CompRowState) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E7E7EA]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E7E7EA] bg-[#FAFAFA] text-left">
            <th className="px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Component
            </th>
            <th className="px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Amount ({currencySymbol(currency).trim() || currency})
            </th>
            <th className="px-3.5 py-2 text-[11px] font-medium uppercase tracking-wider text-[#a3a3a3]">
              Cadence
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7E7EA]">
          {schema.map((row) => {
            const state = rows[row.key] ?? { amount: '', cadence: row.cadence || 'per_month' };
            return (
              <tr key={row.key}>
                <td className="px-3.5 py-2 font-medium text-[#0a0a0a]">{row.component}</td>
                <td className="px-3.5 py-2">
                  <input
                    type="number"
                    min={0}
                    value={state.amount}
                    onChange={(e) => onChange(row.key, { ...state, amount: e.target.value })}
                    placeholder="—"
                    className="w-28 rounded-lg border border-[#E7E7EA] px-2.5 py-1.5 text-sm focus:border-[#0a0a0a] focus:outline-none"
                  />
                </td>
                <td className="px-3.5 py-2">
                  <select
                    value={state.cadence}
                    onChange={(e) => onChange(row.key, { ...state, cadence: e.target.value })}
                    className="rounded-lg border border-[#E7E7EA] px-2 py-1.5 text-sm focus:border-[#0a0a0a] focus:outline-none"
                  >
                    {CADENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LetterPreview({
  sections,
  mergeValues,
}: {
  sections: OfferTemplateSection[];
  mergeValues: Record<string, string | number | null | undefined>;
}) {
  return (
    <div className="max-h-80 space-y-4 overflow-y-auto rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] p-4">
      {sections.map((s) => (
        <section key={s.key}>
          {s.title && (
            <h4 className="mb-1 font-[family-name:var(--font-jakarta)] text-[13px] font-semibold text-[#0a0a0a]">
              {renderMergeFields(s.title, mergeValues)}
            </h4>
          )}
          <div
            className="text-xs leading-relaxed text-[#525252] [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-1.5 [&_strong]:text-[#0a0a0a]"
            dangerouslySetInnerHTML={{ __html: renderMergeFields(s.body_html ?? '', mergeValues) }}
          />
        </section>
      ))}
    </div>
  );
}

const DEFAULT_SCHEMA: OfferCompensationSchemaRow[] = [
  { key: 'training', component: 'Training Period', cadence: 'per_month' },
  { key: 'probation', component: 'Probation Period', cadence: 'per_month' },
  { key: 'confirmed', component: 'After Probation', cadence: 'per_month' },
];

export default function OfferComposer({
  cardId,
  candidates,
  preselected,
  editOffer,
  open,
  onClose,
}: {
  cardId: string;
  /** Offer-eligible pool — the selected-stage candidates. */
  candidates: JobCandidateForBusiness[];
  preselected?: string[];
  /** Existing DRAFT offer to edit + send (targeting is fixed to its candidate). */
  editOffer?: BusinessOffer | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: templatePull, isLoading: templateLoading, isError: templateError } = useOfferTemplate(
    cardId,
    { enabled: open },
  );
  const createOffers = useCreateOffers(cardId);
  const updateOffer = useUpdateOffer(cardId);
  const sendOffer = useSendOffer(cardId);
  const markSentManually = useMarkOfferSentManually(cardId);
  const { uploadFile, uploading: pdfUploading } = useUpload();

  const template = templatePull?.data?.template ?? null;
  const mergeContext = templatePull?.data?.merge_context ?? null;
  const schema = template?.compensation_schema?.length ? template.compensation_schema : DEFAULT_SCHEMA;

  // Targeting
  const [allSelected, setAllSelected] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(preselected ?? []));

  // Package
  const [positionTitle, setPositionTitle] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [joinByDate, setJoinByDate] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [compRows, setCompRows] = useState<Record<string, CompRowState>>({});

  // Letter
  const [sections, setSections] = useState<OfferTemplateSection[]>([]);
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [working, setWorking] = useState(false);

  // Offer mode: 'template' = the pulled letter sections; 'simple' = the package
  // + a free-text description + an optional attached PDF of the real letter.
  const [mode, setMode] = useState<'simple' | 'template'>('template');
  const [description, setDescription] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);

  const handlePdf = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Please attach a PDF file');
      e.target.value = '';
      return;
    }
    try {
      const url = await uploadFile(file, 'job-offers');
      setPdfUrl(url);
      setPdfName(file.name);
    } catch {
      toast.error('Failed to upload the PDF');
    } finally {
      e.target.value = '';
    }
  };

  // Seed the form once the template arrives (or from the draft being edited).
  useEffect(() => {
    if (!open || !template) return;
    setSections(template.sections ?? []);
    setSignatoryName(template.signatory?.name ?? '');
    setSignatoryTitle(template.signatory?.title ?? '');
    if (editOffer) {
      setPositionTitle(editOffer.position_title ?? '');
      setEffectiveDate(editOffer.effective_date ?? '');
      setJoinByDate(editOffer.join_by_date ?? '');
      setExpiresOn(editOffer.expires_on ?? '');
      const comp = (editOffer.compensation ?? {}) as OfferCompensation;
      setCurrency(typeof comp.currency === 'string' ? comp.currency : 'INR');
      const seeded: Record<string, CompRowState> = {};
      for (const row of schema) {
        const slot = comp[row.key] as { amount?: number | null; cadence?: string | null } | undefined;
        seeded[row.key] = {
          amount: slot?.amount != null ? String(slot.amount) : '',
          cadence: slot?.cadence ?? row.cadence ?? 'per_month',
        };
      }
      setCompRows(seeded);
    } else {
      setPositionTitle(mergeContext?.position ?? '');
      setJoinByDate(mergeContext?.join_by_date ?? '');
      setCurrency(mergeContext?.package_currency ?? 'INR');
      const seeded: Record<string, CompRowState> = {};
      for (const row of schema) {
        seeded[row.key] = {
          amount:
            row.key === 'confirmed' && mergeContext?.package_max != null
              ? String(mergeContext.package_max)
              : '',
          cadence: row.cadence ?? 'per_month',
        };
      }
      setCompRows(seeded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id, editOffer?.id]);

  const buildCompensation = (): OfferCompensation => {
    const comp: OfferCompensation = { currency };
    for (const row of schema) {
      const state = compRows[row.key];
      if (!state || state.amount.trim() === '') continue;
      const amount = Number(state.amount);
      if (!Number.isFinite(amount)) continue;
      comp[row.key] = { amount, cadence: state.cadence };
    }
    return comp;
  };

  const baseMergeValues = useMemo(
    () => ({
      position: positionTitle || mergeContext?.position || '',
      effective_date: effectiveDate,
      join_by_date: joinByDate,
      expiry_date: expiresOn,
      document_date: new Date().toISOString().slice(0, 10),
      business_name: mergeContext?.business_name ?? '',
      brand_name: mergeContext?.brand_name ?? '',
      working_days: mergeContext?.working_days ?? '',
      working_hours: mergeContext?.working_hours ?? '',
      signatory_name: signatoryName,
      signatory_title: signatoryTitle,
    }),
    [positionTitle, effectiveDate, joinByDate, expiresOn, mergeContext, signatoryName, signatoryTitle],
  );

  const buildLetter = (candidateName: string | null): OfferLetter => {
    if (mode === 'simple') {
      return {
        kind: 'simple',
        description: description.trim() || null,
        pdf_url: pdfUrl || null,
        merge_values: { compensation: buildCompensation() },
      };
    }
    const values = { ...baseMergeValues, candidate_name: candidateName ?? '' };
    return {
      kind: 'template',
      sections: sections.map((s) => ({
        key: s.key,
        title: renderMergeFields(s.title ?? '', values),
        body_html: renderMergeFields(s.body_html ?? '', values),
      })),
      merge_values: { ...values, compensation: buildCompensation() },
      signatory: { name: signatoryName || null, title: signatoryTitle || null },
    };
  };

  const packagePayload = () => ({
    ...(positionTitle.trim() ? { position_title: positionTitle.trim() } : {}),
    effective_date: effectiveDate || null,
    join_by_date: joinByDate || null,
    expires_on: expiresOn || null,
    compensation: buildCompensation(),
    ...(template?.id ? { squadhub_template_id: template.id } : {}),
  });

  const targetsValid = editOffer != null || allSelected || selected.size > 0;
  const nameById = new Map(candidates.map((c) => [c.id, c.talent_name] as const));

  /** Create the drafts, then per action: send (frozen letter) / mark-sent / leave drafts. */
  const run = async (action: 'send' | 'manual' | 'draft') => {
    if (!targetsValid) {
      toast.error('Pick at least one candidate');
      return;
    }
    setWorking(true);
    try {
      if (editOffer) {
        await updateOffer.mutateAsync({ offerId: editOffer.id, patch: packagePayload() });
        if (action === 'send') {
          await sendOffer.mutateAsync({
            offerId: editOffer.id,
            letter: buildLetter(editOffer.talent_name),
          });
          toast.success('Offer sent');
        } else if (action === 'manual') {
          await markSentManually.mutateAsync(editOffer.id);
        } else {
          toast.success('Draft saved');
        }
        onClose();
        return;
      }

      const result = await createOffers.mutateAsync({
        ...(allSelected ? { all_selected: true } : { candidate_ids: Array.from(selected) }),
        ...packagePayload(),
        delivery_mode: action === 'manual' ? 'manual_email' : 'platform',
      });

      if (result.skipped.length > 0) {
        toast.error(
          `${result.skipped.length} candidate${result.skipped.length === 1 ? ' already has' : 's already have'} a live offer — skipped`,
        );
      }

      if (action === 'send') {
        for (const offer of result.created) {
          await sendOffer.mutateAsync({
            offerId: offer.id,
            letter: buildLetter(offer.talent_name ?? nameById.get(offer.candidate_id) ?? null),
          });
        }
        if (result.created.length > 0) {
          toast.success(
            `Offer sent to ${result.created.length} candidate${result.created.length === 1 ? '' : 's'}`,
          );
        }
      } else if (action === 'manual') {
        for (const offer of result.created) {
          await markSentManually.mutateAsync(offer.id);
        }
      } else if (result.created.length > 0) {
        toast.success(
          `${result.created.length} draft offer${result.created.length === 1 ? '' : 's'} saved`,
        );
      }
      onClose();
    } catch {
      // The mutation hooks already toast their errors.
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editOffer ? 'Edit offer' : 'Compose offer'}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {templateLoading && <div className="h-24 animate-pulse rounded-xl bg-[#f0f0f0]" />}
        {templateError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
            Could not fetch the letter template — you can still set the package and send; the letter
            will carry the package details only.
          </p>
        )}

        {/* Offer type */}
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">Offer type</p>
          <div className="flex gap-1 rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] p-1">
            <button
              type="button"
              onClick={() => setMode('simple')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mode === 'simple'
                  ? 'bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              Simple offer
            </button>
            <button
              type="button"
              onClick={() => setMode('template')}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                mode === 'template'
                  ? 'bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                  : 'text-[#737373] hover:text-[#0a0a0a]'
              }`}
            >
              Detailed template
            </button>
          </div>
          <p className="mt-1 text-[11px] text-[#a3a3a3]">
            {mode === 'simple'
              ? 'Package + a short description, with an optional PDF of the real letter.'
              : 'The full templated offer letter with editable sections.'}
          </p>
        </div>

        {/* Targeting */}
        {!editOffer && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#3F3F46]">Send to</p>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#525252]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setAllSelected(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-[#D4D4D4] accent-[#0a0a0a]"
                />
                All selected candidates
              </label>
            </div>
            {!allSelected && (
              <ul className="max-h-36 divide-y divide-[#E7E7EA] overflow-y-auto rounded-xl border border-[#E7E7EA]">
                {candidates.length === 0 && (
                  <li className="px-4 py-3 text-sm text-[#737373]">No selected candidates yet.</li>
                )}
                {candidates.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-[#F5F5F6]">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id);
                            else next.add(c.id);
                            return next;
                          })
                        }
                        className="h-4 w-4 rounded border-[#D4D4D4] accent-[#0a0a0a]"
                      />
                      <span className="text-sm font-medium text-[#0a0a0a]">
                        {c.talent_name || 'Unknown talent'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {editOffer && (
          <p className="rounded-xl bg-[#F5F5F6] px-3.5 py-2.5 text-sm text-[#525252]">
            Editing the draft offer for{' '}
            <strong className="text-[#0a0a0a]">{editOffer.talent_name || 'this candidate'}</strong>.
          </p>
        )}

        {/* Package */}
        <Input
          label="Position title"
          value={positionTitle}
          onChange={(e) => setPositionTitle(e.target.value)}
          placeholder={mergeContext?.position ?? 'e.g. Graphic Designer'}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Effective date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          <Input label="Join by" type="date" value={joinByDate} onChange={(e) => setJoinByDate(e.target.value)} />
          <Input label="Offer expires on" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
        </div>

        {/* Compensation table */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[13px] font-medium text-[#3F3F46]">Compensation</p>
            <Select
              options={[
                { label: 'INR (₹)', value: 'INR' },
                { label: 'USD ($)', value: 'USD' },
                { label: 'AED', value: 'AED' },
              ]}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="!w-auto !py-1.5"
            />
          </div>
          <CompensationTable
            schema={schema}
            currency={currency}
            rows={compRows}
            onChange={(key, next) => setCompRows((prev) => ({ ...prev, [key]: next }))}
          />
        </div>

        {/* Simple mode: description + optional PDF of the real letter */}
        {mode === 'simple' && (
          <>
            <Textarea
              label="Description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Role summary, joining details, terms — anything the candidate should see with the offer."
              maxLength={8000}
            />
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">
                Offer letter PDF <span className="font-normal text-[#a3a3a3]">— optional</span>
              </p>
              {pdfUrl ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E7E7EA] px-3.5 py-2.5">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#0a0a0a]"
                  >
                    <svg className="h-4 w-4 shrink-0 text-[#DC2626]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="truncate">{pdfName ?? 'Attached PDF'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfUrl(null);
                      setPdfName(null);
                    }}
                    className="shrink-0 text-xs font-semibold text-[#DC2626] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#D4D4D4] px-3.5 py-3 text-sm font-medium text-[#525252] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a]">
                  <input type="file" accept="application/pdf" onChange={handlePdf} className="hidden" />
                  {pdfUploading ? 'Uploading…' : 'Attach a PDF'}
                </label>
              )}
            </div>
          </>
        )}

        {/* Letter sections — pulled from the SquadHub template, editable per offer */}
        {mode === 'template' && sections.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-[#3F3F46]">
              Letter sections{' '}
              <span className="font-normal text-[#a3a3a3]">
                — from &ldquo;{template?.name ?? 'template'}&rdquo;, editable for this offer
              </span>
            </p>
            <div className="divide-y divide-[#E7E7EA] rounded-xl border border-[#E7E7EA]">
              {sections.map((s, idx) => {
                const isOpen = openSection === s.key;
                return (
                  <div key={s.key}>
                    <button
                      type="button"
                      onClick={() => setOpenSection(isOpen ? null : s.key)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]"
                    >
                      {s.title || s.key}
                      <svg
                        className={`h-4 w-4 text-[#a3a3a3] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-t border-[#E7E7EA] bg-[#FAFAFA] p-3">
                        <Input
                          label="Section title"
                          value={s.title}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                            )
                          }
                        />
                        <Textarea
                          label="Body (HTML with {{merge_fields}})"
                          rows={5}
                          value={s.body_html}
                          onChange={(e) =>
                            setSections((prev) =>
                              prev.map((x, i) => (i === idx ? { ...x, body_html: e.target.value } : x)),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'template' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Signatory name" value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)} />
            <Input label="Signatory title" value={signatoryTitle} onChange={(e) => setSignatoryTitle(e.target.value)} />
          </div>
        )}

        {/* Preview */}
        {mode === 'template' && sections.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="mb-2 text-xs font-semibold text-[#0a0a0a] underline underline-offset-2"
            >
              {showPreview ? 'Hide letter preview' : 'Show letter preview'}
            </button>
            {showPreview && (
              <LetterPreview
                sections={sections}
                mergeValues={{ ...baseMergeValues, candidate_name: '{{candidate_name}}' }}
              />
            )}
          </div>
        )}
      </div>

      {/* Send bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E7E7EA] pt-4">
        <button
          type="button"
          disabled={working || !targetsValid}
          onClick={() => run('manual')}
          className="text-xs font-semibold text-[#737373] underline-offset-2 hover:underline disabled:opacity-40"
          title="You already sent the letter from your own email — just record it here."
        >
          Mark as sent via my email
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" disabled={working} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" loading={working} disabled={!targetsValid} onClick={() => run('draft')}>
            Save draft{!editOffer && (allSelected || selected.size > 1) ? 's' : ''}
          </Button>
          <Button size="sm" loading={working} disabled={!targetsValid} onClick={() => run('send')}>
            {editOffer ? 'Send offer' : allSelected ? 'Send to all selected' : `Send offer${selected.size > 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
