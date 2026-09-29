'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import ContentBlocks, { blockLanguages, type ContentBlock } from '@/components/training/ContentBlocks';
import {
  flattenAgencyPages, useAgencyTraining, useCompleteAgencyPage,
  useAgencyWebinars, useAgencyWebinarAction, useAgencyWebinarLanguages,
  useAgencyWebinarInterests, useAgencyWebinarInterestAction,
  useAgencyTrainingNotifications,
} from '@/hooks/useAgencyTraining';
import type { TalentItem, TalentPage } from '@/hooks/useTraining';

const MIN_WATCH_SECONDS = 60;

function AgencyPage({ page }: { page: TalentPage }) {
  const complete = useCompleteAgencyPage();
  const [seconds, setSeconds] = useState(MIN_WATCH_SECONDS);
  const [language, setLanguage] = useState('en');
  const videos = page.blocks.some((b) => b.type === 'video_embed' || b.type === 'video_upload');
  const languages = [...new Set(page.blocks.flatMap((b) => blockLanguages([b as ContentBlock])))];
  useEffect(() => { setSeconds(MIN_WATCH_SECONDS); }, [page.id]);
  useEffect(() => {
    if (!videos || page.completed || !page.unlocked || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [videos, page.completed, page.unlocked, seconds]);
  if (!page.unlocked) return <p className="rounded-xl border border-[#E7E7EA] bg-white p-6 text-sm text-[#737373]">Complete the previous section to open this page.</p>;
  return (
    <section className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="text-xl font-semibold text-[#0a0a0a]">{page.title}</h3>{page.summary && <p className="mt-1 text-sm text-[#737373]">{page.summary}</p>}</div>
        {languages.length > 1 && <label className="text-xs text-[#525252]">Video language <select aria-label="Video language" value={language} onChange={(e) => setLanguage(e.target.value)} className="ml-2 rounded-lg border px-2 py-1.5">{languages.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>}
      </div>
      <ContentBlocks blocks={page.blocks as ContentBlock[]} language={language} quizPath="/agency/training/blocks" />
      {page.completable && <div className="mt-7 border-t border-[#E7E7EA] pt-5">
        {page.completed ? <span className="text-sm font-semibold text-emerald-700">✓ Completed</span> :
          <button type="button" disabled={complete.isPending || (videos && seconds > 0)} onClick={async () => {
            try { await complete.mutateAsync(page.id); toast.success('Page completed'); }
            catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not complete page'); }
          }} className="rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
            {videos && seconds > 0 ? `Watch first (${seconds}s)` : complete.isPending ? 'Saving…' : 'Mark complete'}
          </button>}
      </div>}
      {page.children.length > 0 && <p className="mt-4 text-xs text-[#737373]">Continue with the pages in the list to complete this section.</p>}
    </section>
  );
}

function AgencyCourse({ item }: { item: TalentItem }) {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);
  const pages = flattenAgencyPages(item.pages);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pages.find((p) => p.id === selectedId) ?? pages.find((p) => p.unlocked && p.completable) ?? pages[0];
  return <section className="rounded-2xl border border-[#E7E7EA] bg-[#F8F8F9] p-4 sm:p-6">
    <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-wider text-[#737373]">{item.is_onboarding ? 'Required onboarding' : 'Training resource'}</p>
      <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
      {item.summary && <p className="mt-1 text-sm text-[#525252]">{item.summary}</p>}
      <p className="mt-2 text-xs text-[#737373]">{item.completed_count}/{item.total_count} pages complete</p>
      {item.countdown_enabled && !item.started_at && <button type="button" disabled={starting} onClick={async () => {
        setStarting(true);
        try { await api.post(`/agency/training/courses/${item.id}/start`); await qc.invalidateQueries({ queryKey: ['agencyTraining'] }); toast.success('Training started'); }
        catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not start training'); }
        finally { setStarting(false); }
      }} className="mt-3 rounded-lg bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{starting ? 'Starting…' : 'Start training'}</button>}
      {item.expired && <p className="mt-2 text-sm font-semibold text-red-700">The course deadline has passed. Contact support to reopen it.</p>}
      {item.expires_at && !item.expired && <p className="mt-1 text-xs text-[#737373]">Complete by {new Date(item.expires_at).toLocaleString()}</p>}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E7E7EA]"><div className="h-full bg-[#0a0a0a]" style={{ width: `${item.total_count ? item.completed_count / item.total_count * 100 : 0}%` }} /></div>
    </div>
    {pages.length ? <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <nav aria-label={`${item.title} pages`} className="space-y-1 rounded-xl border border-[#E7E7EA] bg-white p-2">
        {pages.map((page) => <button key={page.id} type="button" disabled={!page.unlocked} onClick={() => setSelectedId(page.id)} className={`block w-full rounded-lg px-3 py-2 text-left text-sm disabled:opacity-45 ${selected?.id === page.id ? 'bg-[#FFFAC2] font-semibold' : 'hover:bg-[#F5F5F6]'}`} style={{ paddingLeft: `${12 + page.depth * 12}px` }}>
          <span className="mr-1.5">{page.completed ? '✓' : page.unlocked ? '○' : '🔒'}</span>{page.title}
        </button>)}
      </nav>
      {selected && <AgencyPage key={`${item.id}:${selected.id}`} page={selected} />}
    </div> : <p className="rounded-xl bg-white p-6 text-sm text-[#737373]">The content for this program is being prepared. Check back soon.</p>}
  </section>;
}

function AgencyWebinars() {
  const { data: webinars = [], isLoading } = useAgencyWebinars();
  const action = useAgencyWebinarAction();
  const { data: languages = [] } = useAgencyWebinarLanguages();
  const { data: interests = [] } = useAgencyWebinarInterests();
  const interestAction = useAgencyWebinarInterestAction();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  return <section className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-6">
    <h2 className="text-lg font-semibold">Upcoming webinars</h2>
    {isLoading ? <p className="mt-3 text-sm text-[#737373]">Loading webinars…</p> : webinars.length ?
      <div className="mt-4 space-y-3">{webinars.map((w) => {
        const joinable = w.registered && now >= new Date(w.starts_at).getTime() - 15 * 60_000;
        return <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E7E7EA] p-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFFAC2]">🎥</span>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{w.title}</p><p className="text-xs text-[#737373]">{new Date(w.starts_at).toLocaleString()} · {languages.find((l) => l.code === w.language)?.label ?? w.language}{w.registered ? ' · Registered ✓' : ''}</p></div>
          {joinable && <a href={w.meeting_link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#0a0a0a] px-3 py-2 text-xs font-semibold text-white">Join</a>}
          <button type="button" disabled={action.isPending} onClick={async () => {
            try { await action.mutateAsync({ id: w.id, registered: w.registered }); toast.success(w.registered ? 'Unregistered' : "You're registered — reminders will arrive on the day, 30 and 5 minutes before."); }
            catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not update registration'); }
          }} className="rounded-lg border border-[#E7E7EA] px-3 py-2 text-xs font-semibold disabled:opacity-40">{w.registered ? 'Unregister' : 'Register'}</button>
        </div>;
      })}</div> : <p className="mt-3 text-sm text-[#737373]">No upcoming agency webinars. Choose a language below to hear when one is scheduled.</p>}
    <div className="mt-5 border-t border-[#E7E7EA] pt-4"><p className="text-sm font-semibold">Notify me about future webinars</p>
      <div className="mt-2 flex flex-wrap gap-2">{languages.map((l) => {
        const subscribed = interests.includes(l.code);
        return <button key={l.code} type="button" disabled={interestAction.isPending} onClick={async () => {
          try { await interestAction.mutateAsync({ language: l.code, subscribed }); toast.success(subscribed ? 'Notifications muted' : `We'll notify you about ${l.label} webinars`); }
          catch (error: any) { toast.error(error?.response?.data?.message ?? 'Could not update preference'); }
        }} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${subscribed ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-[#E7E7EA]'}`}>{subscribed ? '🔔 ' : ''}{l.label}</button>;
      })}</div>
    </div>
  </section>;
}

function AgencyTrainingNotices() {
  const { data: notices = [] } = useAgencyTrainingNotifications();
  if (!notices.length) return null;
  return <section className="rounded-2xl border border-[#E7E7EA] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Webinar updates</h2>
    <ul className="mt-3 space-y-2">{notices.slice(0, 5).map((n) => <li key={n.id} className="rounded-lg bg-[#F8F8F9] p-3"><p className="text-sm font-semibold">{n.title}</p><p className="mt-1 text-xs text-[#525252]">{n.body}</p></li>)}</ul>
  </section>;
}

export default function AgencyTraining() {
  const { data, isLoading, isError } = useAgencyTraining();
  return <div className="space-y-6">
    <section className="hero-container hero-glow-purple relative overflow-hidden rounded-2xl border border-[#E7E7EA] bg-white px-5 py-5 sm:px-7 sm:py-6"><div className="hero-content">
      <div className="mb-2"><span className="eyebrow-rainbow">Training Program</span></div>
      <h1 className="font-[family-name:var(--font-jakarta)] text-[24px] font-semibold tracking-[-0.025em] sm:text-[28px]">Training <span className="text-rainbow">Program</span></h1>
      <p className="mt-1.5 text-sm text-[#525252]">Complete agency onboarding to unlock your modules and respond to offers.</p>
    </div></section>
    {isLoading && <p className="rounded-xl bg-white p-6 text-sm text-[#737373]">Loading your training…</p>}
    {isError && <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load your training. Please try again.</p>}
    {data && <>
      <div className={`rounded-xl border p-4 text-sm ${data.status.completed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#E7E7EA] bg-[#FFFAC2]/60 text-[#0a0a0a]'}`}>
        {data.status.completed ? 'Training complete. Your agency modules are unlocked.' : 'Finish every required page to unlock agency modules. Subscriptions and assignments are view only until then; client names are hidden.'}
      </div>
      {data.items.length ? data.items.map((item) => <AgencyCourse key={item.id} item={item} />) : <div className="rounded-xl border border-[#E7E7EA] bg-white p-8 text-center text-sm text-[#737373]">Agency training content is being prepared.</div>}
    </>}
    <AgencyWebinars />
    <AgencyTrainingNotices />
  </div>;
}
