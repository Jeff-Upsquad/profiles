'use client';

import { use } from 'react';
import AgencyPublicView from '@/views/business/AgencyPublicView';

export default function AgencyViewPage({ params, searchParams }: { params: Promise<{ agencyId: string }>; searchParams: Promise<{ category_id?: string; categoryId?: string }> }) {
  const { agencyId } = use(params);
  const sp = use(searchParams);
  const categoryId = sp.category_id ?? sp.categoryId;
  return <AgencyPublicView agencyId={agencyId} initialCategoryId={categoryId} />;
}
