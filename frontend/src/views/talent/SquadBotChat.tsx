'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import { whatsappDeepLink } from '@/lib/whatsapp';

// Squad Bot — the talent help chat. Answers from UpSquad's Knowledge Center and
// the talent's own onboarding progress; hands off to the team when it can't,
// and the team's replies appear in this same thread.

interface ChatMessage {
  id: string;
  sender: 'talent' | 'bot' | 'staff';
  body: string;
  staff_name: string | null;
  created_at: string;
}

interface ChatResponse {
  status: 'bot' | 'handoff';
  messages: ChatMessage[];
}

const CHAT_KEY = ['talent', 'squad-bot'];

const SUGGESTIONS = [
  "What's my next step?",
  'When do I get paid?',
  'How many portfolio items do I need?',
  'I need help with my account',
];

/** Linkify full URLs in a message (the bot writes links as plain URLs). */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all underline">
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function SquadBotChat() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ChatResponse>({
    queryKey: CHAT_KEY,
    queryFn: async () => (await api.get('/talent/squad-bot')).data,
    // While the team has the chat, check for their reply.
    refetchInterval: (q) => (q.state.data?.status === 'handoff' ? 15_000 : false),
  });

  const send = useMutation({
    mutationFn: async (body: string) => (await api.post('/talent/squad-bot/messages', { body })).data as ChatResponse,
    onMutate: (body) => {
      // Show the talent's message straight away.
      qc.setQueryData<ChatResponse>(CHAT_KEY, (prev) => ({
        status: prev?.status ?? 'bot',
        messages: [
          ...(prev?.messages ?? []),
          { id: `pending-${Date.now()}`, sender: 'talent', body, staff_name: null, created_at: new Date().toISOString() },
        ],
      }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: CHAT_KEY }),
    onError: (err: any, body) => {
      toast.error(err.response?.data?.message || 'Could not send your message. Please try again.');
      setDraft(body);
      qc.invalidateQueries({ queryKey: CHAT_KEY });
    },
  });

  const messages = data?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, send.isPending]);

  function submit(text: string) {
    const body = text.trim();
    if (!body || send.isPending) return;
    setDraft('');
    send.mutate(body);
  }

  return (
    <div className="font-[family-name:var(--font-inter)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#0a0a0a]">Help &amp; Support</h1>
          <p className="mt-1 text-[13px] text-[#525252]">
            Ask Squad Bot anything about UpSquad, your onboarding or the app. It brings in the team when you need a person.
          </p>
        </div>
        <a
          href={whatsappDeepLink('Hi, I need help with my UpSquad profile.')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-medium text-[#525252] underline underline-offset-2 hover:text-[#0a0a0a]"
        >
          Prefer WhatsApp?
        </a>
      </div>

      <div className="mt-5 flex h-[calc(100dvh-260px)] min-h-[420px] flex-col rounded-xl border border-[#E7E7EA] bg-white shadow-sm">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {isLoading ? (
            <p className="text-[13px] text-[#a3a3a3]">Loading…</p>
          ) : (
            <>
              <BotBubble>
                Hi! I&apos;m Squad Bot, UpSquad&apos;s assistant. Ask me about your next onboarding step, payments, your
                portfolio or the app.
              </BotBubble>
              {messages.map((m) =>
                m.sender === 'talent' ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#0a0a0a] px-3.5 py-2 text-[14px] text-white">
                      <MessageText text={m.body} />
                    </div>
                  </div>
                ) : (
                  <BotBubble key={m.id} label={m.sender === 'staff' ? 'UpSquad team' : undefined} time={m.created_at}>
                    <MessageText text={m.body} />
                  </BotBubble>
                ),
              )}
              {send.isPending && (
                <BotBubble>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a3a3a3]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a3a3a3] [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#a3a3a3] [animation-delay:240ms]" />
                  </span>
                </BotBubble>
              )}
              {!messages.length && !send.isPending && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="rounded-full border border-[#E7E7EA] bg-white px-3 py-1.5 text-[12.5px] text-[#262626] hover:bg-[#f5f5f5]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {data?.status === 'handoff' && (
          <p className="border-t border-[#E7E7EA] bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
            The UpSquad team has this conversation and will reply here. You can keep adding details.
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="flex items-end gap-2 border-t border-[#E7E7EA] p-3"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(draft);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Type your question…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-[#E7E7EA] px-3 py-2 text-[14px] focus:border-[#0a0a0a] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || send.isPending}
            className="h-10 rounded-lg bg-[#0a0a0a] px-4 text-[13px] font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function BotBubble({ children, label, time }: { children: React.ReactNode; label?: string; time?: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%]">
        <p className="mb-0.5 text-[11px] font-medium text-[#737373]">
          {label ?? 'Squad Bot'}
          {time ? <span className="ml-1.5 font-normal text-[#a3a3a3]">{timeLabel(time)}</span> : null}
        </p>
        <div className="whitespace-pre-wrap rounded-2xl rounded-bl-md bg-[#f5f5f5] px-3.5 py-2 text-[14px] text-[#0a0a0a]">
          {children}
        </div>
      </div>
    </div>
  );
}
