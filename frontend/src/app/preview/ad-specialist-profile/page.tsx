'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdSpecialistPreviewShell from '@/components/preview/AdSpecialistPreviewShell';

const services = ['Paid media strategy', 'Campaign setup', 'Creative testing', 'Landing-page CRO', 'Attribution', 'Reporting'];
const tools = ['Meta Ads', 'Google Ads', 'GA4', 'Google Tag Manager', 'Looker Studio'];

export default function AdSpecialistProfilePreview() {
  const [selectedServices, setSelectedServices] = useState(services);
  const [saved, setSaved] = useState(false);
  const toggleService = (service: string) => setSelectedServices((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service]);

  return (
    <AdSpecialistPreviewShell active="profile">
      <div className="space-y-5">
        <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6">
          <div className="hero-glow-blur" />
          <div className="hero-content flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex items-center rounded-full bg-[#FFFAC2] px-3 py-1 text-xs font-semibold text-[#0a0a0a]">Talent portal · New job profile</span>
              <h1 className="mt-3 font-[family-name:var(--font-jakarta)] text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-[#0a0a0a] sm:text-[30px]">Build your Ads Specialist profile</h1>
              <p className="mt-1.5 max-w-2xl text-sm text-[#525252]">Show businesses what you manage, the outcomes you drive, and how you prefer to work.</p>
            </div>
            <Link href="/preview/ad-specialist-requirements" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#0a0a0a] underline underline-offset-4"><BackIcon /> Business requirement builder</Link>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
            <BuilderSection number="01" title="Profile basics" description="Position yourself clearly for the work you want.">
              <Field label="Profile category" required>
                <div className="flex items-center justify-between rounded-xl border border-[#0a0a0a] bg-[#FFFEF0] px-3.5 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFFAC2]"><MegaphoneIcon /></span><div><p className="text-sm font-semibold text-[#0a0a0a]">Ads Specialist</p><p className="text-[11px] text-[#737373]">Performance marketing & paid acquisition</p></div></div><button type="button" className="text-xs font-semibold underline underline-offset-2">Change</button></div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Professional title" required><input className="preview-input" defaultValue="Performance Marketing & Paid Ads Specialist" /></Field>
                <Field label="Relevant experience" required><div className="grid grid-cols-2 gap-2"><select className="preview-input" defaultValue="5 years"><option>4 years</option><option>5 years</option><option>6 years</option></select><select className="preview-input" defaultValue="8 months"><option>0 months</option><option>8 months</option><option>11 months</option></select></div></Field>
              </div>
              <Field label="Professional summary" required helper="Explain your commercial value in plain language."><textarea className="preview-input min-h-28 resize-y" defaultValue="I help growth-stage companies turn paid media into a predictable acquisition channel. I work across strategy, tracking, campaign execution, creative testing, and reporting, with decisions tied to qualified leads, CAC, and revenue." /></Field>
            </BuilderSection>

            <BuilderSection number="02" title="Services and expertise" description="Choose the work businesses can hire you to own.">
              <Field label="Services offered" required><div className="flex flex-wrap gap-2">{services.map((service) => { const selected = selectedServices.includes(service); return <button key={service} type="button" aria-pressed={selected} onClick={() => toggleService(service)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${selected ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white' : 'border-[#E7E7EA] text-[#525252]'}`}>{selected && <span className="mr-1">✓</span>}{service}</button>; })}</div></Field>
              <Field label="Platforms and tools" required><div className="grid gap-2 sm:grid-cols-2">{tools.map((tool, index) => <div key={tool} className="flex items-center justify-between rounded-xl bg-[#F5F5F6] px-3.5 py-3"><span className="text-xs font-semibold text-[#0a0a0a]">{tool}</span><select className="bg-transparent text-[11px] font-medium text-[#737373] outline-none" defaultValue={index < 3 ? 'Expert' : 'Advanced'}><option>Intermediate</option><option>Advanced</option><option>Expert</option></select></div>)}</div></Field>
              <Field label="Industry experience"><input className="preview-input" defaultValue="EdTech, D2C Ecommerce, SaaS, Professional Services" /></Field>
            </BuilderSection>

            <BuilderSection number="03" title="Proof of work" description="Add outcome-led examples that make your expertise credible.">
              <CaseStudyEditor number="Case study 1" title="Scaled qualified demos without increasing CAC" result="2.4× lead volume · CAC down 24%" />
              <CaseStudyEditor number="Case study 2" title="Found a profitable scale path in eight weeks" result="4.6× ROAS · Revenue up 68%" />
              <button type="button" className="w-full rounded-xl border border-dashed border-[#a3a3a3] px-4 py-3 text-xs font-semibold text-[#525252] hover:bg-[#F5F5F6]">+ Add another case study</button>
            </BuilderSection>

            <BuilderSection number="04" title="Availability and pricing" description="Set clear expectations before a business shortlists you.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Subscription capacity" required><select className="preview-input" defaultValue="80 hours / month"><option>40 hours / month</option><option>80 hours / month</option><option>120 hours / month</option></select></Field>
                <Field label="Monthly rate" required><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#737373]">₹</span><input className="preview-input pl-7" defaultValue="85,000" /></div></Field>
                <Field label="Assignment rate"><div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#737373]">₹</span><input className="preview-input pl-7" defaultValue="60,000 onwards" /></div></Field>
                <Field label="Available from" required><input type="date" className="preview-input" defaultValue="2026-09-14" /></Field>
                <Field label="Location"><input className="preview-input" defaultValue="Bengaluru, Karnataka" /></Field>
                <Field label="Work mode"><select className="preview-input" defaultValue="Remote"><option>Remote</option><option>Hybrid</option><option>On-site</option></select></Field>
              </div>
              <Field label="Languages"><input className="preview-input" defaultValue="English · Native, Hindi · Professional, Kannada · Native" /></Field>
            </BuilderSection>

            <div className="flex flex-col-reverse gap-3 rounded-2xl border border-[#E7E7EA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="rounded-xl border border-[#E7E7EA] px-4 py-2.5 text-sm font-semibold text-[#525252]">Save draft</button><button type="submit" className="rounded-xl bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white">Save & submit for review</button></div>
            {saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">Preview complete — this Ads Specialist profile is ready for review.</p>}
          </form>

          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white"><div className="tint-purple h-20" /><div className="relative p-5 pt-10"><div className="absolute -top-7 left-5 flex h-14 w-14 items-center justify-center rounded-xl border-4 border-white bg-[#0a0a0a] text-sm font-bold text-[#FFFAC2]">AR</div><span className="absolute right-5 top-3 rounded-full bg-[#FFFBEB] px-2.5 py-1 text-[10px] font-semibold text-[#B45309]">Draft</span><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#737373]">Ads Specialist · Pro</p><h2 className="mt-1 font-[family-name:var(--font-jakarta)] text-lg font-semibold leading-snug tracking-[-0.02em] text-[#0a0a0a]">Performance Marketing & Paid Ads Specialist</h2><p className="mt-2 text-xs leading-relaxed text-[#737373]">5y 8m experience · Bengaluru · Remote</p><div className="mt-4 flex flex-wrap gap-1.5"><span className="rounded-full bg-[#FFFAC2] px-2.5 py-1 text-[10px] font-semibold">Subscription</span><span className="rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[10px] font-semibold text-[#2455A4]">Assignment</span></div></div></div>
            <div className="rounded-2xl border border-[#E7E7EA] bg-white p-5"><div className="flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a3a3a3]">Profile strength</p><p className="text-sm font-semibold text-[#0a0a0a]">88%</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1F1F3]"><div className="h-full w-[88%] rounded-full bg-[#0a0a0a]" /></div><ul className="mt-4 space-y-2 text-xs text-[#525252]"><li className="flex gap-2"><CheckIcon /> Strong positioning</li><li className="flex gap-2"><CheckIcon /> Outcome-led work samples</li><li className="flex gap-2"><CheckIcon /> Pricing and availability added</li></ul></div>
            <div className="rounded-2xl bg-[#0a0a0a] p-5 text-white"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Matching preview</p><p className="mt-2 text-sm font-semibold">Strong fit for 2 open requirements</p><p className="mt-1.5 text-xs leading-relaxed text-white/65">Your channel mix, rate, experience, and availability match the sample Northstar briefs.</p></div>
          </aside>
        </div>
      </div>
    </AdSpecialistPreviewShell>
  );
}

function BuilderSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-6"><div className="mb-5 flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FFFAC2] text-[11px] font-bold">{number}</span><div><h2 className="font-[family-name:var(--font-jakarta)] text-lg font-semibold tracking-[-0.02em] text-[#0a0a0a]">{title}</h2><p className="mt-0.5 text-xs text-[#737373]">{description}</p></div></div><div className="space-y-4">{children}</div></section>; }
function Field({ label, helper, required, children }: { label: string; helper?: string; required?: boolean; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#0a0a0a]">{label}{required && <span className="ml-0.5 text-red-500">*</span>}</span>{children}{helper && <span className="mt-1.5 block text-[11px] text-[#a3a3a3]">{helper}</span>}</label>; }
function CaseStudyEditor({ number, title, result }: { number: string; title: string; result: string }) { return <div className="rounded-xl border border-[#E7E7EA] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">{number}</p><button type="button" className="text-[11px] font-medium text-red-600">Remove</button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Project title"><input className="preview-input" defaultValue={title} /></Field><Field label="Headline result"><input className="preview-input" defaultValue={result} /></Field></div><Field label="What you did"><textarea className="preview-input mt-3 min-h-20 resize-y" defaultValue="Rebuilt the account structure, improved conversion tracking, introduced intent-based creative lanes, and aligned reporting with qualified revenue." /></Field></div>; }
function MegaphoneIcon() { return <svg className="h-5 w-5 text-[#0a0a0a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L5 9H3v6h2l6 4V5zm0 4c4.5 0 7-2 9-4v14c-2-2-4.5-4-9-4M5 15l1.5 5h3L8 16" /></svg>; }
function CheckIcon() { return <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FFFAC2]"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>; }
function BackIcon() { return <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>; }
