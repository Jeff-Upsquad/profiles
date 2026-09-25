'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';

// Squad Bot Inbox — talent chats Squad Bot handed to the team. Reply here (the
// talent sees it in their Help & Support chat) and hand the chat back to the
// bot when done.

interface ConversationSummary {
  id: string;
  talent_user_id: string;
  talent_name: string | null;
  talent_phone: string | null;
  status: 'bot' | 'handoff';
  handoff_reason: string | null;
  handoff_summary: string | null;
  handoff_at: string | null;
  last_message_at: string;
  last_message: { sender: string; body: string } | null;
}

interface InboxMessage {
  id: string;
  sender: 'talent' | 'bot' | 'staff' | 'system';
  body: string;
  staff_name: string | null;
  created_at: string;
}

interface ConversationDetail extends ConversationSummary {
  talent: { full_name: string | null; phone: string | null } | null;
  messages: InboxMessage[];
}

const REASONS: Record<string, string> = {
  payment: 'Payment',
  complaint: 'Complaint',
  account_status: 'Account status',
  quit_or_documents: 'Quit / documents',
  specific_opportunity: 'Specific opportunity',
  asked_for_person: 'Asked for a person',
  not_in_knowledge: 'Not in knowledge',
  other: 'Other',
};

/** "8 June 2026, 14:05" — house date format plus time. */
function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function SquadBotInbox() {
  // ?chat=<id> (from a Knowledge Center suggestion) opens that chat directly.
  const linkedChat = useSearchParams().get('chat');
  const [filter, setFilter] = useState<'handoff' | 'all'>(linkedChat ? 'all' : 'handoff');
  const [openId, setOpenId] = useState<string | null>(linkedChat);

  const { data, isLoading } = useQuery<{ conversations: ConversationSummary[]; waiting: number }>({
    queryKey: ['admin', 'squad-bot', 'list', filter],
    queryFn: async () => (await api.get(`/admin/squad-bot/conversations?status=${filter}`)).data,
    refetchInterval: 20_000,
  });
  const conversations = data?.conversations ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Squad Bot Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          Talent chats Squad Bot handed to the team. Reply here and the talent sees it in their Help &amp; Support chat.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {([
          ['handoff', `Waiting for the team${data ? ` (${data.waiting})` : ''}`],
          ['all', 'All chats'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white">
          {isLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : !conversations.length ? (
            <p className="p-6 text-center text-sm text-gray-500">
              {filter === 'handoff' ? 'Nothing waiting. Squad Bot is handling every chat.' : 'No chats yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setOpenId(c.id)}
                    className={`block w-full px-4 py-3 text-left hover:bg-gray-50 ${openId === c.id ? 'bg-indigo-50/60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-gray-900">{c.talent_name || c.talent_phone || 'Talent'}</p>
                      {c.status === 'handoff' ? (
                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {REASONS[c.handoff_reason ?? 'other'] ?? 'Waiting'}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">Squad Bot</span>
                      )}
                    </div>
                    {c.last_message && (
                      <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{c.last_message.body}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-400">{when(c.last_message_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {openId ? (
          <ConversationPane id={openId} />
        ) : (
          <div className="hidden rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 lg:block">
            Pick a chat to read and reply.
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationPane({ id }: { id: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const key = ['admin', 'squad-bot', 'conversation', id];

  const { data: conv, isLoading } = useQuery<ConversationDetail>({
    queryKey: key,
    queryFn: async () => (await api.get(`/admin/squad-bot/conversations/${id}`)).data,
    refetchInterval: 15_000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['admin', 'squad-bot', 'list'] });
  };

  const reply = useMutation({
    mutationFn: async (body: string) => (await api.post(`/admin/squad-bot/conversations/${id}/reply`, { body })).data,
    onSuccess: () => {
      setDraft('');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Reply failed'),
  });

  const handBack = useMutation({
    mutationFn: async () => (await api.post(`/admin/squad-bot/conversations/${id}/hand-back`)).data,
    onSuccess: () => {
      toast.success('Squad Bot is answering this talent again');
      refresh();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Could not hand back'),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [conv?.messages.length]);

  if (isLoading || !conv) return <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading…</div>;

  return (
    <div className="flex h-[calc(100vh-240px)] min-h-[480px] flex-col rounded-lg border border-gray-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
        <div>
          <p className="font-semibold text-gray-900">{conv.talent?.full_name || 'Talent'}</p>
          <p className="text-xs text-gray-500">{conv.talent?.phone ?? ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/approvals?search=${encodeURIComponent(conv.talent?.phone || conv.talent?.full_name || '')}&selected=${conv.talent_user_id}`}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Open in Onboarding hub
          </Link>
          {conv.status === 'handoff' && (
            <button
              onClick={() => handBack.mutate()}
              disabled={handBack.isPending}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Hand back to Squad Bot
            </button>
          )}
        </div>
      </div>

      {conv.status === 'handoff' && conv.handoff_summary && (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span className="font-medium">{REASONS[conv.handoff_reason ?? 'other'] ?? 'Handed off'}:</span> {conv.handoff_summary}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {conv.messages.map((m) =>
          m.sender === 'system' ? (
            <p key={m.id} className="text-center text-[11px] text-gray-400">
              {m.body} · {when(m.created_at)}
            </p>
          ) : (
            <div key={m.id} className={`flex ${m.sender === 'talent' ? 'justify-start' : 'justify-end'}`}>
              <div className="max-w-[80%]">
                <p className={`mb-0.5 text-[11px] text-gray-500 ${m.sender === 'talent' ? '' : 'text-right'}`}>
                  {m.sender === 'talent' ? 'Talent' : m.sender === 'bot' ? 'Squad Bot' : m.staff_name || 'Team'} · {when(m.created_at)}
                </p>
                <div
                  className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                    m.sender === 'talent' ? 'bg-gray-100 text-gray-900' : m.sender === 'bot' ? 'bg-indigo-50 text-indigo-950' : 'bg-gray-900 text-white'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) reply.mutate(draft.trim());
        }}
        className="flex items-end gap-2 border-t border-gray-200 p-3"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Reply to the talent…"
          className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() || reply.isPending}
          className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {reply.isPending ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
