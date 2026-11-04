'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/services/api';
import { BUSINESS_LINK_FIELDS, businessProfileLinks, hasBusinessLink, normalizeBusinessLink, type BusinessLinks } from '../../../../shared/src/businessLinks';

export function BusinessLinkFields({ value, onChange }: { value: BusinessLinks; onChange: (links: BusinessLinks) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{BUSINESS_LINK_FIELDS.map(field => <label key={field.key} className="block text-xs font-medium text-[#6e6278]">{field.label}<input type="text" inputMode="url" autoComplete="url" maxLength={500} value={value[field.key] || ''} onChange={event => onChange({ ...value, [field.key]: event.target.value })} placeholder={field.key === 'website' ? 'https://yourbrand.com' : `https://${field.key === 'other' ? 'social-platform' : field.key}.com/yourbrand`} className="mt-1.5 w-full rounded-xl border border-[#e1d9e8] bg-white px-3 py-2.5 text-sm font-normal text-[#352b3e] outline-none focus:border-[#8b6ba6] focus:ring-2 focus:ring-[#eee7f5]" /></label>)}</div>;
}

export default function BusinessLinksDialog({ open, initialLinks, preview = false, onClose, onSaved }: {
  open: boolean; initialLinks: BusinessLinks; preview?: boolean; onClose: () => void; onSaved: (links: BusinessLinks) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [links, setLinks] = useState<BusinessLinks>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) { setLinks(initialLinks); setError(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open, initialLinks]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const invalid = BUSINESS_LINK_FIELDS.find(field => links[field.key]?.trim() && !normalizeBusinessLink(links[field.key]));
    if (invalid) { setError(`Enter a valid ${invalid.label} URL, for example https://example.com/yourbrand.`); return; }
    const normalized = Object.fromEntries(Object.entries(links).flatMap(([key, value]) => { const url = normalizeBusinessLink(value); return url ? [[key, url]] : []; })) as BusinessLinks;
    if (!hasBusinessLink(normalized)) { setError('Add at least one website or social media link to continue.'); return; }
    setError(''); setSaving(true);
    try {
      if (!preview) {
        const { website, ...social_links } = normalized;
        const { data } = await api.put('/business/me', { ...(website ? { company_website: website } : {}), social_links });
        const saved = businessProfileLinks(data.business ?? data);
        if (!hasBusinessLink(saved)) throw new Error('Your link could not be saved. Please try again.');
        onSaved(saved);
      } else onSaved(normalized);
    } catch (caught) {
      setError((caught as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error || 'Your links could not be saved. Please try again.');
    } finally { setSaving(false); }
  }
  return <dialog aria-label="Add business website and social links" ref={dialog} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} className="m-auto w-[calc(100%-32px)] max-w-xl rounded-2xl border border-[#e5ddec] bg-white p-0 shadow-2xl backdrop:bg-[#211329]/40">
    <form onSubmit={save} className="max-h-[85dvh] overflow-auto p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-[#9983aa]">Business profile</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-[#35273f]">Help creators get to know your brand</h2></div><button type="button" disabled={saving} onClick={onClose} aria-label="Close link popup" className="px-2 text-2xl text-[#9b8ca7]">×</button></div>
      <p className="mb-5 mt-3 text-sm leading-6 text-[#918499]">Add your website or a social media page. At least one link is required before submitting a creator requirement, and will appear in “About the client.”</p>
      <BusinessLinkFields value={links} onChange={setLinks} />
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <p className="mt-4 text-xs text-[#a095a8]">{preview ? 'Preview only — links won’t be saved to your account.' : 'These links are saved to your business profile for future requirements.'}</p>
      <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-[#e2dbe8] px-4 py-3 text-sm font-medium text-[#8a7b94]">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-[#302039] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save & continue'}</button></div>
    </form>
  </dialog>;
}
