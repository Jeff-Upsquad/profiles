'use client';

import { useState } from 'react';
import api from '@/services/api';

export type Profile = { id: string; name?: string; title?: string; business_profile_id?: string; brand_profile_id?: string | null; status?: string; [key: string]: unknown };
export type Draft = Record<string, unknown>;
export type Bundle = { businesses: Profile[]; brands: Profile[]; jobs: Profile[]; locations: Profile[] };
export const emptyBundle: Bundle = { businesses: [], brands: [], jobs: [], locations: [] };
export const inputClass = 'mt-1.5 w-full rounded-xl border border-[#D9D5C7] bg-white px-3.5 py-2.5 text-sm font-normal text-[#222] outline-none focus:border-black focus:ring-2 focus:ring-[#FCF487]';
export const str = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
export const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : [];
export const numberOrNull = (value: unknown) => str(value).trim() ? Number(value) : null;
export const cleanList = (value: unknown) => list(value).map((v) => v.trim()).filter(Boolean);

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-[#525252]">{label}{required && <span className="ml-1 text-red-600">*</span>}{children}{hint && <span className="mt-1 block text-xs font-normal leading-relaxed text-[#7A7568]">{hint}</span>}</label>;
}
export function TextField({ label, value, onChange, required, type = 'text', maxLength = 200, hint }: {
  label: string; value: unknown; onChange: (value: string) => void; required?: boolean; type?: string; maxLength?: number; hint?: string;
}) {
  return <Field label={label} required={required} hint={hint}><input className={inputClass} value={str(value)} onChange={(e) => onChange(e.target.value)} type={type} required={required} maxLength={maxLength} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 1 : undefined} /></Field>;
}
export function TextArea({ label, value, onChange, maxLength = 8000, lines = false, required, hint }: {
  label: string; value: unknown; onChange: (value: unknown) => void; maxLength?: number; lines?: boolean; required?: boolean; hint?: string;
}) {
  return <Field label={label} required={required} hint={hint || (lines ? 'One item per line.' : undefined)}><textarea className={inputClass} rows={3} required={required} maxLength={maxLength} value={lines ? list(value).join('\n') : str(value)} onChange={(e) => onChange(lines ? e.target.value.split('\n') : e.target.value)} /></Field>;
}
export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <section className="space-y-4 rounded-2xl border border-[#E8E5DD] bg-white p-5 shadow-sm"><div><h3 className="text-lg font-semibold">{title}</h3>{hint && <p className="mt-1 text-xs leading-relaxed text-[#7A7568]">{hint}</p>}</div>{children}</section>;
}
export function ImageField({ label, value, onChange, preview }: { label: string; value: string; onChange: (value: string) => void; preview: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  return <div className="space-y-2"><TextField label={label} value={value} onChange={onChange} type="url" maxLength={1000} hint="Paste an image URL or upload an image." />
    <input aria-label={`Upload ${label.toLowerCase()}`} type="file" accept="image/*" disabled={uploading || preview} className="block w-full text-xs text-[#7A7568]" onChange={async (event) => {
      const file = event.target.files?.[0]; if (!file) return;
      setUploading(true); setError('');
      try {
        const { data } = await api.post('/upload/file', file, { headers: { 'Content-Type': file.type }, params: { fileName: file.name, folder: 'hiring-profiles' } });
        const url = data.url || data.fileUrl;
        if (typeof url !== 'string') throw new Error('No image URL returned.');
        onChange(url);
      } catch { setError('Could not upload the image. Please try again.'); }
      finally { setUploading(false); event.target.value = ''; }
    }} />{uploading && <p role="status" className="text-xs">Uploading…</p>}{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
export function SocialFields({ value, onChange }: { value: unknown; onChange: (value: Draft) => void }) {
  const socials = value && typeof value === 'object' ? value as Draft : {};
  return <div className="grid gap-4 sm:grid-cols-2">{['linkedin', 'instagram', 'facebook', 'x', 'youtube'].map((key) => <TextField key={key} label={`${key === 'x' ? 'X' : key[0].toUpperCase() + key.slice(1)} URL`} type="url" value={socials[key]} onChange={(url) => onChange({ ...socials, [key]: url })} maxLength={500} />)}</div>;
}
export function PhotoFields({ value, onChange, preview }: { value: unknown; onChange: (value: {url: string; caption: string}[]) => void; preview: boolean }) {
  const photos = Array.isArray(value) ? value as {url: string; caption: string}[] : [];
  return <div className="space-y-3"><p className="text-xs font-semibold text-[#525252]">Photos</p>{photos.map((photo, index) => <div key={index} className="space-y-3 rounded-xl border border-[#E8E5DD] p-3">
    <ImageField label={`Photo ${index + 1} URL`} value={photo.url} onChange={(url) => onChange(photos.map((p, i) => i === index ? { ...p, url } : p))} preview={preview} />
    <TextField label={`Photo ${index + 1} caption`} value={photo.caption} maxLength={300} onChange={(caption) => onChange(photos.map((p, i) => i === index ? { ...p, caption } : p))} />
    <button type="button" onClick={() => onChange(photos.filter((_, i) => i !== index))} className="text-xs text-red-700">Remove photo</button>
  </div>)}<button type="button" className="text-xs font-semibold underline" onClick={() => onChange([...photos, { url: '', caption: '' }])}>+ Add photo</button></div>;
}
export function cleanProfile(draft: Draft, kind: 'business' | 'brand' | 'job' | 'location') {
  const result = { ...draft }; delete result.id;
  const numberKeys = kind === 'business' ? ['founded_year'] : kind === 'job' ? ['min_experience_years', 'max_experience_years', 'salary_min', 'salary_max'] : ['latitude', 'longitude'];
  for (const key of numberKeys) if (key in result) result[key] = numberOrNull(result[key]);
  for (const key of ['perks', 'responsibilities', 'requirements', 'skills', 'benefits']) if (key in result) result[key] = cleanList(result[key]);
  if ('contact_email' in result && !str(result.contact_email).trim()) result.contact_email = null;
  if (result.preference_rules && typeof result.preference_rules === 'object') {
    result.preference_rules = Object.fromEntries(Object.entries(result.preference_rules as Draft).map(([key, value]) => [key, Array.isArray(value) ? cleanList(value) : value]));
  }
  if (Array.isArray(result.photos)) result.photos = (result.photos as Draft[]).filter((p) => str(p.url).trim());
  return result;
}
