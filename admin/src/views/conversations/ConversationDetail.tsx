'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import Button from '@/components/ui/Button';
import type {
  IntroConversationDetail,
  IntroConversationNote,
  IntroMessage,
} from '../../../../shared/src/types/conversations';

interface StaffOption {
  id: string;
  name: string;
  email: string;
}

export default function ConversationDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const { data: conversation } = useQuery<IntroConversationDetail>({
    queryKey: ['admin-conversation', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/conversations/${id}`);
      return data.conversation;
    },
  });
  const { data: messages = [] } = useQuery<IntroMessage[]>({
    queryKey: ['admin-conversation-messages', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/conversations/${id}/messages`, { params: { limit: 100 } });
      return data.messages ?? [];
    },
    refetchInterval: 4_000,
  });
  const { data: notes = [] } = useQuery<IntroConversationNote[]>({
    queryKey: ['admin-conversation-notes', id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/conversations/${id}/notes`);
      return data.notes ?? [];
    },
  });
  const { data: staff = [] } = useQuery<StaffOption[]>({
    queryKey: ['admin-conversation-staff'],
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations/staff-options');
      return data.staff ?? [];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-conversation', id] });
    qc.invalidateQueries({ queryKey: ['admin-conversation-messages', id] });
    qc.invalidateQueries({ queryKey: ['admin-conversations'] });
  };

  const send = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/admin/conversations/${id}/messages`, { body });
    },
    onSuccess: () => {
      setDraft('');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Send failed'),
  });
  const assign = useMutation({
    mutationFn: async (staff_user_id: string) => {
      await api.post(`/admin/conversations/${id}/assign`, { staff_user_id });
    },
    onSuccess: () => {
      toast.success('Salesperson updated');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Assign failed'),
  });
  const close = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/conversations/${id}/close`);
    },
    onSuccess: () => {
      toast.success('Conversation closed');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Close failed'),
  });
  const reopen = useMutation({
    mutationFn: async () => {
      await api.post(`/admin/conversations/${id}/reopen`);
    },
    onSuccess: () => {
      toast.success('Conversation reopened');
      invalidate();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Reopen failed'),
  });
  const addNote = useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/admin/conversations/${id}/notes`, { body });
    },
    onSuccess: () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin-conversation-notes', id] });
      toast.success('Note added');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Note failed'),
  });
  const removeMessage = useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/admin/conversations/${id}/messages/${messageId}`);
    },
    onSuccess: () => {
      invalidate();
      toast.success('Message removed');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  if (!conversation) {
    return <div className="py-12 text-center text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <Link href="/conversations" className="text-sm text-gray-500 hover:text-gray-900">
        ← All conversations
      </Link>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-h-[70vh] flex-col rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h1 className="text-lg font-semibold text-gray-900">
              {conversation.business.name} · {conversation.talent.name}
            </h1>
            <p className="text-xs text-gray-500">
              {conversation.card_title ?? conversation.card_type} ·{' '}
              {conversation.salesperson?.name ?? 'No salesperson yet'}
            </p>
          </div>
          {conversation.frozen && (
            <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
              Read-only ({conversation.frozen_reason})
            </div>
          )}
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {messages.map((m) => (
              <div key={m.id} className="group">
                {m.kind === 'system' || m.deleted_at ? (
                  <p className="text-center text-xs italic text-gray-400">
                    {m.deleted_at ? 'Message removed' : m.body}
                  </p>
                ) : (
                  <div>
                    <p className="text-[11px] text-gray-400">
                      {m.sender_name}
                      {m.sender_type === 'salesperson' || m.sender_type === 'staff' || m.sender_type === 'admin'
                        ? ' · UpSquad'
                        : ''}
                    </p>
                    <div className="inline-block rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900">
                      {m.kind === 'meeting' && m.meeting
                        ? `Meeting · ${m.meeting.status} · ${new Date(m.meeting.starts_at).toLocaleString()}`
                        : m.body}
                    </div>
                    {m.kind === 'text' && (
                      <button
                        type="button"
                        onClick={() => removeMessage.mutate(m.id)}
                        className="ml-2 hidden text-[11px] text-red-500 group-hover:inline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-gray-200 p-4">
            {conversation.can_send ? (
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Write as UpSquad…"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <Button
                  onClick={() => draft.trim() && send.mutate(draft.trim())}
                  disabled={!draft.trim() || send.isPending}
                >
                  Send
                </Button>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-500">Messaging is paused on this room.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Manage</h2>
            <label className="mt-3 block text-xs font-medium text-gray-600">Salesperson</label>
            <select
              value={assignTo || conversation.salesperson?.id || ''}
              onChange={(e) => setAssignTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button
              className="mt-2 w-full"
              disabled={!assignTo || assign.isPending}
              onClick={() => assign.mutate(assignTo)}
            >
              Assign
            </Button>
            <div className="mt-3">
              {conversation.status === 'closed' ? (
                <Button variant="secondary" className="w-full" onClick={() => reopen.mutate()}>
                  Reopen
                </Button>
              ) : (
                <Button variant="danger" className="w-full" onClick={() => close.mutate()}>
                  Close room
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Internal notes</h2>
            <p className="mb-2 text-xs text-gray-500">Only visible to SquadHire staff and admins.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a private note…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <Button
              className="mt-2 w-full"
              disabled={!note.trim() || addNote.isPending}
              onClick={() => addNote.mutate(note.trim())}
            >
              Add note
            </Button>
            <ul className="mt-4 space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="border-t border-gray-100 pt-3">
                  <p className="text-sm text-gray-800">{n.body}</p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {n.author_name} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
