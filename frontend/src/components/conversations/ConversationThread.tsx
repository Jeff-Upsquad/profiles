'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import MeetingCard from './MeetingCard';
import ProposeMeetingModal from './ProposeMeetingModal';
import type {
  IntroConversationDetail,
  IntroMeetingProvider,
  IntroMessage,
  IntroSenderType,
} from '../../../../shared/src/types/conversations';

const FREEZE_COPY: Record<string, string> = {
  assigned: 'This card is assigned. Chat has moved to SquadHub.',
  placed: 'This hire is placed. Chat has moved to SquadHub.',
  cancelled: 'This card was cancelled. The conversation is read-only.',
  closed: 'This job is closed. The conversation is read-only.',
  archived: 'This card was archived. The conversation is read-only.',
  admin_closed: 'This conversation was closed by UpSquad.',
};

export default function ConversationThread({
  conversation,
  messages,
  selfType,
  selfId,
  onSend,
  sending,
  onPropose,
  proposing,
  onRespond,
  onCancelMeeting,
  meetingBusy,
  openMeetOnMount,
  backHref,
}: {
  conversation: IntroConversationDetail;
  messages: IntroMessage[];
  selfType: IntroSenderType;
  selfId: string;
  onSend: (body: string) => void;
  sending?: boolean;
  onPropose: (input: {
    starts_at: string;
    ends_at?: string;
    timezone?: string;
    provider: IntroMeetingProvider;
    meeting_link: string;
  }) => void;
  proposing?: boolean;
  onRespond: (meetingId: string, action: 'accept' | 'decline') => void;
  onCancelMeeting: (meetingId: string) => void;
  meetingBusy?: boolean;
  openMeetOnMount?: boolean;
  backHref: string;
}) {
  const [draft, setDraft] = useState('');
  const [meetOpen, setMeetOpen] = useState(!!openMeetOnMount);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const counterpart =
    selfType === 'business' ? conversation.talent : conversation.business;
  const salesLabel = conversation.salesperson
    ? `${conversation.salesperson.name} · UpSquad`
    : 'UpSquad will join shortly';

  const submit = () => {
    const body = draft.trim();
    if (!body || !conversation.can_send) return;
    onSend(body);
    setDraft('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <div className="flex shrink-0 items-center gap-2 border-b border-[#E7E7EA] px-2 py-2.5 sm:px-3">
        <Link
          href={backHref}
          aria-label="All chatrooms"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#0a0a0a] hover:bg-[#F5F5F6]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {counterpart.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={counterpart.photo_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFEFEF] text-sm font-semibold text-[#0a0a0a]">
            {(counterpart.name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
            {counterpart.name}
          </p>
          <p className="truncate text-[11px] text-[#737373]">
            {conversation.card_title ?? 'Chatroom'} · {salesLabel}
          </p>
        </div>
        {conversation.can_send && (
          <button
            type="button"
            onClick={() => setMeetOpen(true)}
            className="mr-1 shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#0a0a0a] hover:bg-[#F5F5F6]"
          >
            Meet
          </button>
        )}
      </div>

      {conversation.frozen && conversation.frozen_reason && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          {FREEZE_COPY[conversation.frozen_reason] ?? 'This conversation is read-only.'}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.map((m) => {
          if (m.deleted_at) {
            return (
              <p key={m.id} className="text-center text-xs italic text-[#a3a3a3]">
                Message removed
              </p>
            );
          }
          if (m.kind === 'system') {
            return (
              <p key={m.id} className="px-6 text-center text-xs text-[#a3a3a3]">
                {m.body}
              </p>
            );
          }
          const mine = m.sender_id === selfId && m.sender_type === selfType;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] space-y-0.5 ${mine ? 'items-end' : 'items-start'}`}>
                <p className={`px-1 text-[11px] text-[#a3a3a3] ${mine ? 'text-right' : ''}`}>
                  {mine ? 'You' : m.sender_name}
                  {m.sender_type === 'salesperson' || m.sender_type === 'staff' || m.sender_type === 'admin'
                    ? ' · UpSquad'
                    : ''}
                </p>
                {m.kind === 'meeting' && m.meeting ? (
                  <MeetingCard
                    meeting={m.meeting}
                    selfType={selfType}
                    canAct={conversation.can_send}
                    onAccept={() => onRespond(m.meeting!.id, 'accept')}
                    onDecline={() => onRespond(m.meeting!.id, 'decline')}
                    onCancel={() => onCancelMeeting(m.meeting!.id)}
                    busy={meetingBusy}
                  />
                ) : (
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                      mine ? 'bg-[#0a0a0a] text-white' : 'bg-[#F0F0F0] text-[#0a0a0a]'
                    }`}
                  >
                    {m.body}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-[#E7E7EA] bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {conversation.can_send ? (
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={draft}
              rows={1}
              placeholder="Message"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-[#E7E7EA] bg-[#F7F7F7] px-3.5 py-2.5 text-[15px] leading-snug text-[#0a0a0a] outline-none placeholder:text-[#a3a3a3] focus:border-[#cfcfcf] focus:bg-white"
              onChange={(e) => {
                setDraft(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || sending}
              aria-label="Send"
              className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-[#737373]">This chatroom is paused.</p>
        )}
      </div>

      <ProposeMeetingModal
        open={meetOpen}
        onClose={() => setMeetOpen(false)}
        loading={proposing}
        onSubmit={(input) => {
          onPropose(input);
          setMeetOpen(false);
        }}
      />
    </div>
  );
}
