'use client';
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import type { CardRecipientForBusiness } from '@/hooks/useBusiness';
import type { BusinessAssignmentOffer } from '@/hooks/useBusinessAssignmentOffers';
import type { GroupMeet, GroupMeetMember } from '../../../../shared/src/types/group-meet';
import { formatGroupMeetDate, formatGroupMeetTimeRange } from '../../../../shared/src/groupMeetWhen';
import {
  useCancelGroupMeet,
  useGroupMeet,
  useRescheduleGroupMeet,
  useScheduleGroupMeet,
  useSendGroupMeetMessage,
  type GroupMeetScheduleInput,
} from '@/hooks/useGroupMeet';
import BidActions from '@/components/subscriptions/BidActions';
import type { WorkPricingUnit } from '@/lib/assignmentPricing';

export default function GroupMeetPanel({
  cardId,
  cardTitle,
  candidates,
  offerByRecipientId,
  currency,
  period = 'per_month',
  quantity,
  unit,
  disabled,
  previewMeeting,
  onPreviewMeetingChange,
}: {
  cardId: string;
  cardTitle: string;
  candidates: CardRecipientForBusiness[];
  offerByRecipientId?: Map<string, BusinessAssignmentOffer>;
  currency?: string | null;
  period?: any;
  quantity?: number | null;
  unit?: WorkPricingUnit | null;
  disabled?: boolean;
  previewMeeting?: GroupMeet | null;
  onPreviewMeetingChange?: (meeting: GroupMeet | null) => void;
}) {
  const preview = onPreviewMeetingChange != null;
  const query = useGroupMeet(cardId, !preview);
  const schedule = useScheduleGroupMeet(cardId);
  const reschedule = useRescheduleGroupMeet(cardId);
  const cancel = useCancelGroupMeet(cardId);
  const send = useSendGroupMeetMessage(cardId);
  const [modal, setModal] = useState<'schedule' | 'reschedule' | null>(null);
  const [tab, setTab] = useState<'people' | 'chat'>('people');
  const [draft, setDraft] = useState('');
  const meeting = preview ? previewMeeting ?? null : query.data ?? null;
  const act = (input: GroupMeetScheduleInput) => {
    if (preview) {
      const base = meeting ?? buildPreviewMeeting(cardId, cardTitle, candidates, input);
      const next: GroupMeet = meeting
        ? {
            ...base,
            ...input,
            status: 'rescheduled',
            revision: base.revision + 1,
            members: base.members.map((m) => m.participant_type === 'talent' ? { ...m, rsvp: 'invited', rsvp_at: null, joined_at: null } : m),
            accepted_count: 0,
            declined_count: 0,
            messages: [...base.messages, demoMessage('system', 'Group Meet', 'Meera rescheduled the meeting. Everyone has been asked to confirm the new time.')],
          }
        : base;
      onPreviewMeetingChange(next);
      setModal(null);
      return;
    }
    const mutation = meeting ? reschedule : schedule;
    if (meeting) reschedule.mutate({ meetingId: meeting.id, input }, { onSuccess: () => setModal(null) });
    else schedule.mutate(input, { onSuccess: () => setModal(null) });
  };

  const cancelMeeting = () => {
    if (!meeting || !window.confirm('Cancel this Group Meet for everyone?')) return;
    if (preview) {
      onPreviewMeetingChange({ ...meeting, status: 'cancelled', messages: [...meeting.messages, demoMessage('system', 'Group Meet', 'Meera cancelled the meeting.')] });
    } else cancel.mutate(meeting.id);
  };

  const sendMessage = () => {
    const body = draft.trim();
    if (!body || !meeting) return;
    if (preview) {
      onPreviewMeetingChange({ ...meeting, messages: [...meeting.messages, demoMessage('business', 'Meera Kapoor', body)] });
    } else send.mutate({ meetingId: meeting.id, body });
    setDraft('');
  };

  if (!meeting || meeting.status === 'cancelled') {
    return (
      <section className="overflow-hidden rounded-2xl border border-[#F2F26B] bg-[linear-gradient(135deg,#FFFEE0_0%,#FFFFFF_58%,#FAFAFA_100%)] shadow-[0_1px_2px_rgba(0,0,0,.04)]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFFF99] text-[#0a0a0a] shadow-[0_8px_18px_rgba(201,201,42,.18)]">
              <VideoIcon />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#171717]">Group Meet</h2>
                <span className="rounded-full bg-[#FFFAC2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0a0a0a]">New</span>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-5 text-[#666]">
                Bring every shortlisted and bidding talent into one shared meet. Everyone receives the same action-required invite.
              </p>
              {candidates.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <AvatarStack candidates={candidates} />
                  <span className="text-xs font-medium text-[#666]">{candidates.length} {candidates.length === 1 ? 'talent' : 'talents'} will be invited</span>
                </div>
              )}
              {meeting?.status === 'cancelled' && <p className="mt-2 text-xs font-medium text-red-600">The previous Group Meet was cancelled.</p>}
            </div>
          </div>
          <button type="button" disabled={disabled || candidates.length === 0} onClick={() => setModal('schedule')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40">
            <CalendarPlusIcon /> Schedule group meet
          </button>
        </div>
        <ScheduleModal open={modal != null} mode="schedule" cardTitle={cardTitle} onClose={() => setModal(null)} onSubmit={act} busy={schedule.isPending} />
      </section>
    );
  }

  const talentMembers = meeting.members.filter((member) => member.participant_type === 'talent');
  const teamMembers = meeting.members.filter((member) => member.participant_type !== 'talent');
  const live = meeting.status === 'scheduled' || meeting.status === 'rescheduled';

  return (
    <section className="overflow-hidden rounded-2xl border border-[#E2E2E5] bg-white shadow-[0_8px_30px_rgba(18,18,28,.06)]">
      <header className="flex flex-col gap-3 border-b border-[#ECECEF] bg-[linear-gradient(105deg,#0a0a0a_0%,#1C1C1F_62%,#27272A_100%)] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"><VideoIcon /></div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-[family-name:var(--font-jakarta)] text-base font-semibold">Group Meet</h2>
              {meeting.status === 'rescheduled' && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-950">Rescheduled</span>}
            </div>
            <p className="truncate text-xs text-white/60">{cardTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setModal('reschedule')} disabled={!live} className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40">Reschedule</button>
          <button type="button" onClick={cancelMeeting} disabled={!live || cancel.isPending} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white disabled:opacity-40">Cancel</button>
        </div>
      </header>

      <div className="grid min-h-[410px] lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex flex-col justify-between bg-[#F7F7F8] p-5 sm:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DEDDE4] bg-white px-3 py-1.5 text-xs font-semibold text-[#444] shadow-sm">
              <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-[#aaa]'}`} />
              {live ? `${meeting.accepted_count} accepted · ${meeting.invited_count - meeting.accepted_count - meeting.declined_count} awaiting` : 'Meeting closed'}
            </div>
            <p className="mt-6 text-sm font-semibold text-[#777]">UPCOMING SESSION</p>
            <h3 className="mt-2 max-w-xl font-[family-name:var(--font-jakarta)] text-2xl font-semibold leading-tight tracking-[-.025em] text-[#171717] sm:text-3xl">{meeting.title}</h3>
            <div className="mt-5 grid max-w-xl gap-3 sm:grid-cols-2">
              <InfoTile icon={<CalendarIcon />} label="Date" value={formatGroupMeetDate(meeting.starts_at, meeting.timezone)} />
              <InfoTile icon={<ClockIcon />} label={meeting.timezone} value={formatGroupMeetTimeRange(meeting.starts_at, meeting.ends_at, meeting.timezone)} />
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={`/group-meet/${meeting.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#FFFF99] px-5 py-3 text-sm font-semibold text-[#0a0a0a] shadow-[0_8px_18px_rgba(201,201,42,.18)] hover:bg-[#F2F26B]"><VideoIcon /> Join SquadUp</a>
            <button type="button" onClick={() => navigator.clipboard?.writeText(new URL(`/group-meet/${meeting.id}`, window.location.origin).toString())} className="rounded-xl border border-[#DDDDE1] bg-white px-4 py-3 text-sm font-semibold text-[#444] hover:bg-[#FAFAFA]">Copy invite link</button>
            <span className="text-xs text-[#888]">Invite version {meeting.revision}</span>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-[#ECECEF] bg-white lg:border-l lg:border-t-0">
          <div className="grid grid-cols-2 border-b border-[#ECECEF] px-4 pt-2">
            <TabButton active={tab === 'people'} onClick={() => setTab('people')}>People <span className="ml-1 text-[10px] text-[#999]">{meeting.members.length}</span></TabButton>
            <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>Messages <span className="ml-1 text-[10px] text-[#999]">{meeting.messages.length}</span></TabButton>
          </div>
          {tab === 'people' ? (
            <div className="max-h-[520px] flex-1 overflow-y-auto p-4">
              <GroupLabel>Client</GroupLabel>
              {teamMembers.filter((m) => m.role === 'host').map((member) => <MemberRow key={member.id} member={member} />)}
              {teamMembers.some((m) => m.role === 'team') && <><GroupLabel>UpSquad team</GroupLabel>{teamMembers.filter((m) => m.role === 'team').map((member) => <MemberRow key={member.id} member={member} />)}</>}
              <div className="mt-4 flex items-center justify-between"><GroupLabel>Talent</GroupLabel><span className="mb-2 text-[10px] font-semibold text-[#999]">{meeting.accepted_count}/{meeting.invited_count} accepted</span></div>
              <div className="space-y-1">
                {talentMembers.map((member) => (
                  <div key={member.id} className="rounded-xl border border-transparent px-1 py-1 transition hover:border-[#E9E8EE] hover:bg-[#FAFAFB]">
                    <MemberRow member={member} showPrice />
                    {member.recipient_id && offerByRecipientId?.get(member.recipient_id) && (
                      <div className="mb-2 ml-12 flex flex-wrap gap-1.5">
                        <BidActions offer={offerByRecipientId.get(member.recipient_id)} cardId={cardId} currency={currency} period={period} quantity={quantity} unit={unit} buttonClassName="rounded-md border border-[#E1E1E5] px-2 py-1 text-[10px] font-semibold disabled:opacity-40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-1 flex-col">
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {meeting.messages.map((message) => message.sender_type === 'system' ? (
                  <p key={message.id} className="px-4 text-center text-[11px] leading-4 text-[#999]">{message.body}</p>
                ) : (
                  <div key={message.id} className={message.sender_type === 'business' ? 'ml-10' : 'mr-10'}>
                    <p className="mb-1 text-[10px] font-medium text-[#999]">{message.sender_name}</p>
                    <div className={`rounded-2xl px-3 py-2 text-sm leading-5 ${message.sender_type === 'business' ? 'bg-[#171717] text-white' : 'bg-[#F1F1F3] text-[#333]'}`}>{message.body}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-end gap-2 border-t border-[#ECECEF] p-3">
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} rows={1} placeholder="Message everyone" className="min-h-10 flex-1 resize-none rounded-xl border border-[#DEDEE2] bg-[#F8F8F9] px-3 py-2.5 text-sm outline-none focus:border-[#0a0a0a] focus:bg-white focus:ring-2 focus:ring-[#FFFF99]" />
                <button type="button" onClick={sendMessage} disabled={!draft.trim() || send.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171717] text-white disabled:opacity-30"><SendIcon /></button>
              </div>
            </div>
          )}
        </aside>
      </div>
      <ScheduleModal open={modal != null} mode={modal ?? 'schedule'} cardTitle={cardTitle} meeting={meeting} onClose={() => setModal(null)} onSubmit={act} busy={schedule.isPending || reschedule.isPending} />
    </section>
  );
}

function ScheduleModal({ open, mode, cardTitle, meeting, onClose, onSubmit, busy }: { open: boolean; mode: 'schedule' | 'reschedule'; cardTitle: string; meeting?: GroupMeet | null; onClose: () => void; onSubmit: (input: GroupMeetScheduleInput) => void; busy?: boolean }) {
  const defaults = useMemo(() => {
    const start = meeting ? new Date(meeting.starts_at) : new Date(Date.now() + 86400000);
    if (!meeting) { start.setMinutes(0, 0, 0); start.setHours(Math.max(10, start.getHours())); }
    const end = meeting ? new Date(meeting.ends_at) : new Date(start.getTime() + 45 * 60000);
    return { start: toLocalInput(start), end: toLocalInput(end) };
  }, [meeting]);
  const [title, setTitle] = useState(meeting?.title ?? `${cardTitle} · Group Meet`);
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  useEffect(() => { if (open) { setTitle(meeting?.title ?? `${cardTitle} · Group Meet`); setStart(defaults.start); setEnd(defaults.end); } }, [open, meeting, cardTitle, defaults]);
  if (!open) return null;
  const submit = () => onSubmit({ title, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-[#ECECEF] px-6 py-5"><p className="inline-flex rounded-full bg-[#FFFAC2] px-2 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#0a0a0a]">{mode === 'reschedule' ? 'Update invitation' : 'New invitation'}</p><h3 className="mt-2 font-[family-name:var(--font-jakarta)] text-xl font-semibold text-[#171717]">{mode === 'reschedule' ? 'Reschedule Group Meet' : 'Schedule Group Meet'}</h3><p className="mt-1 text-sm text-[#777]">All shortlisted and bidding talents receive the same invite.</p></div>
        <div className="space-y-4 px-6 py-5">
          <Field label="Meeting title"><input value={title} onChange={(e) => setTitle(e.target.value)} className="field" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Starts"><input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="field" /></Field><Field label="Ends"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="field" /></Field></div>
          <div className="flex items-center gap-3 rounded-xl border border-[#F2F26B] bg-[#FFFEE0] px-4 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFFF99] text-[#0a0a0a]"><VideoIcon /></span><div><p className="text-sm font-semibold text-[#171717]">SquadUp room included</p><p className="text-xs text-[#666]">Camera, microphone, screen sharing, people and messages stay inside SquadHire.</p></div></div>
          {mode === 'reschedule' && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">A rescheduled push notification will be sent to everyone. Existing RSVPs reset so each talent confirms the new time.</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#ECECEF] bg-[#FAFAFB] px-6 py-4"><button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#666] hover:bg-[#EFEFF1]">Cancel</button><button onClick={submit} disabled={busy || !title.trim() || !start || !end} className="rounded-lg bg-[#171717] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Sending…' : mode === 'reschedule' ? 'Send new time' : 'Send invites'}</button></div>
      </div>
      <style jsx>{`.field{width:100%;height:42px;border:1px solid #dedee3;border-radius:10px;padding:0 12px;background:#fff;color:#171717;font-size:14px;outline:none}.field:focus{border-color:#0a0a0a;box-shadow:0 0 0 3px rgba(255,255,153,.75)}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#555]">{label}</span>{children}</label>; }
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className={`border-b-2 px-2 py-3 text-xs font-semibold ${active ? 'border-[#C9C92A] text-[#171717]' : 'border-transparent text-[#888] hover:text-[#444]'}`}>{children}</button>; }
function GroupLabel({ children }: { children: React.ReactNode }) { return <p className="mb-2 mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#AAA]">{children}</p>; }
function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex gap-3 rounded-xl border border-[#E4E4E7] bg-white p-3 shadow-sm"><span className="mt-0.5 rounded-lg bg-[#FFFAC2] p-1.5 text-[#0a0a0a]">{icon}</span><div><p className="text-[10px] font-semibold uppercase tracking-wide text-[#999]">{label}</p><p className="mt-0.5 text-sm font-semibold text-[#333]">{value}</p></div></div>; }
function MemberRow({ member, showPrice }: { member: GroupMeetMember; showPrice?: boolean }) { const amount = member.agreed_amount?.amount; const currency = member.agreed_amount?.currency; const cur = currency === 'INR' || !currency ? '₹' : `${String(currency)} `; return <div className="flex items-center gap-3 py-2"><Avatar name={member.display_name} src={member.photo_url} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#292929]">{member.display_name}</p><p className="text-[11px] text-[#999]">{member.role === 'host' ? 'Client · Host' : member.role === 'team' ? 'Sales · UpSquad' : showPrice && typeof amount === 'number' ? `${cur}${amount.toLocaleString()} agreed` : 'Talent'}</p></div><Rsvp status={member.rsvp} /></div>; }
function Rsvp({ status }: { status: string }) { const meta: Record<string, [string, string]> = { accepted: ['Accepted', 'bg-emerald-50 text-emerald-700'], declined: ['Declined', 'bg-red-50 text-red-600'], invited: ['Awaiting', 'bg-[#F2F2F4] text-[#777]'] }; const [label, cls] = meta[status] ?? meta.invited; return <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${cls}`}>{label}</span>; }
function Avatar({ name, src }: { name: string; src?: string | null }) { return src ? <img src={src} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-white" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFFAC2] text-xs font-bold text-[#0a0a0a] ring-2 ring-white">{name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}</span>; }
function AvatarStack({ candidates }: { candidates: CardRecipientForBusiness[] }) { return <div className="flex -space-x-2">{candidates.slice(0, 4).map((c) => <Avatar key={c.recipient_id} name={c.talent_name || 'Talent'} src={c.profile_photo_url} />)}{candidates.length > 4 && <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#171717] text-[10px] font-bold text-white ring-2 ring-white">+{candidates.length - 4}</span>}</div>; }
function toLocalInput(date: Date) { const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
function demoMessage(sender_type: any, sender_name: string, body: string) { return { id: crypto.randomUUID(), sender_type, sender_id: null, sender_name, body, created_at: new Date().toISOString() }; }
function buildPreviewMeeting(cardId: string, cardTitle: string, candidates: CardRecipientForBusiness[], input: GroupMeetScheduleInput): GroupMeet { const talents = candidates.map((candidate, index) => ({ id: `member-${index}`, participant_type: 'talent' as const, participant_id: candidate.talent_user_id, display_name: candidate.talent_name || 'Talent', photo_url: candidate.profile_photo_url, recipient_id: candidate.recipient_id, role: 'guest' as const, rsvp: 'invited' as const, rsvp_at: null, agreed_amount: candidate.offer_amount || { amount: candidate.proposed_price, currency: candidate.currency || 'INR' }, joined_at: null })); return { id: 'preview-group-meet', card_id: cardId, ...input, provider: 'squadup', meeting_link: '/group-meet/preview-group-meet', title: input.title || `${cardTitle} · Group Meet`, status: 'scheduled', revision: 1, created_by_name: 'Meera Kapoor', members: [{ id: 'host', participant_type: 'business', participant_id: 'business', display_name: 'Meera Kapoor', photo_url: null, recipient_id: null, role: 'host', rsvp: 'accepted', rsvp_at: new Date().toISOString(), agreed_amount: null, joined_at: new Date().toISOString() }, { id: 'sales', participant_type: 'salesperson', participant_id: 'sales', display_name: 'Rohan Shah', photo_url: null, recipient_id: null, role: 'team', rsvp: 'accepted', rsvp_at: new Date().toISOString(), agreed_amount: null, joined_at: new Date().toISOString() }, ...talents], messages: [demoMessage('system', 'Group Meet', 'Meera scheduled this Group Meet. Invites were sent to all shortlisted and bidding talents.')], invited_count: talents.length, accepted_count: 0, declined_count: 0 }; }
function VideoIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="12" height="12" rx="3"/><path strokeLinecap="round" strokeLinejoin="round" d="m15 10 5-3v10l-5-3"/></svg>; }
function CalendarPlusIcon() { return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>; }
function CalendarIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>; }
function ClockIcon() { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 7v5l3 2"/></svg>; }
function SendIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z"/></svg>; }
