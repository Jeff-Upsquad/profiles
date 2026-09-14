'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  RoomContext,
  useConnectionState,
  useLocalParticipant,
  useParticipants,
  useTracks,
} from '@livekit/components-react';
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client';
import '@livekit/components-styles';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { joinGroupMeet, leaveGroupMeet, refreshGroupMeet, respondToGroupMeet, sendGroupMeetMessage } from '@/hooks/useGroupMeet';
import { useBusinessAssignmentOffers } from '@/hooks/useBusinessAssignmentOffers';
import BidActions from '@/components/subscriptions/BidActions';
import type { GroupMeet, GroupMeetJoinCredentials, GroupMeetMember } from '../../../../shared/src/types/group-meet';
import { formatGroupMeetWhen } from '../../../../shared/src/groupMeetWhen';
import styles from './GroupMeetRoom.module.css';

export default function GroupMeetRoom({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const role = user?.role === 'business' ? 'business' : user?.role === 'talent' ? 'talent' : null;
  const [credentials, setCredentials] = useState<GroupMeetJoinCredentials | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<GroupMeet | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [joinNonce, setJoinNonce] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!token || !role) {
      router.replace(user?.role === 'talent' ? '/login/talent' : '/login/business');
      return;
    }
    let active = true;
    const liveRoom = new Room({ adaptiveStream: true, dynacast: true });
    const enter = async () => {
      if (role === 'talent') {
        const meeting = await refreshGroupMeet(meetingId, '', 'talent');
        if (!active) return;
        if (meeting.status === 'cancelled') {
          setError('This Group Meet was cancelled.');
          return;
        }
        if (meeting.self_rsvp === 'declined') {
          setError('You declined this Group Meet.');
          return;
        }
        if (meeting.self_rsvp !== 'accepted') {
          setInvite(meeting);
          return;
        }
      }
      const next = await joinGroupMeet(meetingId, role);
      if (!active) return;
      setInvite(null);
      setCredentials(next);
      setRoom(liveRoom);
      liveRoom.on(RoomEvent.Disconnected, () => {
        if (active) setError('The SquadUp room disconnected. You can rejoin from the card.');
      });
      await liveRoom.connect(next.url, next.token);
      await liveRoom.localParticipant.setMicrophoneEnabled(true).catch(() => undefined);
    };
    enter().catch((reason: any) => {
      liveRoom.disconnect().catch(() => undefined);
      if (active) setError(reason.response?.data?.message || reason.message || 'Could not join SquadUp.');
    });
    return () => {
      active = false;
      liveRoom.disconnect().catch(() => undefined);
    };
  }, [isLoading, joinNonce, meetingId, role, router, token, user?.role]);

  const respond = async (action: 'accept' | 'decline') => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      await respondToGroupMeet(meetingId, action);
      if (action === 'decline') {
        setInvite(null);
        setError('You declined this Group Meet.');
        return;
      }
      setInvite(null);
      setJoinNonce((value) => value + 1);
    } catch (reason: any) {
      toast.error(reason.response?.data?.message || 'Could not update your response');
    } finally {
      setInviteBusy(false);
    }
  };

  const leave = useCallback(async () => {
    if (room) await room.disconnect().catch(() => undefined);
    if (role) await leaveGroupMeet(meetingId, role).catch(() => undefined);
    const cardId = credentials?.meeting.card_id;
    router.replace(role === 'business' && cardId ? `/business/subscription/${cardId}` : '/talent/dashboard');
  }, [credentials?.meeting.card_id, meetingId, role, room, router]);

  if (error) return <RoomError message={error} onBack={() => router.back()} />;
  if (invite) return <TalentInvite meeting={invite} busy={inviteBusy} onAccept={() => respond('accept')} onDecline={() => respond('decline')} />;
  if (!credentials || !room || !role) return <RoomLoading />;
  return <ConnectedRoom room={room} initialMeeting={credentials.meeting} role={role} onLeave={leave} />;
}

