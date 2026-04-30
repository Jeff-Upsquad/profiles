'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from '@/components/subscriptions/SubscriptionCardContent';

interface CardData {
  id: string;
  external_id: string;
  status: 'active' | 'archived';
  distribution: 'broadcast' | 'manual';
  published_at: string;
  expires_at: string | null;
  business_name: string | null;
  subscription_name: string | null;
  plan_label: string | null;
  content: Record<string, unknown>;
}

export default function CardPreviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);

  const { data: card, isLoading, error } = useQuery<CardData>({
    queryKey: ['admin-card-preview', params.id],
    queryFn: async () => {
      const { data } = await api.get(`/admin/subscription-cards/${params.id}`);
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Loading card preview…</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-red-600">Failed to load card.</p>
      </div>
    );
  }

  const business = card.business_name || 'Unknown business';
  const published = card.published_at
    ? new Date(card.published_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Card Preview — Talent View</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{business}</h2>
          <div className="mt-2 flex items-center justify-center gap-2">
            <Badge variant={card.status === 'active' ? 'green' : 'gray'}>
              {card.status === 'active' ? 'Active' : 'Archived'}
            </Badge>
            {card.distribution === 'manual' && (
              <Badge variant="yellow">Soft Published</Badge>
            )}
            {published && (
              <span className="text-xs text-gray-500">Published {published}</span>
            )}
          </div>
        </div>

        <Card className="p-5">
          <SubscriptionCardContent content={card.content as any} />
        </Card>
      </div>
    </div>
  );
}
