'use client';

import { useState } from 'react';
import BusinessLinksDialog from '@/components/business/BusinessLinksDialog';
import type { BusinessLinks } from '../../../../../shared/src/businessLinks';
import CreatorAssignmentBrief, { Icon } from '@/components/subscriptions/CreatorAssignmentBrief';
import { matchCreatorRates } from '@/lib/creatorAssignmentRates';
import type { SubscriptionCardContentShape } from '@/hooks/useSubscriptionCards';

const content: SubscriptionCardContentShape = {
  card_type: 'assignment', brand_name: 'tag connect', subscription_name: 'Social Media Creators',
  deliverables_label: 'test', business_nature: 'Accounts', notes: 'Accounts management for other brands',
  target_languages: ['English'],
  additional_requirements: {
    channels: ['Instagram'], deliverables: ['Content formats: Any. Quantity: 1 × Brand promotion.'],
    usage_rights: ['Not specified'], service_count: ['Brand promotion × 1'],
    creator_levels: ['Below 5,000 (INR 500)', '5,000 to 10,000 (INR 1,000)'],
    creator_niches: ['Any'], creator_formats: ['Any'], reference_links: ['https://www.instagram.com/upsquad_connect/'],
    creator_audience: ['Creator niches: Any. Audience location: Anywhere. Desired age: Any.'],
    creator_services: ['Brand promotion'], audience_location: ['Anywhere'],
  },
};