function ConnectedRoom({ room, initialMeeting, role, onLeave }: { room: Room; initialMeeting: GroupMeet; role: 'business' | 'talent'; onLeave: () => void }) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [tab, setTab] = useState<'people' | 'chat'>('people');
  const [draft, setDraft] = useState('');
  const offers = useBusinessAssignmentOffers(meeting.card_id, role === 'business');
  const offerByRecipient = useMemo(() => new Map((offers.data ?? []).map((offer) => [offer.recipient_id, offer])), [offers.data]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshGroupMeet(meeting.id, meeting.card_id, role).then(setMeeting).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [meeting.card_id, meeting.id, role]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      const message = await sendGroupMeetMessage(meeting.id, role, body);
      setMeeting((current) => ({ ...current, messages: [...current.messages, message] }));
    } catch {
      toast.error('Could not send message');
    }
  };

  return (
    <RoomContext.Provider value={room}>
      <main className={styles.shell} data-lk-theme="default">
        <section className={styles.stage}>
          <RoomHeader meeting={meeting} />
          <RoomStage />
          <RoomControls onLeave={onLeave} railOpen={true} onToggleRail={() => setTab((current) => current === 'people' ? 'chat' : 'people')} />
        </section>
        <aside className={styles.rail}>
          <div className="grid grid-cols-2 border-b border-[#E8E8EB] px-4 pt-2">
            <Tab active={tab === 'people'} onClick={() => setTab('people')}>People · {meeting.members.length}</Tab>
            <Tab active={tab === 'chat'} onClick={() => setTab('chat')}>Messages · {meeting.messages.length}</Tab>
          </div>
          {tab === 'people' ? (
            <PeopleRail meeting={meeting} offerByRecipient={offerByRecipient} showBidActions={role === 'business'} />
          ) : (
            <ChatRail meeting={meeting} role={role} draft={draft} setDraft={setDraft} onSend={send} />
          )}
        </aside>
        <RoomAudioRenderer />
      </main>
    </RoomContext.Provider>
  );
}

function RoomStage() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ], { onlySubscribed: false });
  return <GridLayout tracks={tracks} className={styles.grid}><ParticipantTile /></GridLayout>;
}

function RoomHeader({ meeting }: { meeting: GroupMeet }) {
  const participants = useParticipants();
  const state = useConnectionState();
  const connection = state === ConnectionState.Connected ? `${participants.length} in SquadUp` : state === ConnectionState.Reconnecting ? 'Reconnecting…' : 'Connecting…';
  const when = formatGroupMeetWhen(meeting.starts_at, meeting.timezone);
  return <header className="flex items-center gap-3 px-5 py-4"><span className="h-2.5 w-2.5 rounded-full bg-[#FFFF99] shadow-[0_0_0_7px_rgba(255,255,153,.12)]" /><div className="min-w-0"><h1 className="truncate text-sm font-semibold text-white">{meeting.title}</h1><p className="truncate text-xs text-white/55">Group Meet · {when} · {connection}</p></div><span className="ml-auto rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#FFFF99]">Live</span></header>;
}

