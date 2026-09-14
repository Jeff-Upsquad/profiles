'use client';

import { useState } from 'react';
import GroupMeetPanel from '@/components/group-meet/GroupMeetPanel';
import type { CardRecipientForBusiness } from '@/hooks/useBusiness';
import type { GroupMeet, GroupMeetMember } from '../../../../../shared/src/types/group-meet';

const candidates: CardRecipientForBusiness[] = [
  sampleCandidate('recipient-a', 'talent-a', 'Aanya Iyer', 'Pro', 48000, 'accepted'),
  sampleCandidate('recipient-b', 'talent-b', 'Kabir Mehta', 'Top Talents', 52000, 'accepted'),
  sampleCandidate('recipient-c', 'talent-c', 'Diya Nair', 'Pro', 50000, 'pending_business'),
  sampleCandidate('recipient-d', 'talent-d', 'Arjun Rao', 'Junior', 38000, 'pending_talent'),
];

function sampleCandidate(recipient_id: string, talent_user_id: string, talent_name: string, tier: string, price: number, offer_status: string): CardRecipientForBusiness {
  return {
    recipient_id, talent_user_id, talent_name, tier, proposed_price: price, currency: 'INR', offer_status,
    offer_amount: { amount: price, currency: 'INR', period: 'per_month' },
    profile_photo_url: null, current_location: 'Bengaluru, India', languages_spoken: ['English', 'Hindi'], profile_id: null,
    category: { id: 'category', name: 'Performance Marketing', slug: 'performance-marketing' }, tier_custom: null,
    business_review_status: offer_status === 'pending_business' || offer_status === 'pending_talent' ? null : 'shortlisted',
    business_reviewed_at: new Date().toISOString(), selected_at: null, passed_over_at: null, responded_at: new Date().toISOString(), business_seen_at: new Date().toISOString(), subscription_activated_at: null,
  };
}

function member(candidate: CardRecipientForBusiness, rsvp: 'invited' | 'accepted' | 'declined', index: number): GroupMeetMember {
  return { id: `member-${index}`, participant_type: 'talent', participant_id: candidate.talent_user_id, display_name: candidate.talent_name || 'Talent', photo_url: null, recipient_id: candidate.recipient_id, role: 'guest', rsvp, rsvp_at: rsvp === 'invited' ? null : new Date().toISOString(), agreed_amount: candidate.offer_amount ?? null, joined_at: rsvp === 'accepted' ? new Date().toISOString() : null };
}

function sampleMeeting(): GroupMeet {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(16, 0, 0, 0);
  const end = new Date(start.getTime() + 45 * 60000);
  return {
    id: 'preview-meeting', card_id: 'preview-card', title: 'Performance Marketing Team · Group Meet', starts_at: start.toISOString(), ends_at: end.toISOString(), timezone: 'Asia/Kolkata', provider: 'squadup', meeting_link: '/group-meet/preview-meeting', status: 'scheduled', revision: 1, created_by_name: 'Meera Kapoor',
    members: [
      { id: 'host', participant_type: 'business', participant_id: 'business', display_name: 'Meera Kapoor', photo_url: null, recipient_id: null, role: 'host', rsvp: 'accepted', rsvp_at: new Date().toISOString(), agreed_amount: null, joined_at: new Date().toISOString() },
      { id: 'sales', participant_type: 'salesperson', participant_id: 'sales', display_name: 'Rohan Shah', photo_url: null, recipient_id: null, role: 'team', rsvp: 'accepted', rsvp_at: new Date().toISOString(), agreed_amount: null, joined_at: new Date().toISOString() },
      member(candidates[0], 'accepted', 0), member(candidates[1], 'accepted', 1), member(candidates[2], 'invited', 2), member(candidates[3], 'declined', 3),
    ],
    messages: [
      { id: 'msg-system', sender_type: 'system', sender_id: null, sender_name: 'Group Meet', body: 'Meera scheduled this Group Meet. Invites were sent to all shortlisted and bidding talents.', created_at: new Date().toISOString() },
      { id: 'msg-client', sender_type: 'business', sender_id: 'business', sender_name: 'Meera Kapoor', body: 'Hi everyone — looking forward to meeting you. We’ll cover the campaign goals and ways of working.', created_at: new Date().toISOString() },
      { id: 'msg-talent', sender_type: 'talent', sender_id: 'talent-a', sender_name: 'Aanya Iyer', body: 'Thanks Meera, the time works for me!', created_at: new Date().toISOString() },
    ], invited_count: 4, accepted_count: 2, declined_count: 1,
  };
}

