'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
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
}) {
  const [draft, setDraft] = useState('');
  const [meetOpen, setMeetOpen] = useState(!!openMeetOnMount);
  const bottomRef = useRef<HTMLDivElement>(null);

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
  };

  return (
    <div className="flex min-h-[70vh] flex-col rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-5 py-4">
        <p className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
          {counterpart.name}
        </p>
        <p className="text-xs text-[#737373]">
          {conversation.card_title ?? 'Intro room'} · {salesLabel}
        </p>
      </div>

      {conversation.frozen && conversation.frozen_reason && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
          {FREEZE_COPY[conversation.frozen_reason] ?? 'This conversation is read-only.'}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
              <p key={m.id} className="text-center text-xs text-[#a3a3a3]">
                {m.body}
              </p>
            );
          }
          const mine = m.sender_id === selfId && m.sender_type === selfType;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] space-y-1">
                <p className="text-[11px] text-[#a3a3a3]">
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
                    className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      mine ? 'bg-[#0a0a0a] text-white' : 'bg-[#F5F5F6] text-[#0a0a0a]'
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

      <div className="border-t border-[#E7E7EA] p-4">
        {conversation.can_send ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message…"
              rows={2}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => setMeetOpen(true)}>
                Meet
              </Button>
              <Button size="sm" onClick={submit} loading={sending} disabled={!draft.trim()}>
                Send
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-[#737373]">Messaging is paused on this room.</p>
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
