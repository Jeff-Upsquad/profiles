'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';
import type { IntroConversationSummary } from '../../../../shared/src/types/conversations';

interface StaffOption {
  id: string;
  name: string;
  email: string;
}

export default function ConversationsList() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: conversations, isLoading } = useQuery<IntroConversationSummary[]>({
    queryKey: ['admin-conversations', status],
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations', {
        params: status ? { status } : {},
      });
      return data.conversations ?? [];
    },
  });
  const { data: staff = [] } = useQuery<StaffOption[]>({
    queryKey: ['admin-conversation-staff'],
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations/staff-options');
      return data.staff ?? [];
    },
  });
  const { data: fallback } = useQuery<{ staff_user_id: string | null }>({
    queryKey: ['admin-fallback-salesperson'],
    queryFn: async () => {
      const { data } = await api.get('/admin/conversations/settings/fallback-salesperson');
      return data;
    },
  });

  const saveFallback = useMutation({
    mutationFn: async (staff_user_id: string | null) => {
      await api.patch('/admin/conversations/settings/fallback-salesperson', { staff_user_id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-fallback-salesperson'] });
      toast.success('Fallback salesperson saved');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Intro rooms between a business, a talent, and an UpSquad salesperson.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm font-medium text-gray-700">Fallback salesperson</label>
        <p className="mb-2 text-xs text-gray-500">
          Used when a business has no default salesperson assigned.
        </p>
        <select
          value={fallback?.staff_user_id ?? ''}
          onChange={(e) => saveFallback.mutate(e.target.value || null)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">None — rooms wait for someone to claim</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.email})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="awaiting_salesperson">Awaiting salesperson</option>
          <option value="closed">Closed</option>
        </select>
        <span className="text-sm text-gray-500">{conversations?.length ?? 0} rooms</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading…</div>
        ) : !conversations?.length ? (
          <div className="py-12 text-center text-sm text-gray-500">No conversations yet.</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Talent</th>
                <th className="px-4 py-3">Salesperson</th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Unread</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversations.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/conversations/${c.id}`} className="font-medium text-gray-900 hover:underline">
                      {c.business.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.talent.name}</td>
                  <td className="px-4 py-3 text-gray-700">{c.salesperson?.name ?? 'Unassigned'}</td>
                  <td className="px-4 py-3 text-gray-500">{c.card_title ?? c.card_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                      {c.frozen ? c.frozen_reason : c.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">{c.unread_count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
