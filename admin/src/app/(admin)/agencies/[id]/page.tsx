'use client';

import { use } from 'react';
import AgencyDetail from '@/views/agencies/AgencyDetail';

export default function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AgencyDetail id={id} />;
}
