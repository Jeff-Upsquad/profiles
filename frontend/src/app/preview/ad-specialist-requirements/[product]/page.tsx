'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import AdSpecialistBriefPreview from '@/components/preview/AdSpecialistBriefPreview';

export default function AdSpecialistRequirementModePreview({ params }: { params: Promise<{ product: string }> }) {
  const { product } = use(params);
  if (product !== 'subscription' && product !== 'assignment') notFound();
  return <AdSpecialistBriefPreview product={product} />;
}
