'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import AdminCardEditor from './AdminCardEditor';

interface SubscriptionRequest {
  id: number;
  service_type: string;
  tier: string;
  plan: string;
  proposed_price: number;
  working_days: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  status: string;
  created_at: string;
}

export default function AdminRequestsList() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: res, isLoading } = useQuery({
    queryKey: ['admin-subscription-requests', statusFilter, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      return api.get('/admin/subscription-requests', { params }).then((r) => r.data);
    },
  });
  const requests: SubscriptionRequest[] = res?.data || [];

  const createCardMutation = useMutation({
    mutationFn: (requestId: number) =>
      api.post('/admin/subscription-cards/from-request', { subscription_request_id: requestId }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-requests'] });
      if (data?.data?.id) setEditingCardId(data.data.id);
    },
  });

  if (editingCardId) {
    return (
      <AdminCardEditor
        cardId={editingCardId}
        onClose={() => {
          setEditingCardId(null);
          queryClient.invalidateQueries({ queryKey: ['admin-subscription-requests'] });
          queryClient.invalidateQueries({ queryKey: ['admin-published-cards'] });
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 bg-white px-6 pt-5 pb-4">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">From Requests</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Inbound subscription requests from the pricing page. Publish to talent only.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="published">Published</option>
            <option value="declined">Declined</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            className="flex-1 min-w-[200px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
            <p className="text-sm text-gray-500">No subscription requests found.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-sm font-semibold">
                    {(req.company || req.name).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {req.company || req.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {req.service_type} · {req.tier} · {req.plan}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    ₹{req.proposed_price.toLocaleString()}
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: req.status === 'pending' ? '#FEF3C7' : req.status === 'published' ? '#D1FAE5' : '#F3F4F6',
                      color: req.status === 'pending' ? '#92400E' : req.status === 'published' ? '#065F46' : '#374151',
                    }}
                  >
                    {req.status}
                  </span>
                  {(req.status === 'pending' || req.status === 'in_review') && (
                    <button
                      onClick={() => createCardMutation.mutate(req.id)}
                      disabled={createCardMutation.isPending}
                      className="ml-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {createCardMutation.isPending ? 'Creating…' : 'Review'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