function RoomControls({ onLeave, onToggleRail }: { onLeave: () => void; railOpen: boolean; onToggleRail: () => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;
  const toggle = async (kind: 'mic' | 'camera' | 'screen') => {
    setBusy(kind);
    try {
      if (kind === 'mic') await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      if (kind === 'camera') await localParticipant.setCameraEnabled(!isCameraEnabled);
      if (kind === 'screen') await localParticipant.setScreenShareEnabled(!isScreenShareEnabled, { audio: true });
    } catch (reason: any) {
      toast.error(reason?.name === 'NotAllowedError' ? 'Permission denied—check browser settings' : 'Could not switch device');
    } finally { setBusy(null); }
  };
  return <footer className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex items-center gap-2"><Control title={isMicrophoneEnabled ? 'Mute' : 'Unmute'} on={isMicrophoneEnabled} disabled={busy === 'mic'} onClick={() => toggle('mic')}><MicIcon off={!isMicrophoneEnabled} /></Control><Control title={isCameraEnabled ? 'Camera off' : 'Camera on'} on={isCameraEnabled} disabled={busy === 'camera'} onClick={() => toggle('camera')}><CameraIcon off={!isCameraEnabled} /></Control>{canShare && <Control title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'} on={isScreenShareEnabled} disabled={busy === 'screen'} onClick={() => toggle('screen')}><ScreenIcon /></Control>}<Control title="People and messages" onClick={onToggleRail}><ChatIcon /></Control></div><button type="button" onClick={onLeave} className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700">Leave</button></footer>;
}

function Control({ title, on, disabled, onClick, children }: { title: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={title} aria-label={title} disabled={disabled} onClick={onClick} className={`${styles.control} ${on ? styles.controlOn : ''}`}>{children}</button>;
}

function PeopleRail({ meeting, offerByRecipient, showBidActions }: { meeting: GroupMeet; offerByRecipient: Map<string, any>; showBidActions: boolean }) {
  const participants = useParticipants();
  const online = new Set(participants.map((participant) => participant.identity));
  const groups = [
    ['Client', meeting.members.filter((m) => m.role === 'host')],
    ['UpSquad team', meeting.members.filter((m) => m.role === 'team')],
    ['Talent', meeting.members.filter((m) => m.role === 'guest')],
  ] as const;
  return <div className="flex-1 overflow-y-auto p-4">{groups.map(([label, members]) => members.length > 0 && <div key={label} className="mb-5"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#A0A0A6]">{label}</p><div className="space-y-1">{members.map((member) => { const identity = `${member.participant_type}:${member.participant_id}`; const offer = member.recipient_id ? offerByRecipient.get(member.recipient_id) : null; return <div key={member.id} className="rounded-xl border border-transparent p-2 hover:border-[#E7E7EA] hover:bg-[#FAFAFB]"><Member member={member} online={online.has(identity)} />{showBidActions && offer && <div className="ml-11 mt-1 flex flex-wrap gap-1.5"><BidActions offer={offer} cardId={meeting.card_id} currency={(member.agreed_amount?.currency as string) || 'INR'} buttonClassName="rounded-md border border-[#E1E1E5] px-2 py-1 text-[10px] font-semibold disabled:opacity-40" /></div>}</div>; })}</div></div>)}</div>;
}

function Member({ member, online }: { member: GroupMeetMember; online: boolean }) {
  const amount = member.agreed_amount?.amount;
  return <div className="flex items-center gap-3"><span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFFAC2] text-xs font-bold text-[#0A0A0A]">{member.photo_url ? <img src={member.photo_url} alt="" className="h-full w-full object-cover" /> : initials(member.display_name)}<span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white ${online ? 'bg-emerald-500' : 'bg-[#C9C9CE]'}`} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#292929]">{member.display_name}</p><p className="text-[11px] text-[#929299]">{member.role === 'host' ? 'Client · Host' : member.role === 'team' ? 'Sales · UpSquad' : typeof amount === 'number' ? `₹${amount.toLocaleString('en-IN')} agreed` : 'Talent'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${member.rsvp === 'accepted' ? 'bg-emerald-50 text-emerald-700' : member.rsvp === 'declined' ? 'bg-red-50 text-red-600' : 'bg-[#F1F1F3] text-[#777]'}`}>{member.rsvp === 'accepted' ? 'Accepted' : member.rsvp === 'declined' ? 'Declined' : 'Awaiting'}</span></div>;
}

function ChatRail({ meeting, role, draft, setDraft, onSend }: { meeting: GroupMeet; role: 'business' | 'talent'; draft: string; setDraft: (value: string) => void; onSend: () => void }) {
  return <div className="flex min-h-0 flex-1 flex-col"><div className="flex-1 space-y-3 overflow-y-auto p-4">{meeting.messages.map((message) => message.sender_type === 'system' ? <p key={message.id} className="px-4 text-center text-[11px] leading-4 text-[#999]">{message.body}</p> : <div key={message.id} className={message.sender_type === role ? 'ml-10' : 'mr-10'}><p className="mb-1 text-[10px] font-medium text-[#999]">{message.sender_name}</p><div className={`rounded-2xl px-3 py-2 text-sm leading-5 ${message.sender_type === role ? 'bg-[#171717] text-white' : 'bg-[#F1F1F3] text-[#333]'}`}>{message.body}</div></div>)}</div><div className="flex items-end gap-2 border-t border-[#E8E8EB] p-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} rows={1} placeholder="Message everyone" className="min-h-10 flex-1 resize-none rounded-xl border border-[#DEDEE2] bg-[#F8F8F9] px-3 py-2.5 text-sm outline-none focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#FFFF99]" /><button type="button" onClick={onSend} disabled={!draft.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#171717] text-white disabled:opacity-30"><SendIcon /></button></div></div>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`border-b-2 px-2 py-3 text-xs font-semibold ${active ? 'border-[#C9C92A] text-[#171717]' : 'border-transparent text-[#888]'}`}>{children}</button>; }
function RoomLoading() { return <main className="grid min-h-screen place-items-center bg-[#111214] text-white"><div className="text-center"><span className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-white/20 border-t-[#FFFF99]" /><p className="mt-4 text-sm text-white/70">Joining SquadUp…</p></div></main>; }
function RoomError({ message, onBack }: { message: string; onBack: () => void }) { return <main className="grid min-h-screen place-items-center bg-[#111214] p-6 text-white"><div className="max-w-md text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFFF99] text-[#0A0A0A]"><CameraIcon /></div><h1 className="mt-4 text-xl font-semibold">Couldn’t join SquadUp</h1><p className="mt-2 text-sm text-white/60">{message}</p><button type="button" onClick={onBack} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#171717]">Back to Group Meet</button></div></main>; }
function TalentInvite({ meeting, busy, onAccept, onDecline }: { meeting: GroupMeet; busy: boolean; onAccept: () => void; onDecline: () => void }) {
  const when = formatGroupMeetWhen(meeting.starts_at, meeting.timezone);
  return (
    <main className="grid min-h-screen place-items-center bg-[#111214] p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1A1B20] p-6">
        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#FFFF99]">{meeting.status === 'rescheduled' ? `Updated invitation · version ${meeting.revision}` : 'Group invitation'}</p>
        <h1 className="mt-3 text-2xl font-semibold">{meeting.title}</h1>
        <p className="mt-3 text-sm text-white/80">{when}</p>
        <p className="mt-1 text-xs text-white/50">{meeting.timezone} · {meeting.invited_count} talents invited</p>
        <p className="mt-5 text-sm leading-5 text-white/65">Please respond before joining SquadUp.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onDecline} className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-40">Decline</button>
          <button type="button" disabled={busy} onClick={onAccept} className="rounded-xl bg-[#FFFF99] px-4 py-3 text-sm font-semibold text-[#0A0A0A] disabled:opacity-40">{busy ? 'Updating…' : 'Accept invite'}</button>
        </div>
      </div>
    </main>
  );
}
function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase(); }
function Svg({ children }: { children: ReactNode }) { return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>; }
function MicIcon({ off }: { off?: boolean }) { return <Svg><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" />{off && <path d="M3 3l18 18" />}</Svg>; }
function CameraIcon({ off }: { off?: boolean }) { return <Svg><path d="M15 10l4.5-2.5v9L15 14M4 6h11v12H4z" />{off && <path d="M3 3l18 18" />}</Svg>; }
function ScreenIcon() { return <Svg><path d="M4 5h16v11H4zM8 20h8M12 16v4" /></Svg>; }
function ChatIcon() { return <Svg><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z" /></Svg>; }
function SendIcon() { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z" /></svg>; }