export default function GroupMeetPreviewPage() {
  const [meeting, setMeeting] = useState<GroupMeet | null>(() => sampleMeeting());
  return (
    <div className="min-h-screen bg-[#F4F4F6] text-[#171717]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[230px] shrink-0 border-r border-[#E6E6E9] bg-white md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-[#EFEFF1] px-5 py-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#171717] text-[10px] font-black text-white">SH</div><div><p className="text-sm font-bold">SquadHire</p><p className="text-[10px] text-[#999]">Business workspace</p></div></div>
          <nav className="space-y-1 p-3"><Nav label="Find talent" active /><Nav label="Requirement cards" /><Nav label="Messages" /><Nav label="Notifications" /></nav>
          <div className="mt-auto border-t border-[#EFEFF1] p-4"><p className="text-xs font-semibold">Meera Kapoor</p><p className="text-[10px] text-[#999]">Acme Growth Labs</p></div>
        </aside>
        <main className="min-w-0 flex-1">
          <header className="border-b border-[#E6E6E9] bg-white px-5 py-3"><div className="mx-auto flex max-w-6xl items-center justify-between"><div><p className="text-sm font-semibold">Requirement card</p><p className="text-[11px] text-[#999]">Client view · actions also available to Squad CRM sales</p></div><span className="rounded-full bg-[#FFFAC2] px-3 py-1 text-[10px] font-bold text-[#0a0a0a]">INTERACTIVE PREVIEW</span></div></header>
          <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
            <button className="text-xs font-semibold text-[#777] hover:text-[#171717]">← Back to requirement cards</button>
            <div className="rounded-2xl border border-[#E2E2E5] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h1 className="font-[family-name:var(--font-jakarta)] text-xl font-semibold">Acme Growth Labs · Performance Marketing</h1><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">ACTIVE</span></div><p className="mt-1 text-sm text-[#777]">Monthly subscription · Pro & Top Talents · Bengaluru</p></div><div className="flex gap-2"><button onClick={() => setMeeting(null)} className="rounded-lg border border-[#DDDDE1] px-3 py-2 text-xs font-semibold">Preview empty state</button><button onClick={() => setMeeting(sampleMeeting())} className="rounded-lg bg-[#171717] px-3 py-2 text-xs font-semibold text-white">Reset demo</button></div></div>
              <div className="mt-4 grid gap-3 border-t border-[#EFEFF1] pt-4 text-sm sm:grid-cols-3"><Stat label="Requirement" value="Paid ads specialist" /><Stat label="Shortlisted" value="2 talents" /><Stat label="Active bidding" value="2 talents" /></div>
            </div>
            <GroupMeetPanel cardId="preview-card" cardTitle="Performance Marketing Team" candidates={candidates} currency="INR" previewMeeting={meeting} onPreviewMeetingChange={setMeeting} />
            <p className="px-1 text-xs leading-5 text-[#999]">Try People / Messages, send a message, reschedule the invite, cancel it, or switch to the empty state and schedule a new Group Meet.</p>
          </div>
        </main>
      </div>
    </div>
  );
}

function Nav({ label, active }: { label: string; active?: boolean }) { return <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${active ? 'bg-[#FFFAC2] text-[#0a0a0a]' : 'text-[#777]'}`}>{label}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#AAA]">{label}</p><p className="mt-1 font-semibold text-[#333]">{value}</p></div>; }