export default function CreatorAssignmentPreview() {
  const [clientLinks, setClientLinks] = useState<BusinessLinks>({ instagram: 'https://www.instagram.com/upsquad_connect/' });
  const [linksOpen, setLinksOpen] = useState(false);
  const previewAccounts = [{ platform: 'Instagram', followers: 7800, profile_url: '@your.creator' }];
  const matchedRate = matchCreatorRates(['Instagram'], previewAccounts, content.additional_requirements?.creator_levels ?? [])[0];
  const [modal, setModal] = useState<'accept' | 'counter' | 'decline' | null>(null);
  const [result, setResult] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  return (
    <div className="min-h-screen bg-[#f6f6f8] font-[family-name:var(--font-inter)] text-[#26232c]">
      <BusinessLinksDialog open={linksOpen} initialLinks={{}} preview onClose={() => setLinksOpen(false)} onSaved={links => { setClientLinks(links); setLinksOpen(false); setResult('Preview: business links added. The creator requirement can now be submitted.'); }} />
      <header className="border-b border-[#e9e7ed] bg-white"><div className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-4 sm:px-8"><a href="/preview/creator-assignment" className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#17131d] text-xs font-bold text-white">SH<span className="text-[#c5b1e6]">.</span></span><span><span className="block font-[family-name:var(--font-jakarta)] text-lg font-bold tracking-[-0.04em]">SquadHire</span><span className="block text-[10px] text-[#aaa5ae]">Powered by UpSquad</span></span></a><span className="rounded-full border border-[#e8e4ed] bg-[#f9f8fb] px-3 py-1.5 text-[10px] font-medium text-[#8a8095]">Design preview</span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0ecf7] text-xs font-semibold text-[#79628f]">J</span></div></header>
      <main className="mx-auto max-w-[1080px] px-4 pb-32 pt-7 sm:px-8 sm:pt-10">
        <p className="mb-6 flex items-center gap-2 text-xs text-[#8b8593]"><span>Opportunities</span><span className="text-[#c8c3cf]">/</span><span className="text-[#4f475a]">Assignment details</span></p>
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#978aa7]">Made for your creativity</p><h1 className="font-[family-name:var(--font-jakarta)] text-2xl font-bold tracking-[-0.035em] sm:text-3xl">Your next collaboration.</h1><p className="mt-2 text-xs text-[#928a9c]">Get to know the brief, then make your move.</p></div><span className="rounded-full border border-[#eeddbb] bg-[#fff9ec] px-3 py-1.5 text-[10px] font-medium text-[#a17b33]">● Awaiting your response</span></div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <article className="overflow-hidden rounded-[22px] border border-[#e7e3ec] bg-white shadow-[0_4px_30px_-18px_rgba(50,25,75,0.16)]">
            <div className="flex items-center gap-3.5 border-b border-[#eeebf2] px-5 py-5 sm:px-7"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eee7f7] font-[family-name:var(--font-jakarta)] text-lg font-bold text-[#79618f]">tc<span className="text-[#a991be]">.</span></span><div><p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#a49bab]">Creator assignment</p><h2 className="mt-0.5 font-[family-name:var(--font-jakarta)] text-xl font-bold tracking-tight">tag connect</h2><p className="mt-0.5 text-[11px] text-[#96909f]">Social Media Creators · One-time collaboration</p></div></div>
            <div className="p-5 sm:p-7"><CreatorAssignmentBrief content={{ ...content, client_links: clientLinks }} previewAccounts={previewAccounts} /></div>
          </article>
          <aside className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-[20px] border border-[#e7e3ec] bg-white p-5"><div className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#93859f]"><Icon name="spark" /> The quick take</div><p className="font-[family-name:var(--font-jakarta)] text-xl font-bold tracking-tight">One brief.<br />Your creative voice.</p><dl className="mt-5 space-y-3 text-xs"><div className="flex justify-between gap-2"><dt className="text-[#97909f]">Deliverable</dt><dd className="font-medium">1 brand promotion</dd></div><div className="flex justify-between gap-2"><dt className="text-[#97909f]">Platform</dt><dd className="font-medium">Instagram</dd></div><div className="flex justify-between gap-2"><dt className="text-[#97909f]">Your Instagram rate</dt><dd className="font-medium">{matchedRate.rate || 'To be confirmed'}</dd></div><div className="flex justify-between gap-2"><dt className="text-[#97909f]">Deadline</dt><dd className="font-medium text-[#a0834e]">To be confirmed</dd></div></dl><p className="mt-4 border-t border-[#eeebf2] pt-3 text-[10px] leading-5 text-[#a09aa8]">Your rate is matched to your Instagram follower range.</p></div>
            <div className="rounded-[20px] bg-[#ede8f4] p-5"><span className="text-[#8d75a3]"><Icon name="info" /></span><h3 className="mt-3 text-xs font-semibold text-[#665276]">Good collaborations start with clarity.</h3><p className="mt-2 text-[11px] leading-5 text-[#9988a8]">Confirm the publishing date, usage rights, and payment terms with the client before accepting.</p></div>
            <button type="button" onClick={() => setLinksOpen(true)} className="w-full rounded-xl border border-dashed border-[#d8cce1] px-4 py-3 text-xs font-medium text-[#8a6c9e] hover:bg-[#eee6f5]">Preview missing-links popup</button>
            <p className="px-2 text-[10px] leading-5 text-[#aaa3b0]">Preview uses the assignment shown in your screenshot. Response actions are for demonstration.</p>
          </aside>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e7e3ec] bg-white/95 backdrop-blur-lg"><div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 px-4 py-4 sm:px-8"><div className="hidden sm:block"><p className="text-xs font-semibold">Interested in this collaboration?</p><p className="mt-1 text-[10px] text-[#a19aa9]">Review the brief and respond to tag connect.</p></div><div className="flex w-full items-center gap-2 sm:w-auto"><button onClick={() => setModal('decline')} className="rounded-xl px-3 py-3 text-xs font-medium text-[#8c8495] hover:bg-[#f6f4f8]">Decline</button><button onClick={() => setModal('counter')} className="flex-1 whitespace-nowrap rounded-xl border border-[#e2dce9] px-3 py-3 text-xs font-semibold hover:bg-[#f8f6fb] sm:flex-none">Counter-offer <span className="ml-1 text-[10px] font-normal text-[#a79bad]">3 left</span></button><button onClick={() => setModal('accept')} className="flex-1 whitespace-nowrap rounded-xl bg-[#251b30] px-5 py-3 text-xs font-semibold text-white hover:bg-[#493455] sm:flex-none">Accept offer <span className="ml-2">↗</span></button></div></div></div>
      {result && <div role="status" className="fixed left-1/2 top-5 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-xl border border-[#ded4e9] bg-white p-4 text-sm shadow-lg">{result}<button aria-label="Dismiss notification" className="float-right ml-3" onClick={() => setResult('')}>×</button></div>}
      {modal && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#211329]/35 p-4 backdrop-blur-sm" onClick={() => setModal(null)}><section role="dialog" aria-modal="true" aria-labelledby="response-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setModal(null); }}><div className="flex items-center justify-between"><h2 id="response-title" className="text-lg font-semibold">{modal === 'counter' ? 'Propose your rate' : modal === 'accept' ? 'Review before accepting' : 'Decline this assignment?'}</h2><button autoFocus aria-label="Close dialog" onClick={() => setModal(null)} className="rounded-lg px-3 py-2 text-xl">×</button></div><p className="mt-3 text-sm leading-6 text-[#8e8497]">{modal === 'accept' ? 'The publishing deadline and usage rights are still unspecified. Confirm these details and your applicable rate with the client.' : modal === 'counter' ? 'Share a rate and a message explaining your proposal.' : 'You can choose to pass on this collaboration.'}</p><form onSubmit={event => { event.preventDefault(); setResult(modal === 'counter' ? `Preview: your ₹${amount} counter-offer is ready. No response was sent.` : modal === 'accept' ? 'Preview: acceptance reviewed. No response was sent.' : 'Preview: assignment declined. No response was sent.'); setModal(null); }}>{modal === 'counter' && <div className="mt-4 space-y-3"><label className="block text-xs font-medium">Your proposed rate (INR)<input required type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} className="mt-1 w-full rounded-xl border border-[#dfd8e6] p-3 text-sm" placeholder="Enter amount" /></label><label className="block text-xs font-medium">Message to the client<textarea required value={message} onChange={event => setMessage(event.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-[#dfd8e6] p-3 text-sm" placeholder="Explain your rate or clarify the brief…" /></label></div>}<p className="mt-4 text-[10px] text-[#a69baa]">Design preview — no changes are saved.</p><button type="submit" className="mt-5 w-full rounded-xl bg-[#251b30] px-4 py-3 text-sm font-semibold text-white">{modal === 'counter' ? 'Preview counter-offer' : modal === 'accept' ? 'Preview acceptance' : 'Preview decline'}</button></form></section></div>}
    </div>
  );
}
