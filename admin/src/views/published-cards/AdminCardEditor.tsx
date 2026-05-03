'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface CardData {
  id: string;
  source: string;
  status: string;
  distribution: string;
  content: {
    title?: string;
    brand_name?: string;
    business_nature?: string;
    notes?: string;
    subscription_name?: string;
    plan_name?: string;
    working_days?: string[];
    proposed_price?: number;
    markup?: number;
    monthly_price?: number;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    custom_deliverables?: { id: string; name: string; kind: string; per_day: number; per_week: number; per_month: number }[];
  };
  match_rules: {
    category_ids?: string[];
    target_tiers?: string[];
  };
  subscription_request_id: number | null;
}

export default function AdminCardEditor({
  cardId,
  onClose,
}: {
  cardId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: card, isLoading } = useQuery<CardData | null>({
    queryKey: ['admin-request-card', cardId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/subscription-cards/${cardId}`);
      return data || null;
    },
  });

  const [brandName, setBrandName] = useState('');
  const [businessNature, setBusinessNature] = useState('');
  const [notes, setNotes] = useState('');
  const [proposedPrice, setProposedPrice] = useState(0);
  const [markup, setMarkup] = useState(0);
  const [distribution, setDistribution] = useState('broadcast');

  useEffect(() => {
    if (!card) return;
    const c = card.content || {};
    setBrandName(c.brand_name || '');
    setBusinessNature(c.business_nature || '');
    setNotes(c.notes || '');
    setProposedPrice(c.proposed_price || 0);
    setMarkup(c.markup || 0);
    setDistribution(card.distribution || 'broadcast');
  }, [card]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/subscription-cards/${cardId}/edit`, {
        brand_name: brandName || null,
        business_nature: businessNature || null,
        notes: notes || null,
        proposed_price: proposedPrice || null,
        markup,
        distribution,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-request-card', cardId] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      return api.post(`/admin/subscription-cards/${cardId}/publish`, { distribution });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-published-cards'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/subscription-cards/${cardId}`),
    onSuccess: onClose,
  });

  const displayPrice = (proposedPrice || 0) + markup;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-gray-500">Loading card…</p>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-sm text-gray-500">Card not found.</p>
        <button onClick={onClose} className="text-sm text-indigo-600 hover:underline">Go back</button>
      </div>
    );
  }

  const isRequest = card.source === 'request';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-900">
            ← Back
          </button>
          <h1 className="mt-1 text-lg font-semibold text-gray-900">
            {isRequest ? 'Card from Request' : 'Custom Card'}
            {card.subscription_request_id && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                (Request #{card.subscription_request_id})
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {publishMutation.isPending ? 'Publishing…' : 'Publish to Talent'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Customer info (read-only for request cards) */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Customer</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Company:</span>{' '}
                <span className="font-medium">{card.content.brand_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Contact:</span>{' '}
                <span className="font-medium">{card.content.customer_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{' '}
                <span className="font-medium">{card.content.customer_email || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Phone:</span>{' '}
                <span className="font-medium">{card.content.customer_phone || '—'}</span>
              </div>
            </div>
          </div>

          {/* Plan info */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Plan</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Service:</span>{' '}
                <span className="font-medium">{card.content.subscription_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Plan:</span>{' '}
                <span className="font-medium">{card.content.plan_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Tiers:</span>{' '}
                <span className="font-medium">{card.match_rules?.target_tiers?.join(', ') || '—'}</span>
              </div>
              <div>
                <span className="text-gray-500">Days:</span>{' '}
                <span className="font-medium">{card.content.working_days?.join(', ') || '—'}</span>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Pricing</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Proposed (₹/mo)</label>
                <input
                  type="number"
                  value={proposedPrice || ''}
                  onChange={(e) => setProposedPrice(parseInt(e.target.value) || 0)}
                  disabled={isRequest}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Markup (₹/mo)</label>
                <input
                  type="number"
                  min={0}
                  value={markup || ''}
                  onChange={(e) => setMarkup(parseInt(e.target.value) || 0)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Display Price</label>
                <div className="flex items-center rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-semibold">
                  ₹{displayPrice.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Brief */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Brief</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Brand Name</label>
                <input
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Business Nature</label>
                <textarea
                  value={businessNature}
                  onChange={(e) => setBusinessNature(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Distribution</h2>
            <div className="flex gap-4">
              {(['broadcast', 'manual'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    name="distribution"
                    value={mode}
                    checked={distribution === mode}
                    onChange={() => setDistribution(mode)}
                  />
                  {mode === 'broadcast' ? 'Broadcast (auto-match talents)' : 'Soft Publish (manual pick)'}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
