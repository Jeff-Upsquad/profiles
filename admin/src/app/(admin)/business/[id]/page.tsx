'use client';

import { use } from 'react';
import BusinessDetail from '@/views/business/BusinessDetail';

export default function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BusinessDetail businessId={id} />;
}
